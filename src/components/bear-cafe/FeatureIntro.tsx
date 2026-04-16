import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Headphones, Mic, Heart, Sparkles, Coffee } from 'lucide-react';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  emoji: string;
  gradient: string;
  delay?: number;
}

const FeatureCard = ({ icon, title, description, emoji, gradient, delay = 0 }: FeatureCardProps) => (
  <Card 
    className={`group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-500 hover:scale-105 cursor-pointer bg-gradient-to-br ${gradient}`}
    style={{ animationDelay: `${delay}ms` }}
  >
    <CardContent className="p-6 relative z-10">
      {/* Floating emoji background */}
      <div className="absolute -right-4 -top-4 text-6xl opacity-20 group-hover:opacity-30 group-hover:scale-110 transition-all duration-500">
        {emoji}
      </div>
      
      {/* Icon */}
      <div className="w-14 h-14 rounded-2xl bg-white/80 backdrop-blur-sm flex items-center justify-center mb-4 shadow-md group-hover:shadow-lg transition-all duration-300">
        {icon}
      </div>
      
      {/* Content */}
      <h3 className="font-display font-bold text-lg text-foreground mb-2 group-hover:text-primary transition-colors">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </CardContent>
    
    {/* Shimmer effect on hover */}
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-1000" />
  </Card>
);

const StepCard = ({ number, title, description }: { number: number; title: string; description: string }) => (
  <div className="flex items-start gap-4 group">
    <div className="w-12 h-12 rounded-full gradient-bear flex items-center justify-center text-white font-bold text-lg shadow-lg shrink-0 group-hover:scale-110 transition-transform duration-300">
      {number}
    </div>
    <div className="pt-1">
      <h4 className="font-display font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
        {title}
      </h4>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  </div>
);

export const FeatureIntro = () => {
  const features = [
    {
      icon: <Users className="w-7 h-7 text-bear-brown" />,
      title: 'หาเพื่อนคุย',
      description: 'พบปะเพื่อนใหม่ที่มีความสนใจคล้ายกัน พูดคุยแลกเปลี่ยนเรื่องราว',
      emoji: '🧸',
      gradient: 'from-bear-brown/20 via-bear-light/10 to-cream'
    },
    {
      icon: <Headphones className="w-7 h-7 text-honey" />,
      title: 'ผู้รับฟัง',
      description: 'มีคนพร้อมรับฟังปัญหาและให้กำลังใจคุณทุกเมื่อ',
      emoji: '💛',
      gradient: 'from-honey/20 via-peach/10 to-cream'
    },
    {
      icon: <Mic className="w-7 h-7 text-matcha" />,
      title: 'ห้องเสียง',
      description: 'เข้าร่วม Voice Channel พูดคุยสดๆ อบอุ่นเหมือนอยู่คาเฟ่',
      emoji: '🎙️',
      gradient: 'from-matcha/20 via-matcha/10 to-cream'
    },
  ];

  const steps = [
    {
      title: 'เลือกหมวดหมู่',
      description: 'เลือกว่าต้องการหาเพื่อนคุย หรือต้องการผู้รับฟัง'
    },
    {
      title: 'เลือกบทบาท',
      description: 'กำหนดบทบาทที่คุณต้องการแสดงในห้องนี้'
    },
    {
      title: 'เริ่มแมตช์',
      description: 'ระบบจะสร้างประกาศใน Discord เพื่อหาคู่สนทนา'
    },
  ];

  return (
    <div className="px-4 md:px-8 py-8 space-y-10">
      {/* Welcome Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-honey/20 border border-honey/30">
          <Sparkles className="w-4 h-4 text-honey" />
          <span className="text-sm font-medium text-mocha">ยินดีต้อนรับสู่ Bear Café</span>
          <span className="text-lg">☕</span>
        </div>
        
        <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">
          พื้นที่อบอุ่นสำหรับทุกคน
        </h2>
        
        <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
          Bear Café คือพื้นที่ปลอดภัยสำหรับหาเพื่อนคุย ผู้รับฟัง 
          และลงห้องเสียงพูดคุยกันใน Discord Community
        </p>
      </div>

      {/* Feature Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {features.map((feature, idx) => (
          <FeatureCard 
            key={idx} 
            {...feature} 
            delay={idx * 100}
          />
        ))}
      </div>

      {/* How it works */}
      <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-cream via-latte/50 to-peach/30">
        <CardContent className="p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-bear-brown/10 flex items-center justify-center">
              <Coffee className="w-5 h-5 text-bear-brown" />
            </div>
            <h3 className="font-display font-bold text-xl text-foreground">
              วิธีใช้งาน
            </h3>
          </div>
          
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((step, idx) => (
              <StepCard 
                key={idx}
                number={idx + 1}
                title={step.title}
                description={step.description}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Community Stats - Cute version */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-md bg-gradient-to-br from-bear-brown/10 to-cream text-center py-5">
          <div className="text-3xl mb-2">🐻</div>
          <div className="font-display font-bold text-xl text-foreground">100+</div>
          <div className="text-xs text-muted-foreground">สมาชิก</div>
        </Card>
        <Card className="border-0 shadow-md bg-gradient-to-br from-honey/10 to-cream text-center py-5">
          <div className="text-3xl mb-2">💬</div>
          <div className="font-display font-bold text-xl text-foreground">500+</div>
          <div className="text-xs text-muted-foreground">Sessions</div>
        </Card>
        <Card className="border-0 shadow-md bg-gradient-to-br from-matcha/10 to-cream text-center py-5">
          <div className="text-3xl mb-2">❤️</div>
          <div className="font-display font-bold text-xl text-foreground">24/7</div>
          <div className="text-xs text-muted-foreground">พร้อมรับฟัง</div>
        </Card>
      </div>

      {/* Cute Bear Quote */}
      <div className="relative bg-gradient-to-r from-bear-brown/5 via-honey/10 to-bear-brown/5 rounded-3xl p-6 text-center overflow-hidden">
        {/* Background paw prints */}
        <div className="absolute inset-0 opacity-5">
          {[...Array(6)].map((_, i) => (
            <span 
              key={i} 
              className="absolute text-4xl"
              style={{
                left: `${10 + i * 15}%`,
                top: `${20 + (i % 2) * 50}%`,
                transform: `rotate(${-20 + i * 10}deg)`
              }}
            >
              🐾
            </span>
          ))}
        </div>
        
        <div className="relative z-10">
          <span className="text-5xl block mb-4">🧸</span>
          <p className="font-display text-lg text-mocha italic">
            "ทุกคนสมควรได้รับการรับฟัง"
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            — น้องหมี Bear Café
          </p>
        </div>
      </div>
    </div>
  );
};
