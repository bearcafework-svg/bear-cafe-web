import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, Loader2, Coffee, ChevronRight, Sun, Moon } from 'lucide-react';

interface ChatCategory {
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

type ChatRole = 'talk' | 'listen' | 'both' | 'chill';

const ROLE_FALLBACK: { key: ChatRole; label: string; sub: string; icon: string }[] = [
  { key: 'talk',   label: 'Talk',   sub: 'อยากเล่า ระบาย หรือแชร์เรื่องในใจ', icon: '💬' },
  { key: 'listen', label: 'Listen', sub: 'อยากฟัง ให้กำลังใจ อยู่เป็นเพื่อน',  icon: '👂' },
  { key: 'both',   label: 'Both',   sub: 'คุยได้ทั้งสองทาง ไม่ยึดติด',         icon: '🤝' },
  { key: 'chill',  label: 'Chill',  sub: 'ชิล ๆ ไม่จริงจัง แค่อยากคุยเล่น',   icon: '☕' },
];

const ROLE_ICONS: Record<string, string> = { talk: '💬', listen: '👂', both: '🤝', chill: '☕' };

interface DBRole {
  id: string;
  key: ChatRole;
  label: string;
  sub: string;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
}

const CATEGORY_THEMES: Record<string, { bg: string; card: string; accent: string; pill: string }> = {
  heal:            { bg: 'from-rose-100 via-pink-50 to-[hsl(var(--background))] dark:from-rose-950/30 dark:via-[hsl(var(--background))] dark:to-[hsl(var(--background))]',       card: 'bg-[hsl(var(--card))]',   accent: '#e879a0', pill: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300' },
  casual:          { bg: 'from-amber-100 via-orange-50 to-[hsl(var(--background))] dark:from-amber-950/30 dark:via-[hsl(var(--background))] dark:to-[hsl(var(--background))]', card: 'bg-[hsl(var(--card))]',  accent: '#f59e0b', pill: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300' },
  'deep talk':     { bg: 'from-violet-100 via-purple-50 to-[hsl(var(--background))] dark:from-violet-950/30 dark:via-[hsl(var(--background))] dark:to-[hsl(var(--background))]', card: 'bg-[hsl(var(--card))]', accent: '#8b5cf6', pill: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300' },
  'open mind':     { bg: 'from-sky-100 via-cyan-50 to-[hsl(var(--background))] dark:from-sky-950/30 dark:via-[hsl(var(--background))] dark:to-[hsl(var(--background))]',             card: 'bg-[hsl(var(--card))]',    accent: '#0ea5e9', pill: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300' },
  'same interest': { bg: 'from-emerald-100 via-teal-50 to-[hsl(var(--background))] dark:from-emerald-950/30 dark:via-[hsl(var(--background))] dark:to-[hsl(var(--background))]', card: 'bg-[hsl(var(--card))]', accent: '#10b981', pill: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300' },
};

const DEFAULT_THEME = {
  bg: 'from-[hsl(var(--cream))] via-[hsl(var(--latte)/0.4)] to-[hsl(var(--background))] dark:from-[hsl(var(--mocha))] dark:via-[hsl(var(--background))] dark:to-[hsl(var(--background))]',
  card: 'bg-[hsl(var(--card))]',
  accent: 'hsl(var(--honey))',
  pill: 'bg-[hsl(var(--latte))] text-[hsl(var(--bear-brown))] dark:bg-[hsl(var(--coffee))] dark:text-[hsl(var(--honey))]',
};

function getTheme(name: string) {
  return CATEGORY_THEMES[name.toLowerCase()] ?? DEFAULT_THEME;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function generateAlias(): Promise<string> {
  const [{ data: prefixes }, { data: menus }] = await Promise.all([
    (supabase as any).from('chat_name_prefixes').select('word'),
    (supabase as any).from('chat_name_menus').select('word'),
  ]);
  const pList = (prefixes as any[]) ?? [];
  const mList = (menus as any[]) ?? [];
  const prefix = pList.length > 0 ? pickRandom(pList).word : 'นุ่มนิ่ม';
  const menu   = mList.length > 0 ? pickRandom(mList).word : 'ลาเต้';
  return `${prefix}${menu}`;
}

export default function SecretChatMenu() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { theme: colorTheme, setTheme: setColorTheme } = useTheme();

  const [categories, setCategories] = useState<ChatCategory[]>([]);
  const [profiles, setProfiles] = useState<ChatProfile[]>([]);
  const [dbRoles, setDbRoles] = useState<DBRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [queueCount, setQueueCount] = useState(0); // จำนวนคนรอแบบ realtime

  const [step, setStep] = useState<'category' | 'role'>('category');
  const [selectedCategory, setSelectedCategory] = useState<ChatCategory | null>(null);
  const [selectedRole, setSelectedRole] = useState<ChatRole>('both');
  const [alias, setAlias] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<ChatProfile | null>(null);
  const [rollingAlias, setRollingAlias] = useState(false);
  const [entering, setEntering] = useState(false);

  const theme = selectedCategory ? getTheme(selectedCategory.name) : DEFAULT_THEME;
  const roles = dbRoles.length > 0 ? dbRoles : ROLE_FALLBACK;

  useEffect(() => {
    Promise.all([
      (supabase as any).from('chat_topics').select('id, name, description, image_url').eq('is_active', true).order('sort_order'),
      (supabase as any).from('chat_profiles').select('id, name, image_url').eq('is_active', true).order('sort_order'),
      (supabase as any).from('chat_roles').select('*').eq('is_active', true).order('sort_order'),
    ]).then(([catRes, profRes, rolesRes]: any[]) => {
      setCategories(catRes.data ?? []);
      const profs: ChatProfile[] = profRes.data ?? [];
      setProfiles(profs);
      if (profs.length > 0) setSelectedProfile(profs[0]);
      setDbRoles(rolesRes.data ?? []);
      setLoading(false);
    });
  }, []);

  // ── Queue count realtime ──────────────────────────────────────────────────
  useEffect(() => {
    const STALE_MS = 45 * 1000;

    const fetchCount = async () => {
      const cutoff = new Date(Date.now() - STALE_MS).toISOString();
      const { count } = await (supabase as any)
        .from('chat_queue')
        .select('*', { count: 'exact', head: true })
        .gte('joined_at', cutoff);
      setQueueCount(count ?? 0);
    };

    fetchCount();
    (supabase as any).rpc('cleanup_stale_queue').then(fetchCount);
    const countInterval = setInterval(() => {
      (supabase as any).rpc('cleanup_stale_queue').then(fetchCount);
    }, 15000);

    // Subscribe realtime — อัปเดตทุกครั้งที่มีคนเข้า/ออก queue
    const ch = supabase
      .channel('queue-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_queue' }, fetchCount)
      .subscribe();

    return () => {
      clearInterval(countInterval);
      supabase.removeChannel(ch);
    };
  }, []);

  useEffect(() => {
    if (step === 'role' && !alias) rollAlias();
  }, [step]);

  const rollAlias = useCallback(async () => {
    setRollingAlias(true);
    const a = await generateAlias();
    setAlias(a);
    if (profiles.length > 0) setSelectedProfile(pickRandom(profiles));
    setRollingAlias(false);
  }, [profiles]);

  const enterQueue = useCallback(async () => {
    if (!user) { navigate('/login'); return; }
    if (!selectedCategory || !alias || !selectedProfile) return;
    setEntering(true);
    try {
      await (supabase as any).from('chat_queue').delete().eq('user_id', user.id);
      const { error } = await (supabase as any).from('chat_queue').insert({
        user_id: user.id,
        topic_id: selectedCategory.id,
        alias,
        avatar: selectedProfile.id,
        role: selectedRole,
      });
      if (error) throw error;
      navigate('/secret-chat/room', {
        state: { topicId: selectedCategory.id, topicName: selectedCategory.name, alias, avatar: selectedProfile.id, role: selectedRole },
      });
    } catch (e: any) {
      console.error(e);
      setEntering(false);
    }
  }, [user, selectedCategory, alias, selectedProfile, selectedRole, navigate]);

  return (
    <div className={`min-h-screen bg-gradient-to-br transition-all duration-700 secret-menu-zoom ${theme.bg}`}>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[hsl(var(--cream)/0.85)] dark:bg-[hsl(var(--mocha)/0.85)] backdrop-blur-xl border-b border-[hsl(var(--latte)/0.5)] dark:border-[hsl(var(--coffee)/0.4)]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost" size="icon"
            onClick={() => step === 'role' ? setStep('category') : navigate('/')}
            className="rounded-xl w-8 h-8 text-foreground hover:bg-[hsl(var(--latte)/0.5)] dark:hover:bg-[hsl(var(--coffee)/0.3)] shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${theme.accent}25` }}>
              <Coffee className="w-4.5 h-4.5" style={{ color: theme.accent }} />
            </div>
            <div>
              <h1 className="font-bold text-foreground text-base leading-tight">คาเฟ่ลับ</h1>
              <p className="text-[11px] text-muted-foreground">
                {step === 'category' ? 'เลือกหมวด' : `${selectedCategory?.name} · เลือกบทบาท`}
              </p>
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1.5 shrink-0">
            {(['category', 'role'] as const).map((s) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={`h-2 rounded-full transition-all duration-300 ${step === s ? 'w-6' : 'w-2 opacity-40'}`}
                  style={{ background: theme.accent }} />
              </div>
            ))}
          </div>

          {/* Theme toggle */}
          <button
            onClick={() => setColorTheme(colorTheme === 'dark' ? 'light' : 'dark')}
            className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-foreground hover:bg-[hsl(var(--latte)/0.5)] dark:hover:bg-[hsl(var(--coffee)/0.3)] transition-colors"
            title={colorTheme === 'dark' ? 'โหมดสว่าง' : 'โหมดมืด'}
          >
            {colorTheme === 'dark'
              ? <Sun className="w-4 h-4" />
              : <Moon className="w-4 h-4" />
            }
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 sm:px-8 py-6 pb-12">
        <AnimatePresence mode="wait">

          {/* ── Step 1: Category ── */}
          {step === 'category' && (
            <motion.div key="category" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-4">

              {/* Hero */}
              <div className="text-center space-y-3 pt-4">
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-20 h-20 rounded-3xl bg-[hsl(var(--card)/0.8)] backdrop-blur-sm border border-[hsl(var(--latte)/0.5)] dark:border-[hsl(var(--coffee)/0.3)] flex items-center justify-center text-4xl mx-auto shadow-lg"
                >
                  ☕
                </motion.div>
                <div>
                  <p className="text-xs font-semibold tracking-widest uppercase text-[hsl(var(--honey)/0.7)] mb-1">
                    คาเฟ่ลับเปิดใจ
                  </p>
                  <h2 className="font-bold text-foreground text-2xl">เลือกหมวดสนทนา</h2>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-sm mx-auto">
                    ไม่ต้องเปิดเผยตัวตน คุยได้สบาย ๆ ในแบบที่เป็นตัวเอง
                  </p>
                  {/* Queue counter */}
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[hsl(var(--latte))] dark:bg-[hsl(var(--coffee))] text-[hsl(var(--bear-brown))] dark:text-[hsl(var(--honey))] border border-[hsl(var(--border))]">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-[hsl(var(--primary))]" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--primary))]" />
                      </span>
                      {queueCount > 0
                        ? `☕ ตอนนี้มีคนแวะมาที่ร้าน ${queueCount} คน`
                        : '☕ ตอนนี้ร้านยังเงียบ ๆ'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-[hsl(var(--bear-brown))] dark:text-[hsl(var(--honey))] mb-3">
                  วันนี้อยากคุยเรื่องอะไร?
                </p>

                {loading ? (
                  <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {categories.map((cat, i) => {
                      const t = getTheme(cat.name);
                      return (
                        <motion.button
                          key={cat.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.06 }}
                          whileHover={{ y: -3, scale: 1.01 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => { setSelectedCategory(cat); setStep('role'); }}
                          className="group w-full text-left rounded-2xl border border-[hsl(var(--latte)/0.6)] dark:border-[hsl(var(--coffee)/0.4)] p-5 transition-all bg-[hsl(var(--card)/0.9)] backdrop-blur-sm hover:bg-[hsl(var(--card))] shadow-sm hover:shadow-lg"
                        >
                          <div className="flex items-start gap-4">
                            {cat.image_url ? (
                              <img src={cat.image_url} alt={cat.name} className="w-14 h-14 rounded-2xl object-cover shrink-0 shadow-sm" />
                            ) : (
                              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-sm" style={{ background: `${t.accent}20` }}>
                                ☕
                              </div>
                            )}
                            <div className="flex-1 min-w-0 pt-0.5">
                              <p className="font-bold text-foreground text-lg">{cat.name}</p>
                              {cat.description && (
                                <p className="text-sm text-muted-foreground mt-1 leading-relaxed line-clamp-2">{cat.description}</p>
                              )}
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Role + Identity ── */}
          {step === 'role' && selectedCategory && (
            <motion.div key="role" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-6">

              {/* Hero label */}
              <div className="text-center pt-4 space-y-1">
                <p className="text-xs font-semibold tracking-widest uppercase text-[hsl(var(--honey)/0.7)]">
                  คาเฟ่ลับเปิดใจ · เลือกบทบาท
                </p>
              </div>

              {/* Category pill */}
              <div className="flex justify-center">
                <span className={`inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full shadow-sm ${theme.pill}`}>
                  {selectedCategory.image_url
                    ? <img src={selectedCategory.image_url} className="w-5 h-5 rounded-md object-cover" alt="" />
                    : '☕'}
                  {selectedCategory.name}
                </span>
              </div>

              {/* Role selection */}
              <div>
                <p className="text-sm font-semibold text-[hsl(var(--bear-brown))] dark:text-[hsl(var(--honey))] mb-3">
                  วันนี้อยากเป็นฝ่ายไหนในการสนทนา?
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {roles.map(r => {
                    const active = selectedRole === r.key;
                    return (
                      <motion.button
                        key={r.key}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setSelectedRole(r.key)}
                        className={`rounded-2xl border-2 p-4 text-left transition-all backdrop-blur-sm ${
                          active ? 'shadow-lg' : 'border-[hsl(var(--latte)/0.5)] dark:border-[hsl(var(--coffee)/0.4)] bg-[hsl(var(--card)/0.6)] hover:bg-[hsl(var(--card)/0.85)]'
                        }`}
                        style={active ? {
                          borderColor: theme.accent,
                          background: `${theme.accent}12`,
                          boxShadow: `0 4px 20px ${theme.accent}25`,
                        } : {}}
                      >
                        <div className="flex flex-col gap-2.5">
                          {r.image_url ? (
                            <img src={r.image_url} alt={r.label} className="w-10 h-10 rounded-xl object-cover" />
                          ) : (
                            <span className="text-2xl">{ROLE_ICONS[r.key] ?? '💬'}</span>
                          )}
                          <div>
                            <p className="font-bold text-foreground text-base">{r.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{r.sub}</p>
                          </div>
                        </div>
                        {active && (
                          <div className="mt-2 flex justify-end">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: theme.accent }}>
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Alias + Profile row */}
              <div className="space-y-4">
                {/* Alias */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">ชื่อสมมติ</p>
                  <div className="flex items-center gap-3 bg-[hsl(var(--card)/0.8)] backdrop-blur-sm rounded-2xl px-4 py-3.5 border border-[hsl(var(--latte)/0.5)] dark:border-[hsl(var(--coffee)/0.4)] shadow-sm">
                    {rollingAlias ? (
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
                    ) : (
                      <span className="font-bold text-foreground flex-1 text-lg">{alias}</span>
                    )}
                    <button
                      onClick={rollAlias}
                      disabled={rollingAlias}
                      className="w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0"
                      style={{ background: `${theme.accent}20`, color: theme.accent }}
                      title="สุ่มใหม่"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Profile — game-style horizontal scroll selector */}
                {profiles.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">รูปโปรไฟล์</p>
                    <div className="relative">
                      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        {profiles.map(p => {
                          const active = selectedProfile?.id === p.id;
                          return (
                            <motion.button
                              key={p.id}
                              onClick={() => setSelectedProfile(p)}
                              whileTap={{ scale: 0.93 }}
                              className="flex flex-col items-center gap-2 shrink-0 snap-center"
                              style={{ width: 80 }}
                            >
                              <div
                                className="relative w-16 h-16 rounded-2xl overflow-hidden transition-all duration-200"
                                style={{
                                  border: active ? `3px solid ${theme.accent}` : '3px solid transparent',
                                  boxShadow: active ? `0 0 0 3px ${theme.accent}40, 0 8px 20px ${theme.accent}30` : '0 2px 8px rgba(0,0,0,0.1)',
                                  transform: active ? 'scale(1.08)' : 'scale(1)',
                                }}
                              >
                                <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                                {active && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="absolute bottom-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                                    style={{ background: theme.accent }}
                                  >
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </motion.div>
                                )}
                              </div>
                              <span
                                className="text-[11px] leading-tight text-center w-full font-medium break-words"
                                style={{ color: active ? theme.accent : 'hsl(var(--muted-foreground))' }}
                              >
                                {p.name}
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>
                      {profiles.length > 4 && (
                        <div className="absolute right-0 top-0 bottom-2 w-8 pointer-events-none"
                          style={{ background: `linear-gradient(to right, transparent, ${theme.accent}15)` }} />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Preview card */}
              {selectedProfile && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[hsl(var(--card)/0.85)] backdrop-blur-sm rounded-2xl border border-[hsl(var(--latte)/0.5)] dark:border-[hsl(var(--coffee)/0.4)] p-4 flex items-center gap-4 shadow-sm"
                >
                  <img src={selectedProfile.image_url} alt={selectedProfile.name} className="w-12 h-12 rounded-full object-cover shrink-0 ring-2 ring-white shadow-sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground text-base truncate">{alias || '...'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {roles.find(r => r.key === selectedRole)?.label} · {selectedCategory.name}
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-3 py-1.5 rounded-full shrink-0" style={{ background: `${theme.accent}20`, color: theme.accent }}>
                    พร้อมแล้ว
                  </span>
                </motion.div>
              )}

              {/* CTA */}
              <motion.button
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={enterQueue}
                disabled={entering || !alias || !selectedProfile}
                className="w-full h-14 rounded-2xl text-white font-bold text-base transition-all disabled:opacity-40 shadow-xl flex items-center justify-center gap-2"
                style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent}bb 100%)` }}
              >
                {entering ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> กำลังหาคู่สนทนา...</>
                ) : (
                  <>เข้าคาเฟ่ลับ <ChevronRight className="w-5 h-5" /></>
                )}
              </motion.button>

              <p className="text-center text-xs text-muted-foreground">ตัวตนจริงของคุณจะถูกเก็บเป็นความลับ</p>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
