import React, { forwardRef, useRef, useState } from 'react';
import { BearLogo } from '@/components/bear-cafe/BearLogo';
import { Footer } from '@/components/bear-cafe/Footer';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Users, MessageCircle, Mic } from 'lucide-react';
import { TurnstileWidget, TurnstileHandle } from '@/components/security/TurnstileWidget';
import { toast } from 'sonner';

const LoginPage = forwardRef<HTMLDivElement, object>((_, ref) => {
  const { login, isLoading } = useAuth();
  const [isLoginClicked, setIsLoginClicked] = useState(false);
  const turnstileRef = useRef<TurnstileHandle | null>(null);
  
  // IMPORTANT: Must use VITE_ prefix for client-side env vars in Vite
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  // Debug logging (safe - only shows existence and length, not actual key)
  React.useEffect(() => {
    console.log('[Turnstile Debug]', {
      hasTurnstileSiteKey: !!siteKey,
      turnstileSiteKeyLength: siteKey?.length ?? 0,
      hasSupabaseUrl: !!import.meta.env.VITE_SUPABASE_URL,
      supabaseUrlLength: import.meta.env.VITE_SUPABASE_URL?.length ?? 0,
    });
  }, [siteKey]);

const handleLogin = async () => {
  setIsLoginClicked(true);

  try {
    let token = 'TURNSTILE_BYPASS_DEV';

    // เอา Turnstile เหมือนเดิม (ใช้ได้)
    if (siteKey && turnstileRef.current?.isReady()) {
      try {
        const turnstileToken = await turnstileRef.current.execute();
        if (turnstileToken) {
          token = turnstileToken;
        }
      } catch (err) {
        console.warn('[Login] Turnstile error:', err);
      }
    }

    // 🔥 จุดสำคัญ: เปลี่ยนจาก login() → redirect ไป Discord
    const clientId = "998239118372917278"; // 👈 ใส่จริง
    const redirectUri = "https://bearcafe4commu.vercel.app/auth/callback";

    const url = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=identify`;

    // (optional) ถ้าอยากส่ง token ไปด้วย (advanced)
    // localStorage.setItem("turnstile_token", token);

    window.location.href = url;

  } catch (error) {
    console.error('[Login] Error:', error);
    setIsLoginClicked(false);
    toast.error('ไม่สามารถติดต่อระบบยืนยันตัวตนได้ กรุณาลองใหม่อีกครั้ง');
  }
};

  const features = [
    { icon: Users, label: 'หาเพื่อนคุย', desc: 'เชื่อมต่อกับสมาชิกในชุมชน' },
    { icon: MessageCircle, label: 'ผู้รับฟัง', desc: 'มีคนพร้อมรับฟังเสมอ' },
    { icon: Mic, label: 'ลงห้องเสียง', desc: 'เข้าร่วม Voice Channel ด้วยกัน' },
    { icon: Shield, label: 'ปลอดภัย', desc: 'ระบบที่ดูแลความปลอดภัย' },
  ];

  // Show loading state while redirecting to Discord
  if (isLoginClicked || isLoading) {
    return (
      <div className="min-h-screen bg-background bg-pattern-dots flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center justify-center space-y-6 animate-fade-in">
          <div className="animate-bounce-slow flex items-center justify-center">
            <BearLogo size="xl" />
          </div>
          <h1 className="font-display font-bold text-3xl text-gradient-bear text-center">
            Bear Café
          </h1>
          <div className="flex items-center justify-center gap-3 text-muted-foreground">
            <svg className="w-5 h-5 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            <span className="text-lg">กำลังเชื่อมต่อกับ Discord...</span>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-pattern-dots flex flex-col">
      <div className="flex-1 container max-w-lg mx-auto px-4 py-6 sm:py-10 flex flex-col items-center justify-center">
        {/* Main Card - Larger Design with enhanced animations */}
        <Card className="w-full shadow-xl border-primary/10 bg-card/80 backdrop-blur-sm animate-fade-in transition-all duration-300 hover:shadow-2xl hover:border-primary/20">
          {/* Logo at top of card */}
          <div className="flex justify-center pt-10 pb-5">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-honey/30 blur-2xl scale-150 opacity-50 group-hover:opacity-70 transition-opacity duration-500" />
              <div className="relative transition-transform duration-300 group-hover:scale-105">
                <BearLogo size="2xl" noFloat className="relative" />
              </div>
            </div>
          </div>
          
          <CardHeader className="text-center px-6 sm:px-10 pb-4 pt-0">
            <CardTitle className="font-display text-2xl sm:text-4xl text-foreground animate-fade-in" style={{ animationDelay: '100ms' }}>
              ยินดีต้อนรับ
            </CardTitle>
            <CardDescription className="text-sm sm:text-lg mt-2 animate-fade-in" style={{ animationDelay: '150ms' }}>
              เข้าสู่ระบบเพื่อเริ่มหาเพื่อนใหม่
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-7 px-6 sm:px-10 pt-3 pb-10">
            {/* Features Grid - Larger with hover effects */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {features.map((feature, index) => (
                <div
                  key={feature.label}
                  className="flex items-center gap-3 p-4 sm:p-5 rounded-xl bg-secondary/60 border border-border/50 transition-all duration-300 hover:bg-secondary/80 hover:scale-[1.02] hover:shadow-md animate-fade-in cursor-default"
                  style={{ animationDelay: `${200 + index * 50}ms` }}
                >
                  <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-primary/20 to-honey/20 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110">
                    <feature.icon className="w-5 h-5 sm:w-7 sm:h-7 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm sm:text-base leading-tight">{feature.label}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-snug mt-0.5">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Discord Login Button - More Prominent with animation */}
            <div className="animate-fade-in" style={{ animationDelay: '400ms' }}>
              <Button
                onClick={handleLogin}
                disabled={isLoginClicked}
                className="w-full h-14 sm:h-16 text-base sm:text-xl font-bold bg-[#5865F2] hover:bg-[#4752C4] text-white shadow-lg shadow-[#5865F2]/25 transition-all duration-300 hover:shadow-xl hover:shadow-[#5865F2]/35 hover:-translate-y-1 active:translate-y-0 active:shadow-md"
              >
                <svg
                  className="w-6 h-6 sm:w-7 sm:h-7 mr-2.5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
                เข้าสู่ระบบด้วย Discord
              </Button>
            </div>
            <TurnstileWidget ref={turnstileRef} siteKey={siteKey} action="login" />

            {/* Notice */}
            <p className="text-xs sm:text-sm text-center text-muted-foreground animate-fade-in" style={{ animationDelay: '450ms' }}>
              เมื่อเข้าสู่ระบบ แสดงว่าคุณยอมรับ
              <a 
                href="https://www.notion.so/2f4fa9ff914e80b29e13e5225887e07d" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline transition-colors duration-200"
              > กฎชุมชน </a>
              ของเรา
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
});

LoginPage.displayName = 'LoginPage';

export default LoginPage;
