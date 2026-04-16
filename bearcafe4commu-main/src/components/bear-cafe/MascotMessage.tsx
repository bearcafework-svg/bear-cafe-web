import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import bearMascot from '@/assets/bear-mascot.png';

const encouragingMessages = [
  "วันนี้อย่าลืมบอกรักตัวเอง บอกตัวเองว่าเธอเก่ง เธอจะผ่านมันไปให้ได้",
  "วันนี้เก่งแล้ว เก่งกว่าเมื่อวานอีก ขอบคุณตัวเองให้เยอะๆเลยนะ คนเก่ง",
  "ขอให้เธอเป็นเธออย่างที่เธอตั้งใจอยากจะเป็นนะคะคนเก่ง",
  "ไม่ต้องเก่งทุกเรื่องก็ได้นะแก อ่อนแอบ้างก็ได้ไม่เห็นเป็นไรเลย",
  "เหนื่อยหรือเปล่าคะคนเก่ง? ไม่เป็นไร ไปหาของกินอร่อยๆ พักซักหน่อยแล้วมาเริ่มต้นใหม่กัน",
  "อย่าแคร์คำพูดคนอื่นมากจนเกินไป เธอไม่ได้เกิดมาเพื่อแคร์คนทั้งโลกนะ",
  "พยายามเข้านะคะคนเก่ง",
  "ขอให้เป็นวันที่ดีนะคะคนเก่ง",
  "ไม่ว่าจะได้เรียนรู้อะไรในวันนี้จะง่ายหรือแสนยากเย็น เธอจะเติบโตเข็มแข็ง",
  "ไม่เป็นไรนะ ทุกคนก็ต้องผ่านช่วงเวลาแย่ๆในชีวิตกันทั้งนั้นแหละ",
  "ไม่ว่าจะเกิดอะไรขึ้น ขอให้เธอทำในสิ่งที่ชอบต่อไปนะ",
  "วันนี้ก็สู้ๆเหมือนเดิมนะ",
  "อย่าปล่อยให้คำพูดของคนใจร้ายมารังแกหัวใจของเธอเลยนะ",
  "ขอบคุณที่ไม่ว่าจะแตกสลายสักกี่ครั้ง เธอก็ยังยืนยันที่จะเติบโต",
  "เธอยังเป็นรอยยิ้มให้ใครอีกหลายคนบนโลกนี้นะ",
  "ถ้าเธอเหนื่อยล้า ลองหลับตาแล้วคิดถึงอะไรที่สบายใจดูนะ",
  "เลิกเก็บความรู้สึกแย่ๆไว้กับตัวเองสักทีน้า ปล่อยเรื่องแย่ๆออกไปได้แล้ว",
  "วันนี้เธอเก่งมากเลยนะรู้มั้ย",
  "เธอเก่งมากเลยนะ มากอดมา",
  "เธอไม่จำเป็นต้องสมบูรณ์ตลอดเวลาหรอกนะคนเก่ง",
  "เธอน่ะเก่งที่สุดแล้ว เชื่อเราดิ",
  "กลับมาสดใสเหมือนเดิม ยิ้มกว้างๆ ยิ้มจนตาเป็นสระอีไปเลยนะ น่ารักดี",
  "อยู่กินของอร่อยไปด้วยกันก่อนนะ",
  "ใจดีกับตัวเองหน่อยนะ คุณหัวใจไม่ได้พักเลย",
  "หากวันนี้เหนื่อยเกินรับไหว ขอให้เชื่อมั่นว่าเธอจะผ่านไปได้",
  "ขอให้เธอเจอคนที่ทำให้เธอรู้สึกเหมือนได้กลับบ้านนะ",
  "เธอเก่ง แถมยังมีคำพูดน่ารักมาปลอบใจคนรอบข้างอีก เก่งจังเลยนะ",
  "มันจะไม่เป็นไรนะ ทุกๆอย่างมันจะผ่านไปได้ด้วยดี",
  "อย่างน้อยในวันที่เธอเศร้า เราขอให้เธอได้กินของโปรดที่เธอชอบนะ",
  "เหนื่อยก็นอนนะคะคนเก่ง พรุ่งนี้ตื่นมาค่อยเริ่มกันใหม่",
  "ไม่เป็นแล้วนะ เรากอดเธอไว้แล้วคนเก่ง",
  "ผ่านมาได้แต่ละวันมันก็เก่งมากๆแล้ว",
  "ไปกอดไม่ได้ แต่เราจะเป็นกำลังใจให้ตรงนี้เสมอนะ",
  "ถนอมหัวใจตัวเองหน่อยคนเก่ง เธอมีคนเดียวบนโลกนะ",
  "โอ๋ๆ มากอดๆมา ไม่ร้องแล้วนะ ฮึบเร็วคนเก่ง",
  "หากพระอาทิตย์ยังคงส่องแสงในทุกเช้าวันใหม่ นั่นแปลว่าเธอยังมีโอกาสให้เริ่มใหม่ได้เสมอ",
  "พอใจในตัวเอง ไม่ว่าเธอจะเป็นแบบไหน หากเธอพอใจนั่นคือพอดี",
  "ไม่มีใครเก่งไปกว่าใคร มีแต่ใครถนัดอะไรมากกว่ากัน!"
];

// Animated bear mascot with blinking and waving
function AnimatedBear() {
  const [isBlinking, setIsBlinking] = useState(false);
  const [isWaving, setIsWaving] = useState(false);

  // Random blinking effect
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 150);
    }, 3000 + Math.random() * 2000);

    return () => clearInterval(blinkInterval);
  }, []);

  // Random waving effect
  useEffect(() => {
    const waveInterval = setInterval(() => {
      setIsWaving(true);
      setTimeout(() => setIsWaving(false), 1500);
    }, 8000 + Math.random() * 4000);

    return () => clearInterval(waveInterval);
  }, []);

  return (
    <motion.div 
      className="relative w-16 h-16 flex-shrink-0"
      animate={{ 
        y: [0, -4, 0],
        rotate: isWaving ? [0, -5, 5, -5, 0] : 0,
      }}
      transition={{ 
        y: { duration: 2, repeat: Infinity, ease: "easeInOut" },
        rotate: { duration: 0.8, ease: "easeInOut" }
      }}
    >
      {/* Bear image */}
      <img 
        src={bearMascot} 
        alt="Bear Mascot" 
        className="w-full h-full object-contain drop-shadow-lg"
      />
      
      {/* Blinking overlay effect */}
      <AnimatePresence>
        {isBlinking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            {/* Left eye blink */}
            <motion.div 
              className="absolute w-1.5 h-0.5 bg-mocha dark:bg-cream rounded-full"
              style={{ top: '35%', left: '32%' }}
            />
            {/* Right eye blink */}
            <motion.div 
              className="absolute w-1.5 h-0.5 bg-mocha dark:bg-cream rounded-full"
              style={{ top: '35%', right: '32%' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sparkle effects when waving */}
      <AnimatePresence>
        {isWaving && (
          <>
            <motion.span
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              className="absolute -top-1 -right-1 text-xs"
            >
              ✨
            </motion.span>
            <motion.span
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ delay: 0.2 }}
              className="absolute top-0 right-3 text-xs"
            >
              💖
            </motion.span>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function MascotMessage() {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(() => 
    Math.floor(Math.random() * encouragingMessages.length)
  );
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false);
      
      setTimeout(() => {
        setCurrentMessageIndex(prev => {
          let newIndex;
          do {
            newIndex = Math.floor(Math.random() * encouragingMessages.length);
          } while (newIndex === prev && encouragingMessages.length > 1);
          return newIndex;
        });
        setIsVisible(true);
      }, 500);
    }, 12000); // Change message every 12 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="px-4 py-4">
      {/* Mascot with name */}
      <div className="flex items-center gap-3 mb-3">
        <AnimatedBear />
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">น้องหมี 🐻</span>
          <span className="text-xs text-muted-foreground">พูดว่า...</span>
        </div>
      </div>

      {/* Speech bubble */}
      <div className="relative">
        {/* Speech bubble tail pointing to mascot */}
        <div className="absolute -top-2 left-6 w-4 h-4 bg-gradient-to-br from-honey/30 to-peach/40 dark:from-honey/20 dark:to-coffee/30 border-l border-t border-honey/40 dark:border-honey/20 transform rotate-45" />
        
        {/* Message box */}
        <div className="bg-gradient-to-br from-honey/30 via-peach/30 to-blush/20 dark:from-honey/20 dark:via-coffee/30 dark:to-mocha/20 rounded-2xl p-4 border border-honey/40 dark:border-honey/20 shadow-sm">
          <AnimatePresence mode="wait">
            {isVisible && (
              <motion.p
                key={currentMessageIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="text-sm text-foreground leading-relaxed font-medium min-h-[4rem]"
              >
                "{encouragingMessages[currentMessageIndex]}"
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
