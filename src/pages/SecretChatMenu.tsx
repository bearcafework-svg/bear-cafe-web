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
  { key: 'talk',   label: 'Talk',   sub: 'อยากเล่า ระบาย หรือแชร์เรื่องราว', icon: '💬' },
  { key: 'listen', label: 'Listen', sub: 'อยากฟัง รับฟัง และให้กำลังใจ',      icon: '👂' },
  { key: 'both',   label: 'Both',   sub: 'คุยได้ทั้งสองฝ่าย ยืดหยุ่น',        icon: '🤝' },
  { key: 'chill',  label: 'Chill',  sub: 'ชิล ๆ ไม่จริงจัง แค่อยากคุย',       icon: '☕' },
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
  heal:            { bg: 'from-rose-100 via-pink-50 to-rose-50 dark:from-rose-950/50 dark:via-pink-950/30 dark:to-rose-950/20',       card: 'bg-white/80 dark:bg-rose-950/20',   accent: '#e879a0', pill: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300' },
  casual:          { bg: 'from-amber-100 via-orange-50 to-amber-50 dark:from-amber-950/50 dark:via-orange-950/30 dark:to-amber-950/20', card: 'bg-white/80 dark:bg-amber-950/20',  accent: '#f59e0b', pill: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300' },
  'deep talk':     { bg: 'from-violet-100 via-purple-50 to-violet-50 dark:from-violet-950/50 dark:via-purple-950/30 dark:to-violet-950/20', card: 'bg-white/80 dark:bg-violet-950/20', accent: '#8b5cf6', pill: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300' },
  'open mind':     { bg: 'from-sky-100 via-cyan-50 to-sky-50 dark:from-sky-950/50 dark:via-cyan-950/30 dark:to-sky-950/20',             card: 'bg-white/80 dark:bg-sky-950/20',    accent: '#0ea5e9', pill: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300' },
  'same interest': { bg: 'from-emerald-100 via-teal-50 to-emerald-50 dark:from-emerald-950/50 dark:via-teal-950/30 dark:to-emerald-950/20', card: 'bg-white/80 dark:bg-emerald-950/20', accent: '#10b981', pill: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300' },
};

const DEFAULT_THEME = {
  bg: 'from-[#fdf8f3] via-[#f9f0e8] to-[#f5ede4] dark:from-[#1a1410] dark:via-[#1e1812] dark:to-[#221810]',
  card: 'bg-white/80 dark:bg-[#2a1e14]/60',
  accent: '#c8956c',
  pill: 'bg-[#f0e6d8] text-[#7c5c3e] dark:bg-[#3a2a1e] dark:text-[#c8956c]',
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
      <header className="sticky top-0 z-30 bg-white/60 dark:bg-black/30 backdrop-blur-xl border-b border-white/30 dark:border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost" size="icon"
            onClick={() => step === 'role' ? setStep('category') : navigate('/')}
            className="rounded-xl w-8 h-8 text-[#7c5c3e] hover:bg-white/50 dark:hover:bg-white/10 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${theme.accent}25` }}>
              <Coffee className="w-4.5 h-4.5" style={{ color: theme.accent }} />
            </div>
            <div>
              <h1 className="font-bold text-[#4a3728] dark:text-[#e8d9c8] text-base leading-tight">คาเฟ่ลับ</h1>
              <p className="text-[11px] text-[#9c7c5e]">
                {step === 'category' ? 'เลือกหมวดสนทนา' : `${selectedCategory?.name} · เลือกบทบาท`}
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
            className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-[#7c5c3e] hover:bg-white/50 dark:hover:bg-white/10 transition-colors"
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
                  className="w-20 h-20 rounded-3xl bg-white/70 dark:bg-white/10 backdrop-blur-sm border border-white/60 dark:border-white/10 flex items-center justify-center text-4xl mx-auto shadow-lg"
                >
                  ☕
                </motion.div>
                <div>
                  <p className="text-xs font-semibold tracking-widest uppercase text-[#c8956c]/80 dark:text-[#c8956c]/60 mb-1">
                    คาเฟ่ลับเปิดใจ
                  </p>
                  <h2 className="font-bold text-[#4a3728] dark:text-[#e8d9c8] text-2xl">เลือกหมวดสนทนา</h2>
                  <p className="text-sm text-[#9c7c5e] mt-1.5 leading-relaxed max-w-sm mx-auto">
                    พื้นที่พูดคุยแบบไม่เปิดเผยตัวตน คุยได้อย่างสบายใจในแบบของคุณ
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-[#7c5c3e] dark:text-[#c8956c] mb-3">
                  วันนี้อยากคุยเรื่องอะไร?
                </p>

                {loading ? (
                  <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-[#9c7c5e]" /></div>
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
                          className="group w-full text-left rounded-2xl border border-white/60 dark:border-white/10 p-5 transition-all bg-white/70 dark:bg-black/20 backdrop-blur-sm hover:bg-white/90 dark:hover:bg-black/30 shadow-sm hover:shadow-lg"
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
                              <p className="font-bold text-[#4a3728] dark:text-[#e8d9c8] text-lg">{cat.name}</p>
                              {cat.description && (
                                <p className="text-sm text-[#9c7c5e] mt-1 leading-relaxed line-clamp-2">{cat.description}</p>
                              )}
                            </div>
                            <ChevronRight className="w-4 h-4 text-[#c8b09a] dark:text-[#5a4030] shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" />
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
                <p className="text-xs font-semibold tracking-widest uppercase text-[#c8956c]/80 dark:text-[#c8956c]/60">
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
                <p className="text-sm font-semibold text-[#7c5c3e] dark:text-[#c8956c] mb-3">
                  คุณอยากเป็นฝ่ายไหนในการสนทนา?
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
                          active ? 'shadow-lg' : 'border-white/40 dark:border-white/10 bg-white/50 dark:bg-black/10 hover:bg-white/70 dark:hover:bg-black/20'
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
                            <p className="font-bold text-[#4a3728] dark:text-[#e8d9c8] text-base">{r.label}</p>
                            <p className="text-xs text-[#9c7c5e] mt-0.5 leading-relaxed">{r.sub}</p>
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
                  <p className="text-xs font-semibold text-[#9c7c5e] uppercase tracking-wider mb-2">ชื่อสมมติ</p>
                  <div className="flex items-center gap-3 bg-white/70 dark:bg-black/20 backdrop-blur-sm rounded-2xl px-4 py-3.5 border border-white/50 dark:border-white/10 shadow-sm">
                    {rollingAlias ? (
                      <Loader2 className="w-5 h-5 animate-spin text-[#9c7c5e] mx-auto" />
                    ) : (
                      <span className="font-bold text-[#4a3728] dark:text-[#e8d9c8] flex-1 text-lg">{alias}</span>
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
                    <p className="text-xs font-semibold text-[#9c7c5e] uppercase tracking-wider mb-3">รูปโปรไฟล์</p>
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
                                style={{ color: active ? theme.accent : '#9c7c5e' }}
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
                  className="bg-white/80 dark:bg-black/25 backdrop-blur-sm rounded-2xl border border-white/60 dark:border-white/10 p-4 flex items-center gap-4 shadow-sm"
                >
                  <img src={selectedProfile.image_url} alt={selectedProfile.name} className="w-12 h-12 rounded-full object-cover shrink-0 ring-2 ring-white shadow-sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#4a3728] dark:text-[#e8d9c8] text-base truncate">{alias || '...'}</p>
                    <p className="text-xs text-[#9c7c5e] mt-0.5">
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

              <p className="text-center text-xs text-[#9c7c5e]">ตัวตนจริงของคุณจะถูกเก็บเป็นความลับ</p>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
