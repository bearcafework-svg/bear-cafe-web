import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';

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

const ROLES: { key: ChatRole; label: string; sub: string }[] = [
  { key: 'talk',   label: 'Talk',   sub: 'อยากเล่า' },
  { key: 'listen', label: 'Listen', sub: 'อยากฟัง' },
  { key: 'both',   label: 'Both',   sub: 'คุยได้ทั้งคู่' },
  { key: 'chill',  label: 'Chill',  sub: 'ชิล · ไม่จริงจัง' },
];

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

  const [categories, setCategories] = useState<ChatCategory[]>([]);
  const [profiles, setProfiles] = useState<ChatProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState<'category' | 'role'>('category');
  const [selectedCategory, setSelectedCategory] = useState<ChatCategory | null>(null);
  const [selectedRole, setSelectedRole] = useState<ChatRole>('both');

  const [alias, setAlias] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<ChatProfile | null>(null);
  const [rollingAlias, setRollingAlias] = useState(false);
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    Promise.all([
      (supabase as any).from('chat_topics').select('id, name, description, image_url').eq('is_active', true).order('sort_order'),
      (supabase as any).from('chat_profiles').select('id, name, image_url').eq('is_active', true).order('sort_order'),
    ]).then(([catRes, profRes]: any[]) => {
      setCategories(catRes.data ?? []);
      const profs: ChatProfile[] = profRes.data ?? [];
      setProfiles(profs);
      if (profs.length > 0) setSelectedProfile(profs[0]);
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
        <Button
          variant="ghost"
          size="icon"
          onClick={() => step === 'role' ? setStep('category') : navigate('/')}
          className="rounded-xl w-9 h-9 text-[#7c5c3e] hover:bg-[#f0e6d8]"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="font-semibold text-[#4a3728] dark:text-[#e8d9c8] text-base leading-tight">Secret Table</h1>
          <p className="text-xs text-[#9c7c5e] dark:text-[#7c5c3e]">
            {step === 'category' ? 'เลือกหมวดสนทนา' : 'เลือกบทบาทของคุณ'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {(['category', 'role'] as const).map(s => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                step === s ? 'w-6 bg-[#c8956c]' : 'w-3 bg-[#e8d9c8] dark:bg-[#3a2a1e]'
              }`}
            />
          ))}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        <AnimatePresence mode="wait">

          {step === 'category' && (
            <motion.div
              key="category"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              className="space-y-4"
            >
              <p className="text-sm text-[#7c5c3e] dark:text-[#9c7c5e] text-center">
                วันนี้อยากคุยเรื่องอะไร?
              </p>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-[#9c7c5e]" />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {categories.map(cat => (
                    <motion.button
                      key={cat.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => { setSelectedCategory(cat); setStep('role'); }}
                      className="w-full text-left rounded-2xl border-2 p-4 transition-all border-[#e8d9c8] dark:border-[#3a2a1e] bg-white dark:bg-[#221810] hover:border-[#c8956c]/60"
                    >
                      <div className="flex items-center gap-3">
                        {cat.image_url ? (
                          <img src={cat.image_url} alt={cat.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-[#f0e6d8] dark:bg-[#3a2a1e] flex items-center justify-center text-2xl shrink-0">
                            ☕
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-[#4a3728] dark:text-[#e8d9c8]">{cat.name}</p>
                          {cat.description && (
                            <p className="text-xs text-[#9c7c5e] dark:text-[#7c5c3e] mt-0.5 leading-relaxed">
                              {cat.description}
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

          {step === 'role' && selectedCategory && (
            <motion.div
              key="role"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="space-y-6"
            >
              <div className="flex justify-center">
                <span className="inline-flex items-center gap-1.5 bg-[#f0e6d8] dark:bg-[#3a2a1e] text-[#7c5c3e] dark:text-[#c8956c] text-sm font-medium px-3 py-1.5 rounded-full">
                  ☕ {selectedCategory.name}
                </span>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-[#9c7c5e] uppercase tracking-wider text-center">
                  คุณอยากเป็นฝ่ายไหนในการสนทนา?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map(r => (
                    <button
                      key={r.key}
                      onClick={() => setSelectedRole(r.key)}
                      className={`rounded-2xl border-2 p-3.5 text-left transition-all ${
                        selectedRole === r.key
                          ? 'border-[#c8956c] bg-[#f5ede4] dark:bg-[#2a1e14]'
                          : 'border-[#e8d9c8] dark:border-[#3a2a1e] bg-white dark:bg-[#221810] hover:border-[#c8956c]/50'
                      }`}
                    >
                      <p className="font-semibold text-[#4a3728] dark:text-[#e8d9c8] text-sm">{r.label}</p>
                      <p className="text-xs text-[#9c7c5e] mt-0.5">{r.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-[#9c7c5e] uppercase tracking-wider text-center">ชื่อสมมติ</p>
                <div className="flex items-center justify-center gap-3">
                  {rollingAlias ? (
                    <Loader2 className="w-5 h-5 animate-spin text-[#9c7c5e]" />
                  ) : (
                    <span className="text-xl font-bold text-[#4a3728] dark:text-[#e8d9c8]">{alias}</span>
                  )}
                  <button
                    onClick={rollAlias}
                    disabled={rollingAlias}
                    className="w-8 h-8 rounded-full bg-[#f0e6d8] dark:bg-[#3a2a1e] flex items-center justify-center text-[#7c5c3e] hover:bg-[#e8d9c8] transition-colors"
                    title="สุ่มใหม่"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {profiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-[#9c7c5e] uppercase tracking-wider text-center">รูปโปรไฟล์</p>
                  <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                    {profiles.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProfile(p)}
                        className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                          selectedProfile?.id === p.id
                            ? 'border-[#c8956c] ring-2 ring-[#c8956c] ring-offset-1'
                            : 'border-transparent hover:border-[#c8956c]/40'
                        }`}
                      >
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedProfile && (
                <div className="bg-white dark:bg-[#221810] rounded-2xl border border-[#e8d9c8] dark:border-[#3a2a1e] p-3.5 flex items-center gap-3">
                  <img src={selectedProfile.image_url} alt={selectedProfile.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-[#4a3728] dark:text-[#e8d9c8] text-sm truncate">{alias || '...'}</p>
                    <p className="text-xs text-[#9c7c5e]">
                      {ROLES.find(r => r.key === selectedRole)?.label} · {selectedCategory.name}
                    </p>
                  </div>
                </div>
              )}

              <Button
                onClick={enterQueue}
                disabled={entering || !alias || !selectedProfile}
                className="w-full h-12 bg-[#c8956c] hover:bg-[#b07d58] text-white font-semibold rounded-xl text-base"
              >
                {entering ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> กำลังหาคู่...</>
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
