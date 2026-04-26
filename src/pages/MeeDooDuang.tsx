import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import bearMascot from '@/assets/bear-mascot.png';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TarotCard {
  name: string;
  meaning: string;
  prediction: string;
  img: string;
}

interface TarotData {
  unk: string;
  cards: Record<string, TarotCard>;
}

const GIST_URL =
  'https://gist.githubusercontent.com/rxbbitz/cfca499dec156918995b03dddb9fb158/raw/tarot.json';

// ─── Card flip component ──────────────────────────────────────────────────────
function TarotCardDisplay({
  card,
  unkUrl,
  flipped,
  onFlip,
}: {
  card: TarotCard;
  unkUrl: string;
  flipped: boolean;
  onFlip: () => void;
}) {
  return (
    <div
      className="relative w-44 h-72 sm:w-52 sm:h-80 cursor-pointer mx-auto"
      style={{ perspective: '1000px' }}
      onClick={!flipped ? onFlip : undefined}
    >
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.7, ease: 'easeInOut' }}
      >
        {/* Back */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden shadow-2xl border-2 border-purple-300/40"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <img src={unkUrl} alt="card back" className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <p className="text-white/80 text-sm font-medium">แตะเพื่อเปิดไพ่</p>
          </div>
        </div>

        {/* Front */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden shadow-2xl border-2 border-amber-300/60"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <img src={card.img} alt={card.name} className="w-full h-full object-cover" />
        </div>
      </motion.div>

      {/* Glow when not flipped */}
      {!flipped && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          animate={{ boxShadow: ['0 0 20px rgba(168,85,247,0.3)', '0 0 40px rgba(168,85,247,0.6)', '0 0 20px rgba(168,85,247,0.3)'] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MeeDooDuang() {
  const navigate = useNavigate();

  // Data
  const [tarotData, setTarotData] = useState<TarotData | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  // Flow state
  type Step = 'intro' | 'question' | 'card' | 'result';
  const [step, setStep] = useState<Step>('intro');
  const [question, setQuestion] = useState('');
  const [selectedCard, setSelectedCard] = useState<TarotCard | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [fortune, setFortune] = useState('');
  const [loadingFortune, setLoadingFortune] = useState(false);

  // Fetch tarot JSON on mount
  useEffect(() => {
    fetch(GIST_URL)
      .then((r) => r.json())
      .then((data: TarotData) => setTarotData(data))
      .catch((e) => console.error('Failed to load tarot data:', e))
      .finally(() => setLoadingData(false));
  }, []);

  // Pick a random card
  const drawCard = () => {
    if (!tarotData) return;
    const keys = Object.keys(tarotData.cards);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    setSelectedCard(tarotData.cards[randomKey]);
    setFlipped(false);
    setFortune('');
    setStep('card');
  };

  // Flip card → call AI
  const handleFlip = async () => {
    if (!selectedCard || flipped) return;
    setFlipped(true);

    // Small delay so flip animation plays first
    setTimeout(async () => {
      setLoadingFortune(true);
      try {
        const { data, error } = await supabase.functions.invoke('fortune-test', {
          body: {
            question: question.trim() || null,
            cardName: selectedCard.name,
            meaning: selectedCard.meaning,
            prediction: selectedCard.prediction,
          },
        });
        if (error) throw error;
        setFortune(data.fortune ?? selectedCard.prediction);
      } catch (err) {
        console.error('Fortune error:', err);
        setFortune(selectedCard.prediction); // fallback
      } finally {
        setLoadingFortune(false);
        setStep('result');
      }
    }, 800);
  };

  const reset = () => {
    setStep('intro');
    setQuestion('');
    setSelectedCard(null);
    setFlipped(false);
    setFortune('');
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0a2e] via-[#2d1b4e] to-[#1a0a2e] flex flex-col">
      {/* Stars background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.6 + 0.2,
            }}
            animate={{ opacity: [0.2, 0.8, 0.2] }}
            transition={{ duration: 2 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 2 }}
          />
        ))}
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center gap-3 p-4 pt-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/')}
          className="text-white/70 hover:text-white hover:bg-white/10 rounded-xl"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            🔮 มีดูดวง
          </h1>
          <p className="text-white/50 text-xs">ไพ่ทาโรต์แห่ง Bear Cafe</p>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-8 max-w-lg mx-auto w-full">
        <AnimatePresence mode="wait">

          {/* ── INTRO ── */}
          {step === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center space-y-6 w-full"
            >
              <motion.img
                src={bearMascot}
                alt="Bear mascot"
                className="w-32 h-32 mx-auto object-contain drop-shadow-2xl"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">สวัสดีค่ะ! 🐻</h2>
                <p className="text-white/70 text-sm leading-relaxed">
                  น้องหมีพร้อมดูดวงให้แล้วนะคะ<br />
                  ลองสุ่มไพ่ทาโรต์ดูสิคะ ✨
                </p>
              </div>
              <Button
                onClick={() => setStep('question')}
                disabled={loadingData}
                className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white border-0 rounded-2xl px-8 py-6 text-base font-semibold shadow-lg shadow-violet-500/30 gap-2"
              >
                {loadingData ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />กำลังโหลด...</>
                ) : (
                  <><Sparkles className="w-4 h-4" />เริ่มดูดวง</>
                )}
              </Button>
            </motion.div>
          )}

          {/* ── QUESTION ── */}
          {step === 'question' && (
            <motion.div
              key="question"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full space-y-5"
            >
              <div className="text-center space-y-2">
                <p className="text-2xl">🌙</p>
                <h2 className="text-xl font-bold text-white">มีคำถามในใจมั้ยคะ?</h2>
                <p className="text-white/60 text-sm">ใส่หรือข้ามก็ได้นะคะ</p>
              </div>

              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="เช่น ความรักของฉันจะเป็นยังไงบ้าง..."
                className="bg-white/10 border-white/20 text-white placeholder:text-white/30 rounded-2xl resize-none min-h-[100px] focus-visible:ring-violet-400/50"
                maxLength={200}
              />

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep('intro')}
                  className="flex-1 rounded-2xl bg-white/5 border-white/20 text-white hover:bg-white/10"
                >
                  ย้อนกลับ
                </Button>
                <Button
                  onClick={drawCard}
                  className="flex-1 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white border-0 rounded-2xl font-semibold gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  สุ่มไพ่
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── CARD ── */}
          {(step === 'card' || step === 'result') && selectedCard && tarotData && (
            <motion.div
              key="card"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full space-y-6"
            >
              {/* Card name */}
              <div className="text-center">
                <AnimatePresence>
                  {flipped && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-1"
                    >
                      <p className="text-amber-300 text-xs font-medium tracking-widest uppercase">ไพ่ที่ได้</p>
                      <h2 className="text-xl font-bold text-white">{selectedCard.name}</h2>
                    </motion.div>
                  )}
                  {!flipped && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-white/60 text-sm"
                    >
                      แตะไพ่เพื่อเปิดดูดวงค่ะ ✨
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Card */}
              <TarotCardDisplay
                card={selectedCard}
                unkUrl={tarotData.unk}
                flipped={flipped}
                onFlip={handleFlip}
              />

              {/* Fortune result */}
              <AnimatePresence>
                {step === 'result' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="space-y-4"
                  >
                    {/* Mascot + fortune */}
                    <div className="flex gap-3 items-start">
                      <img
                        src={bearMascot}
                        alt="Bear"
                        className="w-12 h-12 object-contain shrink-0 mt-1"
                      />
                      <div className="flex-1 bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl rounded-tl-sm p-4">
                        {loadingFortune ? (
                          <div className="flex items-center gap-2 text-white/60">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">น้องหมีกำลังดูดวงให้...</span>
                          </div>
                        ) : (
                          <p className="text-white/90 text-sm leading-relaxed">{fortune}</p>
                        )}
                      </div>
                    </div>

                    {/* Meaning pill */}
                    <div className="bg-violet-500/15 border border-violet-400/25 rounded-xl p-3">
                      <p className="text-violet-300 text-xs font-medium mb-1">ความหมายของไพ่</p>
                      <p className="text-white/70 text-xs leading-relaxed">{selectedCard.meaning}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      <Button
                        onClick={reset}
                        variant="outline"
                        className="flex-1 rounded-2xl bg-white/5 border-white/20 text-white hover:bg-white/10 gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        ดูดวงใหม่
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
