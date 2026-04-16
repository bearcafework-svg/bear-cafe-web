import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BearLogo } from '@/components/bear-cafe/BearLogo';
import { ThemeToggle } from '@/components/bear-cafe/ThemeToggle';
import { Coffee, Users, MessageCircle, Sparkles } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  const features = [
    {
      icon: Users,
      title: 'หาเพื่อนคุย',
      description: 'จับคู่กับสมาชิกในเซิร์ฟเวอร์แบบสุ่ม',
    },
    {
      icon: MessageCircle,
      title: 'หลากหลายหมวดหมู่',
      description: 'เลือกหัวข้อที่สนใจได้ตามต้องการ',
    },
    {
      icon: Coffee,
      title: 'บรรยากาศอบอุ่น',
      description: 'เหมือนนั่งคุยกันในคาเฟ่',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-peach/20 to-blush/30 dark:from-mocha dark:via-coffee dark:to-mocha/80">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-mocha/80 backdrop-blur-md border-b border-honey/20">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BearLogo size="sm" />
            <span className="font-bold text-base sm:text-lg text-foreground">Bear Café</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Button
              onClick={() => navigate('/login')}
              className="bg-honey hover:bg-honey/90 text-mocha font-medium text-sm sm:text-base px-3 sm:px-4 h-9 sm:h-10"
            >
              เข้าสู่ระบบ
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="pt-16 sm:pt-20">
        <section className="min-h-[75vh] sm:min-h-[80vh] flex items-center justify-center px-4 py-8 sm:py-0">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="mb-6 sm:mb-8"
            >
              <BearLogo size="lg" className="mx-auto" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-3xl sm:text-4xl md:text-6xl font-bold text-foreground mb-3 sm:mb-4"
            >
              ยินดีต้อนรับสู่{' '}
              <span className="text-honey dark:text-honey">Bear Café</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-base sm:text-lg md:text-xl text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto px-2"
            >
              พื้นที่สำหรับหาเพื่อนคุยใหม่ ๆ ในบรรยากาศอบอุ่นเหมือนคาเฟ่
              เลือกหมวดหมู่ที่ชอบ แล้วเริ่มแมตช์กับสมาชิกคนอื่น ๆ ได้เลย!
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 sm:px-0"
            >
              <motion.div
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400 }}
              >
                <Button
                  size="lg"
                  onClick={() => navigate('/login')}
                  className="bg-honey hover:bg-honey/90 text-mocha font-bold text-lg sm:text-xl px-8 sm:px-10 py-6 sm:py-7 rounded-2xl shadow-lg hover:shadow-xl transition-all w-full sm:w-auto"
                >
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 mr-2.5" />
                  เริ่มต้นใช้งาน
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-12 sm:py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <motion.h2
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-xl sm:text-2xl md:text-3xl font-bold text-center text-foreground mb-8 sm:mb-12"
            >
              ทำไมต้อง Bear Café?
            </motion.h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30, scale: 0.95 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  whileHover={{ y: -5, scale: 1.02 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.15, duration: 0.4, type: 'spring' }}
                  className="bg-white/60 dark:bg-mocha/60 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-center shadow-lg border border-honey/20 hover:shadow-xl hover:border-honey/40 transition-all duration-300 cursor-default"
                >
                  <motion.div 
                    className="w-14 h-14 sm:w-20 sm:h-20 bg-honey/20 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-5"
                    whileHover={{ rotate: [0, -5, 5, 0], transition: { duration: 0.5 } }}
                  >
                    <feature.icon className="w-7 h-7 sm:w-10 sm:h-10 text-honey" />
                  </motion.div>
                  <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2 sm:mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-sm sm:text-base">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-6 sm:py-8 px-4 border-t border-honey/20 bg-white/40 dark:bg-mocha/40">
          <div className="max-w-5xl mx-auto text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <BearLogo size="sm" />
              <span className="font-bold text-sm sm:text-base text-foreground">Bear Café</span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              สร้างขึ้นด้วยความรัก สำหรับคอมมูนิตี้ Discord ของเรา 🐻☕
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
