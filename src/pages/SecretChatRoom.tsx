import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { CloudRain, Music2, VolumeX, LogOut, Send, Loader2, Clock, AlertTriangle } from 'lucide-react';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

const SESSION_DURATION = 7 * 60; // 7 minutes in seconds

// â”€â”€â”€ Rain ambient â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 0.3;
    const g = ctx.createGain(); g.gain.value = 0.06;
    src.connect(f); f.connect(g); g.connect(ctx.destination); src.start();
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

// â”€â”€â”€ Banned words â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function loadBannedWords(): Promise<string[]> {
  const { data } = await supabase.from('banned_words').select('word');
  return (data ?? []).map((r: any) => r.word.toLowerCase());
}

function findBannedWord(text: string, banned: string[]): string | null {
  const lower = text.toLowerCase();
  return banned.find(w => lower.includes(w)) ?? null;
}

// â”€â”€â”€ Countdown hook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
          if (!expiredRef.current) { expiredRef.current = true; onExpire(); }
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

// â”€â”€â”€ Rating Dialog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        <p className="font-semibold text-[#4a3728] dark:text-[#e8d9c8] text-lg">à¹ƒà¸«à¹‰à¸„à¸°à¹à¸™à¸™à¸à¸²à¸£à¸ªà¸™à¸—à¸™à¸²</p>
        <p className="text-sm text-[#9c7c5e]">à¸›à¸£à¸°à¸ªà¸šà¸à¸²à¸£à¸“à¹Œà¸„à¸£à¸±à¹‰à¸‡à¸™à¸µà¹‰à¹€à¸›à¹‡à¸™à¸­à¸¢à¹ˆà¸²à¸‡à¹„à¸£à¸šà¹‰à¸²à¸‡?</p>
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map(s => (
            <button key={s} onMouseEnter={() => setHovered(s)} onMouseLeave={() => setHovered(0)} onClick={() => setSelected(s)} className="text-3xl transition-transform hover:scale-110">
              {s <= (hovered || selected) ? 'â­' : 'â˜†'}
            </button>
          ))}
        </div>
        <button
          onClick={() => selected > 0 && onRate(selected)}
          disabled={selected === 0}
          className="w-full py-2.5 rounded-xl bg-[#c8956c] hover:bg-[#b07d58] disabled:opacity-40 text-white font-semibold transition-colors"
        >
          à¸ªà¹ˆà¸‡à¸„à¸°à¹à¸™à¸™
        </button>
        <button onClick={() => onRate(0)} className="text-xs text-[#9c7c5e] hover:text-[#7c5c3e]">à¸‚à¹‰à¸²à¸¡à¹„à¸›à¸à¹ˆà¸­à¸™</button>
      </motion.div>
    </div>
  );
}

// â”€â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  const { topicId, topicName, alias, avatar } = (location.state as any) ?? {};

  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [matchStatus, setMatchStatus] = useState<'waiting' | 'matched' | 'ended'>('waiting');
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [bannedWords, setBannedWords] = useState<string[]>([]);
  const [showRating, setShowRating] = useState(false);
  // Banned word warning toast
  const [bannedWarning, setBannedWarning] = useState<string | null>(null);
  // Profiles from DB
  const [profiles, setProfiles] = useState<ChatProfile[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // â”€â”€ Redirect guard â”€â”€
  useEffect(() => {
    if (!user || !topicId || !alias) navigate('/secret-chat');
  }, [user, topicId, alias, navigate]);

  // â”€â”€ Load banned words + profiles â”€â”€
  useEffect(() => {
    loadBannedWords().then(setBannedWords);
    supabase.from('chat_profiles').select('id, name, image_url').eq('is_active', true).order('sort_order')
      .then(({ data }) => setProfiles(data ?? []));
  }, []);

  // â”€â”€ Scroll to bottom â”€â”€
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // â”€â”€ Session expiry handler â”€â”€
  const handleExpire = useCallback(async () => {
    if (!session) return;
    await supabase.from('chat_sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', session.id);
    setMatchStatus('ended');
    setShowRating(true);
  }, [session]);

  // â”€â”€ Countdown (only active when matched) â”€â”€
  const { remaining, display: countdownDisplay } = useCountdown(
    SESSION_DURATION,
    matchStatus === 'matched',
    handleExpire,
  );
  const isUrgent = remaining <= 60 && remaining > 0;

  // â”€â”€ Matchmaking â”€â”€
  useEffect(() => {
    if (!user || !topicId || matchStatus !== 'waiting') return;

    const tryMatch = async () => {
      const { data: queue } = await supabase
        .from('chat_queue').select('*')
        .eq('topic_id', topicId).neq('user_id', user.id)
        .order('joined_at', { ascending: true }).limit(1);

      if (!queue || queue.length === 0) return;
      const partner = queue[0];

      const { data: sess, error } = await supabase.from('chat_sessions').insert({
        topic_id: topicId,
        user_a_id: user.id, user_b_id: partner.user_id,
        user_a_alias: alias, user_b_alias: partner.alias,
        user_a_avatar: avatar, user_b_avatar: partner.avatar,
        duration_seconds: SESSION_DURATION,
      }).select().single();

      if (error || !sess) return;

      await Promise.all([
        supabase.from('chat_queue').delete().eq('user_id', user.id),
        supabase.from('chat_queue').delete().eq('user_id', partner.user_id),
      ]);
      setSession(sess);
      setMatchStatus('matched');
    };

    const interval = setInterval(tryMatch, 2000);

    const queueChannel = supabase.channel(`queue-watch-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_sessions', filter: `user_b_id=eq.${user.id}` },
        async (payload) => {
          await supabase.from('chat_queue').delete().eq('user_id', user.id);
          setSession(payload.new as ChatSession);
          setMatchStatus('matched');
        })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(queueChannel);
      supabase.from('chat_queue').delete().eq('user_id', user.id);
    };
  }, [user, topicId, alias, avatar, matchStatus]);

  // â”€â”€ Realtime: messages + session updates + typing â”€â”€
  useEffect(() => {
    if (!session || !user) return;

    supabase.from('chat_messages').select('*').eq('session_id', session.id).order('created_at')
      .then(({ data }) => setMessages(data ?? []));

    const ch = supabase.channel(`chat-room-${session.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `session_id=eq.${session.id}` },
        (payload) => setMessages(prev => [...prev, payload.new as Message]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_sessions', filter: `id=eq.${session.id}` },
        (payload) => {
          const updated = payload.new as ChatSession;
          setSession(updated);
          if (updated.status === 'ended') { setMatchStatus('ended'); setShowRating(true); }
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

  // â”€â”€ Send message â”€â”€
  const sendMessage = useCallback(async () => {
    if (!input.trim() || !session || !user || sending) return;

    const foundWord = findBannedWord(input, bannedWords);
    if (foundWord) {
      // Log violation
      await supabase.from('chat_violations').insert({
        session_id: session.id,
        user_id: user.id,
        word: foundWord,
        message: input.trim(),
      });
      // Show warning to user
      setBannedWarning(foundWord);
      setTimeout(() => setBannedWarning(null), 4000);
      setInput('');
      return;
    }

    setSending(true);
    const content = input.trim();
    setInput('');
    const { error } = await supabase.from('chat_messages').insert({ session_id: session.id, sender_id: user.id, content });
    if (error) console.error('Send error:', error);
    setSending(false);
  }, [input, session, user, sending, bannedWords]);

  // â”€â”€ Typing broadcast â”€â”€
  const handleInputChange = useCallback((val: string) => {
    setInput(val);
    if (channelRef.current && session) {
      channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { user_id: user?.id } });
    }
  }, [session, user?.id]);

  // â”€â”€ Leave table â”€â”€
  const leaveTable = useCallback(async () => {
    if (session) {
      await supabase.from('chat_sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', session.id);
    } else {
      await supabase.from('chat_queue').delete().eq('user_id', user?.id);
    }
    setMatchStatus('ended');
    setShowRating(true);
  }, [session, user?.id]);

  // â”€â”€ Submit rating â”€â”€
  const submitRating = useCallback(async (stars: number) => {
    setShowRating(false);
    if (stars > 0 && session && user) {
      const partnerId = session.user_a_id === user.id ? session.user_b_id : session.user_a_id;
      await supabase.from('chat_ratings').insert({ session_id: session.id, rater_id: user.id, rated_id: partnerId, stars });
    }
    navigate('/');
  }, [session, user, navigate]);

  // â”€â”€ Helpers â”€â”€
  const myAlias = session ? (session.user_a_id === user?.id ? session.user_a_alias : session.user_b_alias) : alias;
  const partnerAlias = session ? (session.user_a_id === user?.id ? session.user_b_alias : session.user_a_alias) : '...';
  const partnerAvatarKey = session ? (session.user_a_id === user?.id ? session.user_b_avatar : session.user_a_avatar) : '';

  // Resolve avatar image from profiles list (key = profile id or fallback emoji)
  const getAvatarImg = (key: string) => profiles.find(p => p.id === key)?.image_url ?? null;
  const partnerImg = getAvatarImg(partnerAvatarKey);
  const myImg = getAvatarImg(avatar);

  const isMyMessage = (msg: Message) => msg.sender_id === user?.id;

  return (
    <div className="fixed inset-0 flex flex-col bg-[#faf6f1] dark:bg-[#1a1410]">
      <audio ref={bgmRef} loop src="" />

      {/* â”€â”€ Banned word warning toast â”€â”€ */}
      <AnimatePresence>
        {bannedWarning && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-red-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡à¸–à¸¹à¸à¸šà¸¥à¹‡à¸­à¸ â€” à¸žà¸šà¸„à¸³à¸•à¹‰à¸­à¸‡à¸«à¹‰à¸²à¸¡
          </motion.div>
        )}
      </AnimatePresence>

      {/* â”€â”€ Header â”€â”€ */}
      <header className="shrink-0 bg-[#faf6f1]/95 dark:bg-[#1a1410]/95 backdrop-blur-md border-b border-[#e8d9c8] dark:border-[#3a2a1e] px-4 py-3 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          {matchStatus === 'matched' && session ? (
            <>
              <div className="w-9 h-9 rounded-full bg-[#f0e6d8] dark:bg-[#3a2a1e] overflow-hidden flex items-center justify-center">
                {partnerImg
                  ? <img src={partnerImg} alt={partnerAlias} className="w-full h-full object-cover" />
                  : <span className="text-xl">ðŸ»</span>}
              </div>
              <div>
                <p className="font-semibold text-[#4a3728] dark:text-[#e8d9c8] text-sm leading-tight">{partnerAlias}</p>
                <p className="text-xs text-[#9c7c5e]">{topicName}</p>
              </div>
            </>
          ) : (
            <div>
              <p className="font-semibold text-[#4a3728] dark:text-[#e8d9c8] text-sm">Secret Table</p>
              <p className="text-xs text-[#9c7c5e]">{topicName}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Countdown */}
          {matchStatus === 'matched' && (
            <div className={`flex items-center gap-1 text-xs font-mono font-semibold px-2.5 py-1 rounded-full border transition-colors ${
              isUrgent
                ? 'bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 border-red-300 dark:border-red-800 animate-pulse'
                : 'bg-[#f0e6d8] dark:bg-[#3a2a1e] text-[#7c5c3e] dark:text-[#c8956c] border-[#e8d9c8] dark:border-[#4a3728]'
            }`}>
              <Clock className="w-3 h-3" />
              {countdownDisplay}
            </div>
          )}

          {/* Rain */}
          <button onClick={toggleRain} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border ${rainOn ? 'bg-sky-100 text-sky-500 border-sky-200' : 'bg-transparent text-[#9c7c5e] border-[#e8d9c8] hover:border-[#c8956c]'}`}>
            <CloudRain className="w-3.5 h-3.5" />
          </button>

          {/* BGM */}
          <button onClick={toggleBgm} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border ${bgmOn ? 'bg-violet-100 text-violet-500 border-violet-200' : 'bg-transparent text-[#9c7c5e] border-[#e8d9c8] hover:border-[#c8956c]'}`}>
            {bgmOn ? <Music2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          {/* Leave */}
          <button onClick={leaveTable} className="w-8 h-8 rounded-full flex items-center justify-center text-[#9c7c5e] hover:text-red-500 border border-[#e8d9c8] hover:border-red-300 transition-all" title="à¸­à¸­à¸à¸ˆà¸²à¸à¹‚à¸•à¹Šà¸°">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* â”€â”€ Messages area â”€â”€ */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {matchStatus === 'waiting' && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}
              className="w-16 h-16 rounded-full bg-[#f0e6d8] dark:bg-[#3a2a1e] flex items-center justify-center text-3xl">
              â˜•
            </motion.div>
            <div>
              <p className="font-semibold text-[#4a3728] dark:text-[#e8d9c8]">à¸à¸³à¸¥à¸±à¸‡à¸«à¸²à¸„à¸¹à¹ˆà¸ªà¸™à¸—à¸™à¸²...</p>
              <p className="text-sm text-[#9c7c5e] mt-1">à¸£à¸­à¸ªà¸±à¸à¸„à¸£à¸¹à¹ˆ à¸à¸³à¸¥à¸±à¸‡à¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¹ƒà¸™à¸«à¸±à¸§à¸‚à¹‰à¸­ {topicName}</p>
            </div>
            <Loader2 className="w-5 h-5 animate-spin text-[#9c7c5e]" />
          </div>
        )}

        {matchStatus === 'matched' && messages.length === 0 && (
          <div className="text-center py-4">
            <span className="text-xs text-[#9c7c5e] bg-[#f0e6d8] dark:bg-[#3a2a1e] px-3 py-1.5 rounded-full">
              à¸ˆà¸±à¸šà¸„à¸¹à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ â€” à¸¡à¸µà¹€à¸§à¸¥à¸² {Math.floor(SESSION_DURATION / 60)} à¸™à¸²à¸—à¸µ à¹€à¸£à¸´à¹ˆà¸¡à¸ªà¸™à¸—à¸™à¸²à¹„à¸”à¹‰à¹€à¸¥à¸¢
            </span>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={`flex gap-2 ${isMyMessage(msg) ? 'flex-row-reverse' : 'flex-row'}`}>
              {!isMyMessage(msg) && (
                <div className="w-8 h-8 rounded-full bg-[#f0e6d8] dark:bg-[#3a2a1e] overflow-hidden flex items-center justify-center shrink-0 self-end">
                  {partnerImg ? <img src={partnerImg} alt="" className="w-full h-full object-cover" /> : <span className="text-base">ðŸ»</span>}
                </div>
              )}
              <div className={`max-w-[72%] space-y-0.5 ${isMyMessage(msg) ? 'items-end' : 'items-start'} flex flex-col`}>
                <span className="text-[10px] text-[#9c7c5e] px-1">{isMyMessage(msg) ? myAlias : partnerAlias}</span>
                <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-2 items-end">
            <div className="w-8 h-8 rounded-full bg-[#f0e6d8] dark:bg-[#3a2a1e] overflow-hidden flex items-center justify-center shrink-0">
              {partnerImg ? <img src={partnerImg} alt="" className="w-full h-full object-cover" /> : <span className="text-base">ðŸ»</span>}
            </div>
            <div className="bg-white dark:bg-[#2a1e14] border border-[#e8d9c8] dark:border-[#3a2a1e] rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
              {[0, 0.15, 0.3].map((delay, i) => (
                <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-[#9c7c5e]"
                  animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay }} />
              ))}
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* â”€â”€ Input bar â”€â”€ */}
      {matchStatus === 'matched' && (
        <div className="shrink-0 bg-[#faf6f1]/95 dark:bg-[#1a1410]/95 backdrop-blur-md border-t border-[#e8d9c8] dark:border-[#3a2a1e] px-4 py-3">
          <div className="flex gap-2 items-end max-w-2xl mx-auto">
            <div className="flex-1 bg-white dark:bg-[#221810] border border-[#e8d9c8] dark:border-[#3a2a1e] rounded-2xl px-4 py-2.5 focus-within:border-[#c8956c] transition-colors">
              <textarea
                value={input}
                onChange={e => handleInputChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="à¸žà¸´à¸¡à¸žà¹Œà¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡..."
                rows={1}
                className="w-full bg-transparent text-sm text-[#4a3728] dark:text-[#e8d9c8] placeholder:text-[#c8b09a] resize-none outline-none leading-relaxed"
                style={{ maxHeight: 100 }}
              />
            </div>
            <button onClick={sendMessage} disabled={!input.trim() || sending}
              className="w-10 h-10 rounded-full bg-[#c8956c] hover:bg-[#b07d58] disabled:opacity-40 flex items-center justify-center text-white transition-all shrink-0">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {showRating && <RatingDialog onRate={submitRating} />}
    </div>
  );
}

