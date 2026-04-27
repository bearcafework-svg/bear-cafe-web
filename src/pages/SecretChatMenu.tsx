import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';

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
  const prefix = pList.length > 0 ? pickRandom(pList).word : '\u0e19\u0e38\u0e48\u0e21\u0e19\u0e34\u0e48\u0e21';
  const menu = mList.length > 0 ? pickRandom(mList).word : '\u0e25\u0e32\u0e40\u0e15\u0e49';
  return `${prefix}${menu}`;
}

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

  useEffect(() => {
    Promise.all([
      (supabase as any).from('chat_topics').select('id, name, description, image_url').eq('is_active', true).order('sort_order'),
      (supabase as any).from('chat_profiles').select('id, name, image_url').eq('is_active', true).order('sort_order'),
    ]).then(([topicsRes, profilesRes]: any[]) => {
      setTopics(topicsRes.data ?? []);
      const profs: ChatProfile[] = profilesRes.data ?? [];
      setProfiles(profs);
      if (profs.length > 0) setSelectedProfile(profs[0]);
      setLoadingTopics(false);
    });
  }, []);

  useEffect(() => {
    if (step === 'identity' && !alias) rollAlias();
  }, [step]);

  const rollAlias = useCallback(async () => {
    setRollingAlias(true);
    const a = await generateAlias();
    setAlias(a);
    if (profiles.length > 0) setSelectedProfile(pickRandom(profiles));
    setRollingAlias(false);
  }, [profiles]);

  const enterQueue = useCallback(async () => {
    if (!user || !selectedTopic || !alias || !selectedProfile) return;
    setEntering(true);
    try {
      await (supabase as any).from('chat_queue').delete().eq('user_id', user.id);
      const { error } = await (supabase as any).from('chat_queue').insert({
        user_id: user.id,
        topic_id: selectedTopic.id,
        alias,
        avatar: selectedProfile.id,
      });
      if (error) throw error;
      navigate('/secret-chat/room', {
        state: {
          topicId: selectedTopic.id,
          topicName: selectedTopic.name,
          alias,
          avatar: selectedProfile.id,
        },
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
          <p className="text-[#7c5c3e] font-medium">
            {'\u0e01\u0e23\u0e38\u0e13\u0e32\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a\u0e01\u0e48\u0e2d\u0e19\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19 Secret Table'}
          </p>
          <Button onClick={() => navigate('/login')} variant="outline">
            {'\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a'}
          </Button>
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
          onClick={() => (step === 'identity' ? setStep('topic') : navigate('/'))}
          className="rounded-xl w-9 h-9 text-[#7c5c3e] hover:bg-[#f0e6d8]"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="font-semibold text-[#4a3728] dark:text-[#e8d9c8] text-base leading-tight">
            Secret Table
          </h1>
          <p className="text-xs text-[#9c7c5e] dark:text-[#7c5c3e]">
            {step === 'topic'
              ? '\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e1a\u0e23\u0e23\u0e22\u0e32\u0e01\u0e32\u0e28\u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23'
              : '\u0e15\u0e31\u0e49\u0e07\u0e15\u0e31\u0e27\u0e15\u0e19\u0e2a\u0e21\u0e21\u0e15\u0e34'}
          </p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {step === 'topic' && (
            <motion.div
              key="topic"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <p className="text-sm text-[#7c5c3e] dark:text-[#9c7c5e] text-center">
                {'\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e1a\u0e23\u0e23\u0e22\u0e32\u0e01\u0e32\u0e28\u0e17\u0e35\u0e48\u0e2d\u0e22\u0e32\u0e01\u0e1e\u0e39\u0e14\u0e04\u0e38\u0e22\u0e27\u0e31\u0e19\u0e19\u0e35\u0e49'}
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
                      className="w-full text-left rounded-2xl border-2 p-4 transition-all border-[#e8d9c8] dark:border-[#3a2a1e] bg-white dark:bg-[#221810] hover:border-[#c8956c]/60"
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

          {step === 'identity' && selectedTopic && (
            <motion.div
              key="identity"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-center">
                <span className="inline-flex items-center gap-1.5 bg-[#f0e6d8] dark:bg-[#3a2a1e] text-[#7c5c3e] dark:text-[#c8956c] text-sm font-medium px-3 py-1.5 rounded-full">
                  ☕ {selectedTopic.name}
                </span>
              </div>

              <div className="text-center space-y-2">
                <p className="text-xs text-[#9c7c5e] uppercase tracking-wider">
                  {'\u0e0a\u0e37\u0e48\u0e2d\u0e2a\u0e21\u0e21\u0e15\u0e34\u0e02\u0e2d\u0e07\u0e04\u0e38\u0e13'}
                </p>
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
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-[#9c7c5e] uppercase tracking-wider text-center">
                  {'\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e23\u0e39\u0e1b\u0e42\u0e1b\u0e23\u0e44\u0e1f\u0e25\u0e4c'}
                </p>
                {profiles.length === 0 ? (
                  <p className="text-center text-sm text-[#9c7c5e]">
                    {'\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e42\u0e1b\u0e23\u0e44\u0e1f\u0e25\u0e4c (\u0e41\u0e2d\u0e14\u0e21\u0e34\u0e19\u0e15\u0e49\u0e2d\u0e07\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e01\u0e48\u0e2d\u0e19)'}
                  </p>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {profiles.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProfile(p)}
                        className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                          selectedProfile?.id === p.id
                            ? 'border-[#c8956c] ring-2 ring-[#c8956c] ring-offset-2'
                            : 'border-transparent hover:border-[#c8956c]/40'
                        }`}
                      >
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedProfile && (
                <div className="bg-white dark:bg-[#221810] rounded-2xl border border-[#e8d9c8] dark:border-[#3a2a1e] p-4 flex items-center gap-3">
                  <img
                    src={selectedProfile.image_url}
                    alt={selectedProfile.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-semibold text-[#4a3728] dark:text-[#e8d9c8]">{alias || '...'}</p>
                    <p className="text-xs text-[#9c7c5e]">
                      {selectedProfile.name} {'\u2014 \u0e15\u0e31\u0e27\u0e15\u0e19\u0e2a\u0e21\u0e21\u0e15\u0e34\u0e02\u0e2d\u0e07\u0e04\u0e38\u0e13'}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-center">
                <button
                  onClick={rollAlias}
                  disabled={rollingAlias}
                  className="flex items-center gap-2 text-sm text-[#9c7c5e] hover:text-[#7c5c3e] transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {'\u0e2a\u0e38\u0e48\u0e21\u0e43\u0e2b\u0e21\u0e48\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14'}
                </button>
              </div>

              <Button
                onClick={enterQueue}
                disabled={entering || !alias || !selectedProfile}
                className="w-full h-12 bg-[#c8956c] hover:bg-[#b07d58] text-white font-semibold rounded-xl text-base"
              >
                {entering ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {'\u0e01\u0e33\u0e25\u0e31\u0e07\u0e2b\u0e32\u0e04\u0e39\u0e48\u0e2a\u0e19\u0e17\u0e19\u0e32...'}
                  </>
                ) : (
                  '\u0e19\u0e31\u0e48\u0e07\u0e42\u0e15\u0e4a\u0e30\u0e25\u0e31\u0e1a'
                )}
              </Button>

              <p className="text-center text-xs text-[#9c7c5e]">
                {'\u0e15\u0e31\u0e27\u0e15\u0e19\u0e08\u0e23\u0e34\u0e07\u0e02\u0e2d\u0e07\u0e04\u0e38\u0e13\u0e08\u0e30\u0e16\u0e39\u0e01\u0e40\u0e01\u0e47\u0e1a\u0e40\u0e1b\u0e47\u0e19\u0e04\u0e27\u0e32\u0e21\u0e25\u0e31\u0e1a'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
