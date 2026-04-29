import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { CloudRain, Music2, VolumeX, LogOut, Send, Loader2, Clock, AlertTriangle } from 'lucide-react';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface ChatSession {
  id: string;
  user_a_id: string;
  user_b_id: string;
  user_a_alias: string;
  user_b_alias: string;
  user_a_avatar: string;
  user_b_avatar: string;
  status: string;
  duration_seconds: number;
}

interface ChatProfile {
  id: string;
  name: string;
  image_url: string;
}

const SESSION_DURATION = 7 * 60;

// ─── Similar Mood config loader ───────────────────────────────────────────────
interface SimilarMoodConfig {
  enabled: boolean;
  similar_phase_delay_seconds: number;
  map: Record<string, string[]>;
}

async function loadSimilarMoodConfig(): Promise<SimilarMoodConfig> {
  try {
    const { data } = await (supabase as any)
      .from('chat_config')
      .select('value')
      .eq('key', 'similar_mood')
      .maybeSingle();
    if (data?.value) return { enabled: true, similar_phase_delay_seconds: 15, map: {}, ...data.value };
  } catch {}
  return { enabled: false, similar_phase_delay_seconds: 15, map: {} };
}

// Bidirectional check: A→B or B→A
function isSimilarMood(a: string, b: string, map: Record<string, string[]>): boolean {
  return (map[a]?.includes(b) ?? false) || (map[b]?.includes(a) ?? false);
}

// Role compatibility matrix
// talk ↔ listen, both ↔ any, chill ↔ chill|both
function isCompatibleRole(a: string, b: string): boolean {
  if (a === 'both' || b === 'both') return true;
  if (a === 'talk'   && b === 'listen') return true;
  if (a === 'listen' && b === 'talk')   return true;
  if (a === 'chill'  && b === 'chill')  return true;
  return false;
}

// Score a candidate: higher = better match
function matchScore(myTopicId: string, myRole: string, candidate: any, moodConfig: SimilarMoodConfig): number {
  let score = 0;
  if (candidate.topic_id === myTopicId) score += 10;
  else if (moodConfig.enabled && isSimilarMood(myTopicId, candidate.topic_id, moodConfig.map)) score += 5;
  else return -1; // not eligible
  if (isCompatibleRole(myRole ?? 'both', candidate.role ?? 'both')) score += 3;
  return score;
}

function useRainAmbient() {
  const ctxRef = useRef<AudioContext | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const [on, setOn] = useState(false);

  const start = useCallback(() => {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    if (srcRef.current) return;
    const ctx = ctxRef.current;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1200;
    f.Q.value = 0.3;
    const g = ctx.createGain();
    g.gain.value = 0.06;
    src.connect(f);
    f.connect(g);
    g.connect(ctx.destination);
    src.start();
    srcRef.current = src;
  }, []);

  const stop = useCallback(() => {
    try { srcRef.current?.stop(); } catch {}
    srcRef.current = null;
  }, []);

  const toggle = useCallback(() => {
    if (on) { stop(); setOn(false); } else { start(); setOn(true); }
  }, [on, start, stop]);

  useEffect(() => () => stop(), [stop]);
  return { on, toggle };
}

async function loadBannedWords(): Promise<string[]> {
  const { data } = await supabase.from('banned_words').select('word');
  return (data ?? []).map((r: any) => r.word.toLowerCase());
}

function findBannedWord(text: string, banned: string[]): string | null {
  const lower = text.toLowerCase();
  return banned.find(w => lower.includes(w)) ?? null;
}

function useCountdown(totalSeconds: number, active: boolean, onExpire: () => void) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    expiredRef.current = false;
    setRemaining(totalSeconds);
    const interval = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!expiredRef.current) {
            expiredRef.current = true;
            onExpire();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [active, totalSeconds]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  return { remaining, display: `${mm}:${ss}` };
}

function RatingDialog({ onRate }: { onRate: (stars: number) => void }) {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-[#221810] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl border border-[#e8d9c8] dark:border-[#3a2a1e] text-center space-y-4"
      >
        <p className="font-semibold text-[#4a3728] dark:text-[#e8d9c8] text-lg">
          ให้คะแนนการสนทนา
        </p>
        <p className="text-sm text-[#9c7c5e]">
          ประสบการณ์ครั้งนี้เป็นอย่างไรบ้าง?
        </p>
        <div className="flex justify-center gap-3">
          {[1, 2, 3, 4, 5].map(s => (
            <button
              key={s}
              onMouseEnter={() => setHovered(s)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setSelected(s)}
              className="text-3xl transition-transform hover:scale-110 select-none"
            >
              {s <= (hovered || selected) ? '★' : '☆'}
            </button>
          ))}
        </div>
        <button
          onClick={() => selected > 0 && onRate(selected)}
          disabled={selected === 0}
          className="w-full py-2.5 rounded-xl bg-[#c8956c] hover:bg-[#b07d58] disabled:opacity-40 text-white font-semibold transition-colors"
        >
          ส่งคะแนน
        </button>
        <button
          onClick={() => onRate(0)}
          className="text-xs text-[#9c7c5e] hover:text-[#7c5c3e] transition-colors"
        >
          ข้ามไปก่อน
        </button>
      </motion.div>
    </div>
  );
}

export default function SecretChatRoom() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { on: rainOn, toggle: toggleRain } = useRainAmbient();

  const [bgmOn, setBgmOn] = useState(false);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const toggleBgm = useCallback(() => {
    if (!bgmRef.current) return;
    if (bgmOn) { bgmRef.current.pause(); setBgmOn(false); }
    else { bgmRef.current.play().catch(() => {}); setBgmOn(true); }
  }, [bgmOn]);

  const { topicId, topicName, alias, avatar, role } = (location.state as any) ?? {};

  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [matchStatus, setMatchStatus] = useState<'waiting' | 'matched' | 'ended'>('waiting');
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [bannedWords, setBannedWords] = useState<string[]>([]);
  const [showRating, setShowRating] = useState(false);
  const [bannedWarning, setBannedWarning] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ChatProfile[]>([]);
  // Similar mood config + phase tracking
  const [moodConfig, setMoodConfig] = useState<SimilarMoodConfig>({ enabled: false, similar_phase_delay_seconds: 15, map: {} });
  const matchStartRef = useRef<number>(Date.now());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user || !topicId || !alias) navigate('/secret-chat');
  }, [user, topicId, alias, navigate]);

  useEffect(() => {
    loadBannedWords().then(setBannedWords);
    loadSimilarMoodConfig().then(setMoodConfig);
    (supabase as any)
      .from('chat_profiles')
      .select('id, name, image_url')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }: any) => setProfiles(data ?? []));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleExpire = useCallback(async () => {
    if (!session) return;
    await (supabase as any)
      .from('chat_sessions')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', session.id);
    setMatchStatus('ended');
    setShowRating(true);
  }, [session]);

  const { remaining, display: countdownDisplay } = useCountdown(
    SESSION_DURATION,
    matchStatus === 'matched',
    handleExpire,
  );
  const isUrgent = remaining <= 60 && remaining > 0;

  useEffect(() => {
    if (!user || !topicId || matchStatus !== 'waiting') return;

    // Record when we started waiting (for similar-phase delay)
    matchStartRef.current = Date.now();

    const tryMatch = async () => {
      const elapsedSeconds = (Date.now() - matchStartRef.current) / 1000;
      const inSimilarPhase = moodConfig.enabled && elapsedSeconds >= moodConfig.similar_phase_delay_seconds;

      let query = (supabase as any)
        .from('chat_queue')
        .select('*')
        .neq('user_id', user.id)
        .order('joined_at', { ascending: true })
        .limit(20);

      if (!inSimilarPhase) {
        query = query.eq('topic_id', topicId);
      }

      const { data: queue } = await query;
      if (!queue || queue.length === 0) return;

      // Find best candidate using score
      let best: any = null;
      let bestScore = -1;
      for (const candidate of queue) {
        const score = matchScore(topicId, role ?? 'both', candidate, moodConfig);
        if (score > bestScore) { bestScore = score; best = candidate; }
      }

      if (!best || bestScore < 0) return;
      const partner = best;

      const { data: sess, error } = await (supabase as any)
        .from('chat_sessions')
        .insert({
          topic_id: topicId,
          user_a_id: user.id,
          user_b_id: partner.user_id,
          user_a_alias: alias,
          user_b_alias: partner.alias,
          user_a_avatar: avatar,
          user_b_avatar: partner.avatar,
          user_a_role: role ?? 'both',
          user_b_role: partner.role ?? 'both',
          duration_seconds: SESSION_DURATION,
        })
        .select()
        .single();

      if (error || !sess) return;

      await Promise.all([
        (supabase as any).from('chat_queue').delete().eq('user_id', user.id),
        (supabase as any).from('chat_queue').delete().eq('user_id', partner.user_id),
      ]);
      setSession(sess);
      setMatchStatus('matched');
    };

    const interval = setInterval(tryMatch, 2000);

    const queueChannel = supabase
      .channel(`queue-watch-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_sessions',
        filter: `user_b_id=eq.${user.id}`,
      }, async (payload) => {
        await (supabase as any).from('chat_queue').delete().eq('user_id', user.id);
        setSession(payload.new as ChatSession);
        setMatchStatus('matched');
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(queueChannel);
      (supabase as any).from('chat_queue').delete().eq('user_id', user.id);
    };
  }, [user, topicId, alias, avatar, matchStatus, moodConfig]);

  useEffect(() => {
    if (!session || !user) return;

    (supabase as any)
      .from('chat_messages')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at')
      .then(({ data }: any) => setMessages(data ?? []));

    const ch = supabase
      .channel(`chat-room-${session.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `session_id=eq.${session.id}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_sessions',
        filter: `id=eq.${session.id}`,
      }, (payload) => {
        const updated = payload.new as ChatSession;
        setSession(updated);
        if (updated.status === 'ended') {
          setMatchStatus('ended');
          setShowRating(true);
        }
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload?.user_id !== user.id) {
          setPartnerTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = window.setTimeout(() => setPartnerTyping(false), 2500);
        }
      })
      .subscribe();

    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [session?.id, user?.id]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !session || !user || sending) return;

    const foundWord = findBannedWord(input, bannedWords);
    if (foundWord) {
      await (supabase as any).from('chat_violations').insert({
        session_id: session.id,
        user_id: user.id,
        word: foundWord,
        message: input.trim(),
      });
      setBannedWarning(foundWord);
      setTimeout(() => setBannedWarning(null), 4000);
      setInput('');
      return;
    }

    setSending(true);
    const content = input.trim();
    setInput('');
    await (supabase as any).from('chat_messages').insert({
      session_id: session.id,
      sender_id: user.id,
      content,
    });
    setSending(false);
  }, [input, session, user, sending, bannedWords]);

  const handleInputChange = useCallback((val: string) => {
    setInput(val);
    if (channelRef.current && session) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { user_id: user?.id },
      });
    }
  }, [session, user?.id]);

  const leaveTable = useCallback(async () => {
    if (session) {
      await (supabase as any)
        .from('chat_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', session.id);
    } else {
      await (supabase as any).from('chat_queue').delete().eq('user_id', user?.id);
    }
    setMatchStatus('ended');
    setShowRating(true);
  }, [session, user?.id]);

  const submitRating = useCallback(async (stars: number) => {
    setShowRating(false);
    if (stars > 0 && session && user) {
      const partnerId = session.user_a_id === user.id ? session.user_b_id : session.user_a_id;
      await (supabase as any).from('chat_ratings').insert({
        session_id: session.id,
        rater_id: user.id,
        rated_id: partnerId,
        stars,
      });
    }
    navigate('/');
  }, [session, user, navigate]);

  const myAlias = session
    ? (session.user_a_id === user?.id ? session.user_a_alias : session.user_b_alias)
    : alias;
  const partnerAlias = session
    ? (session.user_a_id === user?.id ? session.user_b_alias : session.user_a_alias)
    : '...';
  const partnerAvatarKey = session
    ? (session.user_a_id === user?.id ? session.user_b_avatar : session.user_a_avatar)
    : '';

  const getAvatarImg = (key: string) => profiles.find(p => p.id === key)?.image_url ?? null;
  const partnerImg = getAvatarImg(partnerAvatarKey);

  const isMyMessage = (msg: Message) => msg.sender_id === user?.id;

  return (
    <div className="fixed inset-0 flex flex-col bg-[#faf6f1] dark:bg-[#1a1410]">
      <audio ref={bgmRef} loop src="" />

      <AnimatePresence>
        {bannedWarning && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-red-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            ข้อความถูกบล็อก — พบคำต้องห้าม
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="shrink-0 bg-[#faf6f1]/95 dark:bg-[#1a1410]/95 backdrop-blur-md border-b border-[#e8d9c8] dark:border-[#3a2a1e] px-4 py-3 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          {matchStatus === 'matched' && session ? (
            <>
              <div className="w-10 h-10 rounded-full bg-[#f0e6d8] dark:bg-[#3a2a1e] overflow-hidden flex items-center justify-center shrink-0 ring-2 ring-[#e8d9c8] dark:ring-[#3a2a1e]">
                {partnerImg
                  ? <img src={partnerImg} alt={partnerAlias} className="w-full h-full object-cover" />
                  : <span className="text-xl">🐻</span>}
              </div>
              <div>
                <p className="font-bold text-[#4a3728] dark:text-[#e8d9c8] text-sm leading-tight">{partnerAlias}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                  </span>
                  <p className="text-[11px] text-[#9c7c5e]">{topicName}</p>
                </div>
              </div>
            </>
          ) : (
            <div>
              <p className="font-bold text-[#4a3728] dark:text-[#e8d9c8] text-sm">คาเฟ่ลับ</p>
              <p className="text-[11px] text-[#9c7c5e]">{topicName}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {matchStatus === 'matched' && (
            <div className={`flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-1.5 rounded-full border transition-colors ${
              isUrgent
                ? 'bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 border-red-300 dark:border-red-800 animate-pulse'
                : 'bg-[#f0e6d8] dark:bg-[#3a2a1e] text-[#7c5c3e] dark:text-[#c8956c] border-[#e8d9c8] dark:border-[#4a3728]'
            }`}>
              <Clock className="w-3.5 h-3.5" />
              {countdownDisplay}
            </div>
          )}

          <button onClick={toggleRain} className={`w-9 h-9 rounded-full flex items-center justify-center transition-all border ${rainOn ? 'bg-sky-100 text-sky-500 border-sky-200' : 'bg-transparent text-[#9c7c5e] border-[#e8d9c8] hover:border-[#c8956c]'}`}>
            <CloudRain className="w-4 h-4" />
          </button>
          <button onClick={toggleBgm} className={`w-9 h-9 rounded-full flex items-center justify-center transition-all border ${bgmOn ? 'bg-violet-100 text-violet-500 border-violet-200' : 'bg-transparent text-[#9c7c5e] border-[#e8d9c8] hover:border-[#c8956c]'}`}>
            {bgmOn ? <Music2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button onClick={leaveTable} className="w-9 h-9 rounded-full flex items-center justify-center text-[#9c7c5e] hover:text-red-500 border border-[#e8d9c8] hover:border-red-300 transition-all" title="ออกจากโต๊ะ">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4 max-w-3xl mx-auto w-full">
        {matchStatus === 'waiting' && (
          <div className="flex flex-col items-center justify-center h-full gap-5 text-center">
            <motion.div
              animate={{ scale: [1, 1.06, 1], rotate: [0, 3, -3, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="w-20 h-20 rounded-3xl bg-[#f0e6d8] dark:bg-[#3a2a1e] flex items-center justify-center text-4xl shadow-lg"
            >
              ☕
            </motion.div>
            <div className="space-y-1.5">
              <p className="font-bold text-[#4a3728] dark:text-[#e8d9c8] text-lg">กำลังหาคู่สนทนา...</p>
              <p className="text-sm text-[#9c7c5e]">รอสักครู่ กำลังจับคู่ในหัวข้อ <span className="font-medium text-[#7c5c3e] dark:text-[#c8956c]">{topicName}</span></p>
              {moodConfig.enabled && (
                <p className="text-xs text-[#c8b09a] mt-1">หากรอนาน {moodConfig.similar_phase_delay_seconds} วินาที จะขยายการจับคู่ไปยัง mood ใกล้เคียง</p>
              )}
            </div>
            <div className="flex gap-1.5">
              {[0, 0.2, 0.4].map((d, i) => (
                <motion.div key={i} className="w-2 h-2 rounded-full bg-[#c8956c]"
                  animate={{ y: [0, -8, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: d }} />
              ))}
            </div>
          </div>
        )}

        {matchStatus === 'matched' && messages.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center py-6">
            <div className="bg-[#f0e6d8] dark:bg-[#3a2a1e] rounded-2xl px-5 py-3 text-center max-w-xs">
              <p className="text-sm font-semibold text-[#7c5c3e] dark:text-[#c8956c]">จับคู่สำเร็จแล้ว</p>
              <p className="text-xs text-[#9c7c5e] mt-1">มีเวลา {Math.floor(SESSION_DURATION / 60)} นาที เริ่มสนทนาได้เลย</p>
            </div>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex gap-3 ${isMyMessage(msg) ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {!isMyMessage(msg) && (
                <div className="w-9 h-9 rounded-full bg-[#f0e6d8] dark:bg-[#3a2a1e] overflow-hidden flex items-center justify-center shrink-0 self-end shadow-sm">
                  {partnerImg ? <img src={partnerImg} alt="" className="w-full h-full object-cover" /> : <span className="text-base">🐻</span>}
                </div>
              )}
              <div className={`max-w-[75%] sm:max-w-[65%] space-y-1 flex flex-col ${isMyMessage(msg) ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-[#9c7c5e] px-1 font-medium">
                  {isMyMessage(msg) ? myAlias : partnerAlias}
                </span>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                  isMyMessage(msg)
                    ? 'bg-[#c8956c] text-white rounded-br-sm'
                    : 'bg-white dark:bg-[#2a1e14] text-[#4a3728] dark:text-[#e8d9c8] border border-[#e8d9c8] dark:border-[#3a2a1e] rounded-bl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {partnerTyping && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex gap-3 items-end">
            <div className="w-9 h-9 rounded-full bg-[#f0e6d8] dark:bg-[#3a2a1e] overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
              {partnerImg ? <img src={partnerImg} alt="" className="w-full h-full object-cover" /> : <span className="text-base">🐻</span>}
            </div>
            <div className="bg-white dark:bg-[#2a1e14] border border-[#e8d9c8] dark:border-[#3a2a1e] rounded-2xl rounded-bl-sm px-5 py-3.5 flex gap-1.5 items-center shadow-sm">
              {[0, 0.15, 0.3].map((delay, i) => (
                <motion.div key={i} className="w-2 h-2 rounded-full bg-[#c8b09a]"
                  animate={{ y: [0, -5, 0] }} transition={{ duration: 0.7, repeat: Infinity, delay }} />
              ))}
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {matchStatus === 'matched' && (
        <div className="shrink-0 bg-[#faf6f1]/95 dark:bg-[#1a1410]/95 backdrop-blur-md border-t border-[#e8d9c8] dark:border-[#3a2a1e] px-4 sm:px-6 py-4">
          <div className="flex gap-3 items-end max-w-3xl mx-auto">
            <div className="flex-1 bg-white dark:bg-[#221810] border border-[#e8d9c8] dark:border-[#3a2a1e] rounded-2xl px-4 py-3 focus-within:border-[#c8956c] focus-within:shadow-sm transition-all">
              <textarea
                value={input}
                onChange={e => handleInputChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="พิมพ์ข้อความ..."
                rows={1}
                className="w-full bg-transparent text-sm text-[#4a3728] dark:text-[#e8d9c8] placeholder:text-[#c8b09a] resize-none outline-none leading-relaxed"
                style={{ maxHeight: 120 }}
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="w-11 h-11 rounded-full bg-[#c8956c] hover:bg-[#b07d58] disabled:opacity-40 flex items-center justify-center text-white transition-all shrink-0 shadow-md"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </motion.button>
          </div>
        </div>
      )}

      {showRating && <RatingDialog onRate={submitRating} />}
    </div>
  );
}
