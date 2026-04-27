import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChatTopic {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
}

interface ChatProfile {
  id: string;
  name: string;
  image_url: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function generateAlias(): Promise<string> {
  const [{ data: prefixes }, { data: menus }] = await Promise.all([
    supabase.from('chat_name_prefixes').select('word'),
    supabase.from('chat_name_menus').select('word'),
  ]);
  const prefix = prefixes && prefixes.length > 0 ? pickRandom(prefixes).word : 'นุ่มนิ่ม';
  const menu   = menus   && menus.length   > 0 ? pickRandom(menus).word   : 'ลาเต้';
  return `${prefix}${menu}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SecretChatMenu() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [topics, setTopics] = useState<ChatTopic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [profiles, setProfiles] = useState<ChatProfile[]>([]);

  const [step, setStep] = useState<'topic' | 'identity'>('topic');
  const [selectedTopic, setSelectedTopic] = useState<ChatTopic | null>(null);

  const [alias, setAlias] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<ChatProfile | null>(null);
  const [rollingAlias, setRollingAlias] = useState(false);
  const [entering, setEntering] = useState(false);

  // ── Fetch topics + profiles ──
  useEffect(() => {
    Promise.all([
      supabase.from('chat_topics').select('id, name, description, image_url').eq('is_active', true).order('sort_order'),
      supabase.from('chat_profiles').select('id, name, image_url').eq('is_active', true).order('sort_order'),
    ]).then(([topicsRes, profilesRes]) => {
      setTopics(topicsRes.data ?? []);
      const profs = profilesRes.data ?? [];
      setProfiles(profs);
      if (profs.length > 0) setSelectedProfile(profs[0]);
      setLoadingTopics(false);
    });
  }, []);

  // ── Generate initial alias when entering identity step ──
  useEffect(() => {
    if (step === 'identity' && !alias) rollAlias();
  }, [step]);

  const rollAlias = useCallback(async () => {
    setRollingAlias(true);
    const [a] = await Promise.all([generateAlias()]);
    setAlias(a);
    if (profiles.length > 0) setSelectedProfile(pickRandom(profiles));
    setRollingAlias(false);
  }, [profiles]);

  // ── Enter matchmaking queue ──
  const enterQueue = useCallback(async () => {
    if (!user || !selectedTopic || !alias || !selectedProfile) return;
    setEntering(true);
    try {
      await supabase.from('chat_queue').delete().eq('user_id', user.id);
      const { error } = await supabase.from('chat_queue').insert({
        user_id: user.id,
        topic_id: selectedTopic.id,
        alias,
        avatar: selectedProfile.id, // store profile id as avatar key
      });
      if (error) throw error;
      navigate('/secret-chat/room', {
        state: { topicId: selectedTopic.id, topicName: selectedTopic.name, alias, avatar: selectedProfile.id },
      });
    } catch (e: any) {
      console.error(e);
      setEntering(false);
    }
  }, [user, selectedTopic, alias, selectedProfile, navigate]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf6f1]">
        <div className="text-center space-y-3">
          <p className="text-[#7c5c3e] font-medium">กรุณาเข้าสู่ระบบก่อนใช้งาน Secret Table</p>
          <Button onClick={() => navigate('/login')} variant="outline">เข้าสู่ระบบ</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf6f1] dark:bg-[#1a1410]">
      <header className="sticky top-0 z-30 bg-[#faf6f1]/90 dark:bg-[#1a1410]/90 backdrop-blur-md border-b border-[#e8d9c8] dark:border-[#3a2a1e] px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon"
          onClick={() => step === 'identity' ? setStep('topic') : navigate('/')}
          className="rounded-xl w-9 h-9 text-[#7c5c3e] hover:bg-[#f0e6d8]">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="font-semibold text-[#4a3728] dark:text-[#e8d9c8] text-base leading-tight">Secret Table</h1>
          <p className="text-xs text-[#9c7c5e] dark:text-[#7c5c3e]">
            {step === 'topic' ? 'เลือกบรรยากาศที่ต้องการ' : 'ตั้งตัวตนสมมติ'}
          </p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        <AnimatePresence mode="wait">

          {/* ── Step 1: Topic ── */}
          {step === 'topic' && (
            <motion.div key="topic" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
              <p className="text-sm text-[#7c5c3e] dark:text-[#9c7c5e] text-center">เลือกบรรยากาศที่อยากพูดคุยวันนี้</p>
              {loadingTopics ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#9c7c5e]" /></div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {topics.map(topic => (
                    <motion.button key={topic.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                      onClick={() => { setSelectedTopic(topic); setStep('identity'); }}
                      className="w-full text-left rounded-2xl border-2 p-4 transition-all border-[#e8d9c8] dark:border-[#3a2a1e] bg-white dark:bg-[#221810] hover:border-[#c8956c]/60">
                      <div className="flex items-center gap-3">
                        {topic.image_url ? (
                          <img src={topic.image_url} alt={topic.name} className="w-12 h-12 rounded-xl object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-[#f0e6d8] dark:bg-[#3a2a1e] flex items-center justify-center text-2xl">☕</div>
                        )}
                        <div>
                          <p className="font-semibold text-[#4a3728] dark:text-[#e8d9c8]">{topic.name}</p>
                          {topic.description && (
                            <p className="text-xs text-[#9c7c5e] dark:text-[#7c5c3e] mt-0.5 leading-relaxed">{topic.description}</p>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Step 2: Identity ── */}
          {step === 'identity' && selectedTopic && (
            <motion.div key="identity" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              {/* Topic badge */}
              <div className="flex justify-center">
                <span className="inline-flex items-center gap-1.5 bg-[#f0e6d8] dark:bg-[#3a2a1e] text-[#7c5c3e] dark:text-[#c8956c] text-sm font-medium px-3 py-1.5 rounded-full">
                  ☕ {selectedTopic.name}
                </span>
              </div>

              {/* Alias */}
              <div className="text-center space-y-2">
                <p className="text-xs text-[#9c7c5e] uppercase tracking-wider">ชื่อสมมติของคุณ</p>
                <div className="flex items-center justify-center gap-3">
                  {rollingAlias
                    ? <Loader2 className="w-5 h-5 animate-spin text-[#9c7c5e]" />
                    : <span className="text-2xl font-bold text-[#4a3728] dark:text-[#e8d9c8]">{alias}</span>}
                  <button onClick={rollAlias} disabled={rollingAlias}
                    className="w-8 h-8 rounded-full bg-[#f0e6d8] dark:bg-[#3a2a1e] flex items-center justify-center text-[#7c5c3e] hover:bg-[#e8d9c8] transition-colors">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Profile selection */}
              <div className="space-y-3">
                <p className="text-xs text-[#9c7c5e] uppercase tracking-wider text-center">เลือกรูปโปรไฟล์</p>
                {profiles.length === 0 ? (
                  <p className="text-center text-sm text-[#9c7c5e]">ยังไม่มีโปรไฟล์ (แอดมินต้องเพิ่มก่อน)</p>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {profiles.map(p => (
                      <button key={p.id} onClick={() => setSelectedProfile(p)}
                        className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                          selectedProfile?.id === p.id
                            ? 'border-[#c8956c] ring-2 ring-[#c8956c] ring-offset-2'
                            : 'border-transparent hover:border-[#c8956c]/40'
                        }`}>
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview */}
              {selectedProfile && (
                <div className="bg-white dark:bg-[#221810] rounded-2xl border border-[#e8d9c8] dark:border-[#3a2a1e] p-4 flex items-center gap-3">
                  <img src={selectedProfile.image_url} alt={selectedProfile.name} className="w-12 h-12 rounded-full object-cover" />
                  <div>
                    <p className="font-semibold text-[#4a3728] dark:text-[#e8d9c8]">{alias || '...'}</p>
                    <p className="text-xs text-[#9c7c5e]">{selectedProfile.name} — ตัวตนสมมติของคุณ</p>
                  </div>
                </div>
              )}

              {/* Re-roll */}
              <div className="flex justify-center">
                <button onClick={rollAlias} disabled={rollingAlias}
                  className="flex items-center gap-2 text-sm text-[#9c7c5e] hover:text-[#7c5c3e] transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" /> สุ่มใหม่ทั้งหมด
                </button>
              </div>

              <Button onClick={enterQueue} disabled={entering || !alias || !selectedProfile}
                className="w-full h-12 bg-[#c8956c] hover:bg-[#b07d58] text-white font-semibold rounded-xl text-base">
                {entering ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> กำลังหาคู่สนทนา...</> : 'นั่งโต๊ะลับ'}
              </Button>

              <p className="text-center text-xs text-[#9c7c5e]">ตัวตนจริงของคุณจะถูกเก็บเป็นความลับ</p>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChatTopic {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
}

// Pixel-art avatar options (using simple emoji/text keys; swap for real assets later)
const AVATARS = [
  { key: 'bear',    label: 'หมี',    emoji: '🐻' },
  { key: 'cat',     label: 'แมว',    emoji: '🐱' },
  { key: 'rabbit',  label: 'กระต่าย', emoji: '🐰' },
  { key: 'cookie',  label: 'คุกกี้',  emoji: '🍪' },
  { key: 'cake',    label: 'เค้ก',   emoji: '🎂' },
  { key: 'donut',   label: 'โดนัท',  emoji: '🍩' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function generateAlias(): Promise<string> {
  const [{ data: prefixes }, { data: menus }] = await Promise.all([
    supabase.from('chat_name_prefixes').select('word'),
    supabase.from('chat_name_menus').select('word'),
  ]);
  const prefix = prefixes && prefixes.length > 0 ? pickRandom(prefixes).word : 'นุ่มนิ่ม';
  const menu   = menus   && menus.length   > 0 ? pickRandom(menus).word   : 'ลาเต้';
  return `${prefix}${menu}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SecretChatMenu() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [topics, setTopics] = useState<ChatTopic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(true);

  // Step: 'topic' | 'identity'
  const [step, setStep] = useState<'topic' | 'identity'>('topic');
  const [selectedTopic, setSelectedTopic] = useState<ChatTopic | null>(null);

  // Identity
  const [alias, setAlias] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0].key);
  const [rollingAlias, setRollingAlias] = useState(false);

  // Entering queue
  const [entering, setEntering] = useState(false);

  // ── Fetch topics ──
  useEffect(() => {
    supabase
      .from('chat_topics')
      .select('id, name, description, image_url')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        setTopics(data ?? []);
        setLoadingTopics(false);
      });
  }, []);

  // ── Generate initial alias ──
  useEffect(() => {
    if (step === 'identity' && !alias) {
      rollAlias();
    }
  }, [step]);

  const rollAlias = useCallback(async () => {
    setRollingAlias(true);
    const a = await generateAlias();
    setAlias(a);
    setAvatar(pickRandom(AVATARS).key);
    setRollingAlias(false);
  }, []);

  // ── Enter matchmaking queue ──
  const enterQueue = useCallback(async () => {
    if (!user || !selectedTopic || !alias) return;
    setEntering(true);
    try {
      // Upsert into queue (remove old entry first)
      await supabase.from('chat_queue').delete().eq('user_id', user.id);
      const { error } = await supabase.from('chat_queue').insert({
        user_id: user.id,
        topic_id: selectedTopic.id,
        alias,
        avatar,
      });
      if (error) throw error;
      navigate('/secret-chat/room', { state: { topicId: selectedTopic.id, topicName: selectedTopic.name, alias, avatar } });
    } catch (e: any) {
      console.error(e);
      setEntering(false);
    }
  }, [user, selectedTopic, alias, avatar, navigate]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf6f1]">
        <div className="text-center space-y-3">
          <p className="text-[#7c5c3e] font-medium">กรุณาเข้าสู่ระบบก่อนใช้งาน Secret Table</p>
          <Button onClick={() => navigate('/login')} variant="outline">เข้าสู่ระบบ</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf6f1] dark:bg-[#1a1410]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#faf6f1]/90 dark:bg-[#1a1410]/90 backdrop-blur-md border-b border-[#e8d9c8] dark:border-[#3a2a1e] px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost" size="icon"
          onClick={() => step === 'identity' ? setStep('topic') : navigate('/')}
          className="rounded-xl w-9 h-9 text-[#7c5c3e] hover:bg-[#f0e6d8]"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="font-semibold text-[#4a3728] dark:text-[#e8d9c8] text-base leading-tight">Secret Table</h1>
          <p className="text-xs text-[#9c7c5e] dark:text-[#7c5c3e]">
            {step === 'topic' ? 'เลือกบรรยากาศที่ต้องการ' : 'ตั้งตัวตนสมมติ'}
          </p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        <AnimatePresence mode="wait">

          {/* ── Step 1: Topic Selection ── */}
          {step === 'topic' && (
            <motion.div
              key="topic"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <p className="text-sm text-[#7c5c3e] dark:text-[#9c7c5e] text-center">
                เลือกบรรยากาศที่อยากพูดคุยวันนี้
              </p>

              {loadingTopics ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-[#9c7c5e]" />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {topics.map(topic => (
                    <motion.button
                      key={topic.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => { setSelectedTopic(topic); setStep('identity'); }}
                      className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${
                        selectedTopic?.id === topic.id
                          ? 'border-[#c8956c] bg-[#f5ede4] dark:bg-[#2a1e14]'
                          : 'border-[#e8d9c8] dark:border-[#3a2a1e] bg-white dark:bg-[#221810] hover:border-[#c8956c]/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {topic.image_url ? (
                          <img src={topic.image_url} alt={topic.name} className="w-12 h-12 rounded-xl object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-[#f0e6d8] dark:bg-[#3a2a1e] flex items-center justify-center text-2xl">
                            ☕
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-[#4a3728] dark:text-[#e8d9c8]">{topic.name}</p>
                          {topic.description && (
                            <p className="text-xs text-[#9c7c5e] dark:text-[#7c5c3e] mt-0.5 leading-relaxed">
                              {topic.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Step 2: Identity Setup ── */}
          {step === 'identity' && selectedTopic && (
            <motion.div
              key="identity"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Topic badge */}
              <div className="flex justify-center">
                <span className="inline-flex items-center gap-1.5 bg-[#f0e6d8] dark:bg-[#3a2a1e] text-[#7c5c3e] dark:text-[#c8956c] text-sm font-medium px-3 py-1.5 rounded-full">
                  ☕ {selectedTopic.name}
                </span>
              </div>

              {/* Alias display */}
              <div className="text-center space-y-2">
                <p className="text-xs text-[#9c7c5e] uppercase tracking-wider">ชื่อสมมติของคุณ</p>
                <div className="flex items-center justify-center gap-3">
                  {rollingAlias ? (
                    <Loader2 className="w-5 h-5 animate-spin text-[#9c7c5e]" />
                  ) : (
                    <span className="text-2xl font-bold text-[#4a3728] dark:text-[#e8d9c8]">{alias}</span>
                  )}
                  <button
                    onClick={rollAlias}
                    disabled={rollingAlias}
                    className="w-8 h-8 rounded-full bg-[#f0e6d8] dark:bg-[#3a2a1e] flex items-center justify-center text-[#7c5c3e] hover:bg-[#e8d9c8] transition-colors"
                    title="สุ่มชื่อใหม่"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Avatar selection */}
              <div className="space-y-3">
                <p className="text-xs text-[#9c7c5e] uppercase tracking-wider text-center">เลือกรูปโปรไฟล์</p>
                <div className="grid grid-cols-6 gap-2">
                  {AVATARS.map(av => (
                    <button
                      key={av.key}
                      onClick={() => setAvatar(av.key)}
                      className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all ${
                        avatar === av.key
                          ? 'bg-[#c8956c] text-white ring-2 ring-[#c8956c] ring-offset-2'
                          : 'bg-[#f0e6d8] dark:bg-[#3a2a1e] text-[#7c5c3e] hover:bg-[#e8d9c8]'
                      }`}
                    >
                      <span className="text-xl">{av.emoji}</span>
                      <span className="text-[9px] font-medium">{av.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview card */}
              <div className="bg-white dark:bg-[#221810] rounded-2xl border border-[#e8d9c8] dark:border-[#3a2a1e] p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#f0e6d8] dark:bg-[#3a2a1e] flex items-center justify-center text-2xl">
                  {AVATARS.find(a => a.key === avatar)?.emoji ?? '🐻'}
                </div>
                <div>
                  <p className="font-semibold text-[#4a3728] dark:text-[#e8d9c8]">{alias || '...'}</p>
                  <p className="text-xs text-[#9c7c5e]">ตัวตนสมมติของคุณในห้องนี้</p>
                </div>
              </div>

              {/* Re-roll all */}
              <div className="flex justify-center">
                <button
                  onClick={rollAlias}
                  disabled={rollingAlias}
                  className="flex items-center gap-2 text-sm text-[#9c7c5e] hover:text-[#7c5c3e] transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  สุ่มใหม่ทั้งหมด
                </button>
              </div>

              {/* Enter button */}
              <Button
                onClick={enterQueue}
                disabled={entering || !alias}
                className="w-full h-12 bg-[#c8956c] hover:bg-[#b07d58] text-white font-semibold rounded-xl text-base"
              >
                {entering ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> กำลังหาคู่สนทนา...</>
                ) : (
                  'นั่งโต๊ะลับ'
                )}
              </Button>

              <p className="text-center text-xs text-[#9c7c5e]">
                ตัวตนจริงของคุณจะถูกเก็บเป็นความลับ
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
