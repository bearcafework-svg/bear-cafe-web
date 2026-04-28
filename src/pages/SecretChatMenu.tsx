import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, Loader2, Coffee } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
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

// ─── Role definitions (fallback if DB empty) ──────────────────────────────────
const ROLE_FALLBACK: { key: ChatRole; label: string; sub: string; icon: string }[] = [
  { key: 'talk',   label: 'Talk',   sub: 'อยากเล่า ระบาย หรือแชร์เรื่องราว',  icon: '💬' },
  { key: 'listen', label: 'Listen', sub: 'อยากฟัง รับฟัง และให้กำลังใจ',       icon: '👂' },
  { key: 'both',   label: 'Both',   sub: 'คุยได้ทั้งสองฝ่าย ยืดหยุ่น',         icon: '🤝' },
  { key: 'chill',  label: 'Chill',  sub: 'ชิล ๆ ไม่จริงจัง แค่อยากคุย',        icon: '☕' },
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

// ─── Category theme colors ────────────────────────────────────────────────────
// Maps category name (lowercase) → bg gradient classes
const CATEGORY_THEMES: Record<string, { bg: string; accent: string; border: string }> = {
  heal:          { bg: 'from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/20',       accent: '#e879a0', border: 'border-rose-200 dark:border-rose-900/50' },
  casual:        { bg: 'from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20', accent: '#f59e0b', border: 'border-amber-200 dark:border-amber-900/50' },
  'deep talk':   { bg: 'from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/20', accent: '#8b5cf6', border: 'border-violet-200 dark:border-violet-900/50' },
  'open mind':   { bg: 'from-sky-50 to-cyan-50 dark:from-sky-950/30 dark:to-cyan-950/20',         accent: '#0ea5e9', border: 'border-sky-200 dark:border-sky-900/50' },
  'same interest': { bg: 'from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20', accent: '#10b981', border: 'border-emerald-200 dark:border-emerald-900/50' },
};

const DEFAULT_THEME = { bg: 'from-[#fdf8f3] to-[#f5ede4] dark:from-[#1a1410] dark:to-[#221810]', accent: '#c8956c', border: 'border-[#e8d9c8] dark:border-[#3a2a1e]' };

function getCategoryTheme(name: string) {
  return CATEGORY_THEMES[name.toLowerCase()] ?? DEFAULT_THEME;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SecretChatMenu() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

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

  const theme = selectedCategory ? getCategoryTheme(selectedCategory.name) : DEFAULT_THEME;

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
    if (!user || !selectedCategory || !alias || !selectedProfile) return;
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
        state: {
          topicId: selectedCategory.id,
          topicName: selectedCategory.name,
          alias,
          avatar: selectedProfile.id,
          role: selectedRole,
        },
      });
    } catch (e: any) {
      console.error(e);
      setEntering(false);
    }
  }, [user, selectedCategory, alias, selectedProfile, selectedRole, navigate]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#fdf8f3] to-[#f5ede4] dark:from-[#1a1410] dark:to-[#221810]">
        <div className="text-center space-y-4 px-6">
          <div className="w-14 h-14 rounded-2xl bg-[#f0e6d8] dark:bg-[#3a2a1e] flex items-center justify-center text-3xl mx-auto">
            ☕
          </div>
          <div>
            <p className="font-semibold text-[#4a3728] dark:text-[#e8d9c8] text-lg">คาเฟ่ลับ</p>
            <p className="text-sm text-[#9c7c5e] mt-1">กรุณาเข้าสู่ระบบก่อนใช้งาน</p>
          </div>
          <Button onClick={() => navigate('/login')} className="bg-[#c8956c] hover:bg-[#b07d58] text-white">
            เข้าสู่ระบบ
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br transition-all duration-500 ${theme.bg}`}>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/70 dark:bg-black/30 backdrop-blur-md border-b border-white/40 dark:border-white/10 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => step === 'role' ? setStep('category') : navigate('/')}
            className="rounded-xl w-9 h-9 text-[#7c5c3e] hover:bg-white/50 dark:hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#c8956c]/20 flex items-center justify-center shrink-0">
              <Coffee className="w-4 h-4 text-[#c8956c]" />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-[#4a3728] dark:text-[#e8d9c8] text-sm leading-tight">คาเฟ่ลับ</h1>
              <p className="text-[10px] text-[#9c7c5e] truncate">
                {step === 'category' ? 'เลือกหมวดสนทนา' : 'เลือกบทบาทของคุณ'}
              </p>
            </div>
          </div>

          {/* Step dots */}
          <div className="flex items-center gap-1.5 shrink-0">
            {(['category', 'role'] as const).map(s => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step === s ? 'w-5 bg-[#c8956c]' : 'w-2 bg-[#c8956c]/30'
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <AnimatePresence mode="wait">

          {/* ── Step 1: Category ── */}
          {step === 'category' && (
            <motion.div
              key="category"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-5"
            >
              {/* Hero section */}
              <div className="text-center space-y-2 pt-2 pb-1">
                <div className="w-16 h-16 rounded-2xl bg-white/60 dark:bg-white/10 backdrop-blur-sm border border-white/50 dark:border-white/10 flex items-center justify-center text-3xl mx-auto shadow-sm">
                  ☕
                </div>
                <div>
                  <h2 className="font-bold text-[#4a3728] dark:text-[#e8d9c8] text-xl">คาเฟ่ลับ</h2>
                  <p className="text-xs text-[#9c7c5e] mt-1 leading-relaxed max-w-xs mx-auto">
                    พื้นที่พูดคุยแบบไม่เปิดเผยตัวตน คุยได้อย่างสบายใจในแบบของคุณ
                  </p>
                </div>
              </div>

              <p className="text-sm font-medium text-[#7c5c3e] dark:text-[#c8956c] text-center">
                วันนี้อยากคุยเรื่องอะไร?
              </p>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-[#9c7c5e]" />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {categories.map((cat, i) => {
                    const t = getCategoryTheme(cat.name);
                    return (
                      <motion.button
                        key={cat.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        whileHover={{ scale: 1.01, y: -1 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => { setSelectedCategory(cat); setStep('role'); }}
                        className={`w-full text-left rounded-2xl border p-4 transition-all bg-white/70 dark:bg-black/20 backdrop-blur-sm hover:bg-white/90 dark:hover:bg-black/30 shadow-sm hover:shadow-md ${t.border}`}
                      >
                        <div className="flex items-center gap-3.5">
                          {cat.image_url ? (
                            <img src={cat.image_url} alt={cat.name} className="w-11 h-11 rounded-xl object-cover shrink-0" />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#f0e6d8] to-[#e8d9c8] dark:from-[#3a2a1e] dark:to-[#2a1e14] flex items-center justify-center text-xl shrink-0">
                              ☕
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-[#4a3728] dark:text-[#e8d9c8] text-sm">{cat.name}</p>
                            {cat.description && (
                              <p className="text-xs text-[#9c7c5e] dark:text-[#7c5c3e] mt-0.5 leading-relaxed line-clamp-2">
                                {cat.description}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 text-[#c8b09a] dark:text-[#5a4030]">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Step 2: Role + Identity ── */}
          {step === 'role' && selectedCategory && (
            <motion.div
              key="role"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-5"
            >
              {/* Category badge */}
              <div className="flex justify-center pt-2">
                <span
                  className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full bg-white/70 dark:bg-black/20 backdrop-blur-sm border shadow-sm"
                  style={{ borderColor: `${theme.accent}40`, color: theme.accent }}
                >
                  {selectedCategory.image_url
                    ? <img src={selectedCategory.image_url} className="w-4 h-4 rounded object-cover" alt="" />
                    : '☕'
                  }
                  {selectedCategory.name}
                </span>
              </div>

              {/* Role selection */}
              <div className="space-y-2.5">
                <p className="text-sm font-medium text-[#7c5c3e] dark:text-[#c8956c] text-center">
                  คุณอยากเป็นฝ่ายไหนในการสนทนา?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(dbRoles.length > 0 ? dbRoles : ROLE_FALLBACK).map(r => (
                    <button
                      key={r.key}
                      onClick={() => setSelectedRole(r.key)}
                      className={`rounded-2xl border p-3.5 text-left transition-all backdrop-blur-sm ${
                        selectedRole === r.key
                          ? 'bg-white/90 dark:bg-black/40 shadow-md'
                          : 'bg-white/50 dark:bg-black/10 hover:bg-white/70 dark:hover:bg-black/20'
                      }`}
                      style={{
                        borderColor: selectedRole === r.key ? theme.accent : `${theme.accent}30`,
                        boxShadow: selectedRole === r.key ? `0 0 0 2px ${theme.accent}30` : undefined,
                      }}
                    >
                      <div className="flex items-start gap-2.5">
                        {/* Image or icon */}
                        {r.image_url ? (
                          <img
                            src={r.image_url}
                            alt={r.label}
                            className="w-9 h-9 rounded-lg object-cover shrink-0 mt-0.5"
                          />
                        ) : (
                          <span className="text-xl leading-none mt-0.5 shrink-0">
                            {ROLE_ICONS[r.key] ?? '💬'}
                          </span>
                        )}
                        <div>
                          <p className="font-semibold text-[#4a3728] dark:text-[#e8d9c8] text-sm">{r.label}</p>
                          <p className="text-[11px] text-[#9c7c5e] mt-0.5 leading-relaxed">{r.sub}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Alias */}
              <div className="space-y-2">
                <p className="text-xs text-[#9c7c5e] uppercase tracking-wider text-center font-medium">ชื่อสมมติ</p>
                <div className="flex items-center justify-center gap-3 bg-white/60 dark:bg-black/20 backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/50 dark:border-white/10">
                  {rollingAlias ? (
                    <Loader2 className="w-5 h-5 animate-spin text-[#9c7c5e]" />
                  ) : (
                    <span className="text-lg font-bold text-[#4a3728] dark:text-[#e8d9c8] flex-1 text-center">{alias}</span>
                  )}
                  <button
                    onClick={rollAlias}
                    disabled={rollingAlias}
                    className="w-8 h-8 rounded-full bg-[#f0e6d8] dark:bg-[#3a2a1e] flex items-center justify-center text-[#7c5c3e] hover:bg-[#e8d9c8] transition-colors shrink-0"
                    title="สุ่มใหม่"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Profile selection */}
              {profiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-[#9c7c5e] uppercase tracking-wider text-center font-medium">รูปโปรไฟล์</p>
                  <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                    {profiles.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProfile(p)}
                        className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                          selectedProfile?.id === p.id
                            ? 'ring-2 ring-offset-1 shadow-md'
                            : 'border-transparent hover:border-white/60 opacity-70 hover:opacity-100'
                        }`}
                        style={selectedProfile?.id === p.id ? { borderColor: theme.accent } : {}}
                      >
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview card */}
              {selectedProfile && (
                <div className="bg-white/70 dark:bg-black/20 backdrop-blur-sm rounded-2xl border border-white/50 dark:border-white/10 p-3.5 flex items-center gap-3 shadow-sm">
                  <img src={selectedProfile.image_url} alt={selectedProfile.name} className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-white/50" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#4a3728] dark:text-[#e8d9c8] text-sm truncate">{alias || '...'}</p>
                    <p className="text-xs text-[#9c7c5e]">
                      {(dbRoles.length > 0 ? dbRoles : ROLE_FALLBACK).find(r => r.key === selectedRole)?.label} · {selectedCategory.name}
                    </p>
                  </div>
                  <div className="text-xs px-2 py-1 rounded-full font-medium shrink-0" style={{ background: `${theme.accent}20`, color: theme.accent }}>
                    พร้อม
                  </div>
                </div>
              )}

              {/* Enter button */}
              <button
                onClick={enterQueue}
                disabled={entering || !alias || !selectedProfile}
                className="w-full h-12 rounded-xl text-white font-semibold text-base transition-all disabled:opacity-40 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
                style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)` }}
              >
                {entering ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> กำลังหาคู่...</>
                ) : (
                  'เข้าคาเฟ่ลับ'
                )}
              </button>

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
