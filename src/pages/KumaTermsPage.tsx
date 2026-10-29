import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BearLogo } from '@/components/bear-cafe/BearLogo';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { PolicyNavTabs } from '@/components/bear-cafe/PolicyNavTabs';
import { CozyPageFooter } from '@/components/bear-cafe/CozyPageFooter';
import {
  FileText,
  ShieldAlert,
  Server,
  Layers,
  Award,
  AlertTriangle,
  HeartHandshake,
  ArrowLeft,
  ArrowUp,
  ExternalLink,
  Mail,
  Calendar,
  Clock,
  ChevronDown,
  CheckCircle2,
  Bot,
  Sparkles,
  Gamepad2,
  Coins,
  ShieldCheck,
  Globe,
  Radio,
} from 'lucide-react';

interface TocItem {
  id: string;
  title: string;
  shortTitle: string;
  icon: React.ElementType;
}

const TOC_SECTIONS: TocItem[] = [
  {
    id: 'intro',
    title: 'บทนำและการยอมรับข้อกำหนด',
    shortTitle: 'บทนำ',
    icon: HeartHandshake,
  },
  {
    id: 'section-1',
    title: '1. ข้อมูลทั่วไปและลักษณะการให้บริการ',
    shortTitle: '1. ข้อมูลทั่วไป',
    icon: Server,
  },
  {
    id: 'section-2',
    title: '2. สิทธิ์ที่จำเป็นสำหรับการทำงาน (Permissions & Intents)',
    shortTitle: '2. สิทธิ์และ Intents',
    icon: Radio,
  },
  {
    id: 'section-3',
    title: '3. แผนการใช้งาน (Standard & Premium)',
    shortTitle: '3. แผนการใช้งาน',
    icon: Layers,
  },
  {
    id: 'section-4',
    title: '4. แต้มเสมือนจริงและของรางวัล',
    shortTitle: '4. แต้มและรางวัล',
    icon: Coins,
  },
  {
    id: 'section-5',
    title: '5. ข้อกำหนดการใช้งานที่ยอมรับได้และมาตรการลงโทษ',
    shortTitle: '5. ข้อห้าม & บทลงโทษ',
    icon: AlertTriangle,
  },
  {
    id: 'section-6',
    title: '6. ความพร้อมให้บริการและข้อจำกัดความรับผิด',
    shortTitle: '6. ขอบเขตความรับผิด',
    icon: ShieldAlert,
  },
  {
    id: 'section-7',
    title: '7. การเปลี่ยนแปลงบริการและข้อกำหนด',
    shortTitle: '7. การเปลี่ยนแปลงข้อกำหนด',
    icon: Clock,
  },
  {
    id: 'section-8',
    title: '8. ช่องทางติดต่อทีมงาน',
    shortTitle: '8. ติดต่อเรา',
    icon: Mail,
  },
  {
    id: 'section-related',
    title: 'เอกสารที่เกี่ยวข้อง (Privacy Policy)',
    shortTitle: 'นโยบายความเป็นส่วนตัว',
    icon: FileText,
  },
];

export default function KumaTermsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  const [activeSection, setActiveSection] = useState<string>('intro');
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);
  const [mobileTocOpen, setMobileTocOpen] = useState<boolean>(false);

  // Scrollspy & Scroll to Top Visibility
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 140;
      setShowScrollTop(window.scrollY > 400);

      for (let i = TOC_SECTIONS.length - 1; i >= 0; i--) {
        const el = document.getElementById(TOC_SECTIONS[i].id);
        if (el && el.offsetTop <= scrollPosition) {
          setActiveSection(TOC_SECTIONS[i].id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle URL hash on mount or change
  useEffect(() => {
    if (location.hash) {
      const targetId = location.hash.replace('#', '');
      const el = document.getElementById(targetId);
      if (el) {
        setTimeout(() => {
          const topOffset = el.getBoundingClientRect().top + window.scrollY - 90;
          window.scrollTo({ top: topOffset, behavior: 'smooth' });
        }, 150);
      }
    }
  }, [location.hash]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const topOffset = element.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: topOffset, behavior: 'smooth' });
      setActiveSection(id);
      window.history.replaceState(null, '', `#${id}`);
      setMobileTocOpen(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors selection:bg-amber-500/30 selection:text-foreground flex flex-col font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-card/85 border-b border-border shadow-xs">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="group-hover:scale-105 transition-transform">
              <BearLogo size="sm" noFloat />
            </div>
            <div>
              <span className="font-semibold text-base sm:text-lg text-foreground tracking-tight flex items-center gap-1.5">
                Bear Café
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-honey/15 text-bear-brown dark:text-honey border border-honey/25 inline-flex items-center gap-1">
                  <Bot className="w-3 h-3 text-honey" />
                  Kuma Bot
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <AnimatedThemeToggler variant="circle" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(isAuthenticated ? '/' : '/login')}
              className="rounded-xl border-border hover:bg-secondary text-xs sm:text-sm font-medium bg-card"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              {isAuthenticated ? 'กลับหน้าหลัก' : 'เข้าสู่ระบบ'}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8 lg:gap-8 flex-1">
        {/* Hero Banner */}
        <motion.div
          initial={{ opacity: 0.92, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative h-[200px] sm:h-[230px] lg:h-[250px] overflow-hidden rounded-2xl bg-cover bg-center bg-no-repeat sm:rounded-3xl shadow-sm"
          style={{
            backgroundImage:
              "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.65) 50%, rgba(0,0,0,0.45) 100%), url('/banner/welcome_banner.jpg')",
          }}
        >
          <div className="flex h-full flex-col justify-end gap-2 px-4 pb-5 sm:justify-center sm:gap-2.5 sm:px-8 sm:pb-0 lg:px-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold backdrop-blur-md border border-amber-500/30">
                <FileText className="w-3.5 h-3.5" />
                Terms of Service
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white/90 text-xs font-medium backdrop-blur-md border border-white/15">
                Kuma Bot (บอทคุมะ)
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight">
              ข้อกำหนดและเงื่อนไขการให้บริการ
            </h1>

            <p className="text-xs sm:text-sm font-normal text-[#D6C3B5] max-w-2xl leading-relaxed">
              ข้อกำหนดการใช้งานระหว่างผู้ให้บริการทีมงาน Bear Café และผู้ใช้งาน Kuma Bot บน Discord
            </p>

            {/* Date Badges */}
            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] sm:text-xs text-white/80">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-honey" />
                มีผลบังคับใช้: 30 ตุลาคม 2026
              </span>
              <span className="text-white/40">•</span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-honey" />
                อัปเดตล่าสุด: 30 ตุลาคม 2026
              </span>
            </div>
          </div>
        </motion.div>

        {/* Navigation Tabs between Terms & Privacy */}
        <PolicyNavTabs showBackToHome={false} variant="kuma" />

        {/* Mobile Quick Jump TOC Accordion */}
        <div className="lg:hidden">
          <div className="rounded-2xl border border-border/80 bg-card/80 p-3.5 shadow-xs">
            <button
              onClick={() => setMobileTocOpen(!mobileTocOpen)}
              className="w-full flex items-center justify-between text-xs sm:text-sm font-semibold text-foreground cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-honey" />
                <span>สารบัญหัวข้อ (คลิกเพื่อเลือกหัวข้อที่ต้องการอ่าน)</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform ${
                  mobileTocOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {mobileTocOpen && (
              <div className="mt-3 pt-3 border-t border-border/70 space-y-1">
                {TOC_SECTIONS.map((sec) => {
                  const Icon = sec.icon;
                  const isActive = activeSection === sec.id;
                  return (
                    <button
                      key={sec.id}
                      onClick={() => scrollToSection(sec.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all text-left cursor-pointer ${
                        isActive
                          ? 'bg-amber-500/15 text-bear-brown dark:text-amber-300 font-semibold border border-amber-500/30'
                          : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`} />
                      <span className="truncate">{sec.title}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Content Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Sticky Table of Contents (Desktop) */}
          <aside className="hidden lg:block lg:col-span-4 sticky top-24">
            <div className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-xs backdrop-blur-sm space-y-2">
              <div className="flex items-center gap-2 pb-3 border-b border-border/70">
                <FileText className="w-4 h-4 text-honey" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  สารบัญหัวข้อ (Contents)
                </span>
              </div>

              <nav className="space-y-1 max-h-[calc(100vh-220px)] overflow-y-auto no-scrollbar pr-1">
                {TOC_SECTIONS.map((sec) => {
                  const Icon = sec.icon;
                  const isActive = activeSection === sec.id;
                  return (
                    <button
                      key={sec.id}
                      onClick={() => scrollToSection(sec.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all text-left cursor-pointer ${
                        isActive
                          ? 'bg-amber-500/15 text-bear-brown dark:text-amber-300 font-semibold border border-amber-500/30 shadow-xs'
                          : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`} />
                      <span className="truncate">{sec.shortTitle}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Cross Link to Privacy Policy */}
              <div className="pt-3 border-t border-border/70 text-xs sm:text-sm space-y-2">
                <Link
                  to="/privacy-policy"
                  className="text-honey hover:underline flex items-center justify-between font-medium group"
                >
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>นโยบายความเป็นส่วนตัว (Privacy)</span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/50 text-[11px] text-muted-foreground leading-relaxed">
                  บริการ: <strong>Kuma Bot</strong> โดย Bear Café
                  <br />
                  ผู้รับผิดชอบ: <strong>zeab1u</strong>
                </div>
              </div>
            </div>
          </aside>

          {/* Right Content Column */}
          <div className="lg:col-span-8 space-y-8">
            {/* บทนำ (Introduction) */}
            <section
              id="intro"
              className="scroll-mt-24 rounded-2xl border border-border/70 bg-card/70 p-6 sm:p-7 shadow-xs space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                  <HeartHandshake className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                    บทนำและการยอมรับข้อกำหนด
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    ข้อตกลงการใช้งานบริการ Kuma Bot (บอทคุมะ)
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm sm:text-base font-normal text-muted-foreground leading-relaxed">
                <p>
                  ยินดีต้อนรับสู่ <strong className="font-semibold text-foreground">Kuma Bot</strong> (“บอทคุมะ”, “เรา”, “ผู้ให้บริการ” หรือ “บริการ”) ซึ่งพัฒนาและดูแลโดยทีมงาน Bear Café
                </p>
                <p>
                  ข้อกำหนดฉบับนี้กำหนดเงื่อนไขการใช้งานระหว่างผู้ให้บริการกับผู้ใช้งาน ไม่ว่าจะเป็นเจ้าของเซิร์ฟเวอร์ ผู้ดูแลระบบ หรือสมาชิกทั่วไป (“คุณ” หรือ “ผู้ใช้”)
                </p>
                <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-foreground space-y-2">
                  <p className="font-medium text-sm sm:text-base flex items-center gap-2 text-bear-brown dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-honey" />
                    การรับทราบและยอมรับข้อกำหนด:
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-6">
                    การเชิญ Kuma Bot เข้าสู่เซิร์ฟเวอร์ Discord การใช้คำสั่ง หรือการใช้งานฟังก์ชันต่าง ๆ ถือว่าคุณรับทราบข้อกำหนดฉบับนี้ <strong>หากคุณไม่ยอมรับข้อกำหนด กรุณาหยุดใช้งานบริการทันที</strong>
                  </p>
                </div>
              </div>
            </section>

            {/* หมวด 1: ข้อมูลทั่วไปและลักษณะการให้บริการ */}
            <section
              id="section-1"
              className="scroll-mt-24 rounded-2xl border border-border/70 bg-card/70 p-6 sm:p-7 shadow-xs space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                    1. ข้อมูลทั่วไปและลักษณะการให้บริการ
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    ขอบเขตการทำงานของบอทและการปฏิบัติตามกฎเกณฑ์ Discord
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm sm:text-base font-normal text-muted-foreground leading-relaxed">
                {/* 1.1 */}
                <div className="p-4 sm:p-5 rounded-2xl bg-secondary/35 border border-border/70 space-y-2">
                  <h3 className="font-semibold text-foreground text-sm sm:text-base flex items-center gap-2">
                    <Gamepad2 className="w-4 h-4 text-honey" />
                    1.1 รูปแบบบริการ
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Kuma Bot เป็นบอทสาธารณะบน Discord ที่ให้บริการระบบมินิเกม ระบบสะสมคะแนนและจัดอันดับ (Leaderboard) ร้านค้าแลกรางวัลประจำเซิร์ฟเวอร์ และระบบต้อนรับสมาชิก รวมถึงฟังก์ชันอื่นที่อาจเพิ่มขึ้นในอนาคต
                  </p>
                </div>

                {/* 1.2 */}
                <div className="p-4 sm:p-5 rounded-2xl bg-secondary/35 border border-border/70 space-y-2">
                  <h3 className="font-semibold text-foreground text-sm sm:text-base flex items-center gap-2">
                    <Layers className="w-4 h-4 text-honey" />
                    1.2 การแยกข้อมูลระหว่างเซิร์ฟเวอร์
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    ระบบออกแบบให้ข้อมูลการตั้งค่า คะแนน และสถิติแยกตามรหัสเซิร์ฟเวอร์ Discord (Guild ID) <strong className="font-medium text-foreground">คะแนนที่สะสมในเซิร์ฟเวอร์หนึ่งไม่สามารถนำไปใช้ในอีกเซิร์ฟเวอร์หนึ่งได้</strong>
                  </p>
                </div>

                {/* 1.3 */}
                <div className="p-4 sm:p-5 rounded-2xl bg-secondary/35 border border-border/70 space-y-2">
                  <h3 className="font-semibold text-foreground text-sm sm:text-base flex items-center gap-2">
                    <Globe className="w-4 h-4 text-honey" />
                    1.3 การปฏิบัติตามข้อกำหนดของ Discord
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    การใช้งาน Kuma Bot ต้องเป็นไปตาม{' '}
                    <a
                      href="https://discord.com/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-honey hover:underline inline-flex items-center gap-0.5 font-medium"
                    >
                      ข้อกำหนดการให้บริการของ Discord (Discord Terms of Service)
                      <ExternalLink className="w-3 h-3" />
                    </a>{' '}
                    และ{' '}
                    <a
                      href="https://discord.com/guidelines"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-honey hover:underline inline-flex items-center gap-0.5 font-medium"
                    >
                      แนวทางปฏิบัติของชุมชน Discord (Community Guidelines)
                      <ExternalLink className="w-3 h-3" />
                    </a>{' '}
                    รวมถึงกฎหมายที่เกี่ยวข้อง
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    หากพบการใช้งานที่ละเมิดข้อกำหนดหรือสร้างความเสี่ยงต่อบริการ เราอาจจำกัดหรือระงับการใช้งานตามความเหมาะสม
                  </p>
                </div>
              </div>
            </section>

            {/* หมวด 2: สิทธิ์ที่จำเป็นสำหรับการทำงาน */}
            <section
              id="section-2"
              className="scroll-mt-24 rounded-2xl border-2 border-honey/40 bg-card/70 p-6 sm:p-7 shadow-xs space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                    2. สิทธิ์ที่จำเป็นสำหรับการทำงาน
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    Discord Permissions และ Privileged Intents ที่ระบบจำเป็นต้องใช้
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm sm:text-base font-normal text-muted-foreground leading-relaxed">
                {/* 2.1 */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground text-sm sm:text-base">
                    2.1 Discord Permissions
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Kuma Bot อาจต้องใช้สิทธิ์ต่อไปนี้ตามฟังก์ชันที่เปิดใช้งาน:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-secondary/35 space-y-1">
                      <div className="font-medium text-xs sm:text-sm text-foreground flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        Send Messages
                      </div>
                      <p className="text-xs text-muted-foreground">สำหรับส่งข้อความและโจทย์มินิเกม</p>
                    </div>

                    <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-secondary/35 space-y-1">
                      <div className="font-medium text-xs sm:text-sm text-foreground flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        Embed Links
                      </div>
                      <p className="text-xs text-muted-foreground">สำหรับแสดงข้อความแบบ Embed</p>
                    </div>

                    <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-secondary/35 space-y-1">
                      <div className="font-medium text-xs sm:text-sm text-foreground flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        Attach Files
                      </div>
                      <p className="text-xs text-muted-foreground">สำหรับส่งภาพหรือไฟล์ที่จำเป็นต่อเกม</p>
                    </div>

                    <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-secondary/35 space-y-1">
                      <div className="font-medium text-xs sm:text-sm text-foreground flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        Use External Emojis
                      </div>
                      <p className="text-xs text-muted-foreground">สำหรับแสดงอีโมจิภายนอก หากมีการใช้งาน</p>
                    </div>

                    <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-secondary/35 space-y-1">
                      <div className="font-medium text-xs sm:text-sm text-foreground flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        Read Message History
                      </div>
                      <p className="text-xs text-muted-foreground">สำหรับอ่านประวัติข้อความที่จำเป็นต่อฟังก์ชันที่กำหนด</p>
                    </div>

                    <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-secondary/35 space-y-1">
                      <div className="font-medium text-xs sm:text-sm text-foreground flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        Manage Channels
                      </div>
                      <p className="text-xs text-muted-foreground">สำหรับคำสั่ง /setup-games ซึ่งใช้สร้างหรือจัดการช่องและหมวดหมู่ตามที่ระบบรองรับ</p>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground italic">
                    * สิทธิ์ที่จำเป็นจริงอาจแตกต่างกันตามฟังก์ชันที่เปิดใช้งาน ผู้ดูแลเซิร์ฟเวอร์ควรตรวจสอบสิทธิ์ก่อนอนุญาตให้บอททำงาน
                  </p>
                </div>

                {/* 2.2 */}
                <div className="p-4 sm:p-5 rounded-2xl bg-secondary/35 border border-border/70 space-y-2.5">
                  <h3 className="font-semibold text-foreground text-sm sm:text-base flex items-center gap-2">
                    <Radio className="w-4 h-4 text-honey" />
                    2.2 Privileged Intents
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    ระบบอาจใช้ <strong className="text-foreground">Message Content Intent</strong> เพื่อตรวจคำตอบในช่องมินิเกมที่กำหนด และ <strong className="text-foreground">Guild Members Intent</strong> สำหรับฟังก์ชันที่เกี่ยวข้องกับข้อมูลสมาชิกและการต้อนรับ
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    การใช้งาน Intent เหล่านี้ต้องเป็นไปตามข้อกำหนดและการตั้งค่าที่ Discord อนุญาต
                  </p>
                </div>
              </div>
            </section>

            {/* หมวด 3: แผนการใช้งาน */}
            <section
              id="section-3"
              className="scroll-mt-24 rounded-2xl border border-border/70 bg-card/70 p-6 sm:p-7 shadow-xs space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                    3. แผนการใช้งาน (Plans & Quotas)
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    สิทธิประโยชน์และเงื่อนไขของแผน Standard และ Premium
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 3.1 Standard */}
                <div className="p-5 rounded-2xl border border-border/80 bg-secondary/30 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-base text-foreground">3.1 Standard Plan</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                        แผนฟรี
                      </span>
                    </div>
                    <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground list-disc list-inside leading-relaxed">
                      <li>เปิดใช้งานมินิเกมพร้อมกันได้สูงสุด <strong>5 เกมต่อเซิร์ฟเวอร์</strong> ตามโควตาที่ระบบกำหนด</li>
                      <li>ใช้งานมินิเกมทั่วไปที่รองรับในแผนฟรี เช่น เกมคำศัพท์ คำแปล หรือคณิตศาสตร์</li>
                      <li>คำสั่ง <code className="text-xs px-1.5 py-0.5 rounded bg-muted">/setup-games</code> จะสร้างห้องได้ตามโควตาที่เหลือและข้อจำกัดของระบบ</li>
                    </ul>
                  </div>
                </div>

                {/* 3.2 Premium */}
                <div className="p-5 rounded-2xl border-2 border-honey/40 bg-honey/10 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-base text-bear-brown dark:text-amber-300 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-honey" />
                        3.2 Premium Plan
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-honey text-bear-dark shadow-xs">
                        พรีเมียม
                      </span>
                    </div>
                    <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground list-disc list-inside leading-relaxed">
                      <li>ปลดล็อกมินิเกมที่รองรับในแผนพรีเมียม รวมถึงเกมที่ใช้ภาพ Canvas และเสียงสังเคราะห์ TTS</li>
                      <li>ใช้งานห้องมินิเกมได้ตามขีดความสามารถของระบบ โดยไม่ติดโควตาห้องแบบแผนฟรี</li>
                      <li>เข้าถึงการตั้งค่าขั้นสูง ระบบตัวคูณแต้ม และฟังก์ชันร้านค้าตามสิทธิ์ของแผน</li>
                    </ul>
                  </div>

                  <div className="pt-2 border-t border-honey/25 text-xs text-muted-foreground leading-relaxed">
                    <strong>การสิ้นสุดสิทธิ์:</strong> สิทธิ์ Premium สิ้นสุดเมื่อครบระยะเวลาที่สมัคร หากไม่มีการต่ออายุ ระบบจะปรับกลับเป็น Standard Plan โดยอัตโนมัติ เกมที่เกินโควตาฟรีอาจหยุดส่งโจทย์ใหม่ชั่วคราว แต่ห้องจะไม่ถูกลบเพียงเพราะสิทธิ์ Premium หมดอายุ
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground italic">
                * รายละเอียดสิทธิ์และข้อจำกัดให้เป็นไปตามข้อมูลแพ็กเกจที่แสดง ณ เวลาที่สมัครใช้งาน
              </p>
            </section>

            {/* หมวด 4: แต้มเสมือนจริงและของรางวัล */}
            <section
              id="section-4"
              className="scroll-mt-24 rounded-2xl border border-border/70 bg-card/70 p-6 sm:p-7 shadow-xs space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                    4. แต้มเสมือนจริงและของรางวัล
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    ข้อกำหนดเกี่ยวกับแต้มในเกม ระบบร้านค้า และความรับผิดชอบ
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm sm:text-base font-normal text-muted-foreground leading-relaxed">
                {/* 4.1 */}
                <div className="p-4 sm:p-5 rounded-2xl bg-secondary/35 border border-border/70 space-y-2">
                  <h3 className="font-semibold text-foreground text-sm sm:text-base">
                    4.1 สถานะของแต้ม (Virtual Currency Only)
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    แต้มที่ได้รับจากการเล่นมินิเกมเป็นแต้มเสมือนจริงสำหรับการใช้งานภายในเซิร์ฟเวอร์ Discord เท่านั้น <strong className="font-medium text-foreground">ไม่มีมูลค่าเป็นเงินจริง และไม่สามารถแลกเป็นเงินสด สกุลเงินดิจิทัล หรือทรัพย์สินอื่นที่มีมูลค่าทางการเงินจากผู้ให้บริการได้</strong>
                  </p>
                </div>

                {/* 4.2 */}
                <div className="p-4 sm:p-5 rounded-2xl bg-secondary/35 border border-border/70 space-y-2">
                  <h3 className="font-semibold text-foreground text-sm sm:text-base">
                    4.2 ความรับผิดชอบเกี่ยวกับร้านค้าของเซิร์ฟเวอร์
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    ของรางวัลที่เจ้าของเซิร์ฟเวอร์กำหนดผ่านระบบร้านค้า เช่น <code className="text-xs px-1.5 py-0.5 rounded bg-muted">/setting-store</code> หรือ <code className="text-xs px-1.5 py-0.5 rounded bg-muted">/open-store</code> อยู่ภายใต้การจัดการและความรับผิดชอบของเจ้าของเซิร์ฟเวอร์นั้น
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    ผู้ให้บริการ Kuma Bot ไม่ใช่ผู้จำหน่ายหรือผู้รับประกันการส่งมอบของรางวัลที่เจ้าของเซิร์ฟเวอร์นำมาเสนอ และไม่รับผิดชอบต่อข้อพิพาทระหว่างเจ้าของเซิร์ฟเวอร์กับสมาชิก ทั้งนี้ ภายใต้ขอบเขตที่กฎหมายอนุญาต
                  </p>
                </div>

                {/* 4.3 */}
                <div className="p-4 sm:p-5 rounded-2xl bg-secondary/35 border border-border/70 space-y-2">
                  <h3 className="font-semibold text-foreground text-sm sm:text-base">
                    4.3 การปรับปรุงหรือรีเซ็ตคะแนน
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    คะแนน สถิติ และข้อมูลการเล่นอาจถูกปรับปรุง รีเซ็ต หรือแก้ไขเมื่อจำเป็นต่อการดูแลระบบ ป้องกันการทุจริต หรือจัดกิจกรรม โดยอาจมีหรือไม่มีการแจ้งล่วงหน้าตามสถานการณ์
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    เราไม่รับประกันว่าคะแนนหรือสถิติจะคงอยู่ตลอดไป และจะพิจารณาการแก้ไขปัญหาตามข้อเท็จจริงและข้อกำหนดที่เกี่ยวข้อง
                  </p>
                </div>
              </div>
            </section>

            {/* หมวด 5: ข้อกำหนดการใช้งานที่ยอมรับได้ */}
            <section
              id="section-5"
              className="scroll-mt-24 rounded-2xl border border-border/70 bg-card/70 p-6 sm:p-7 shadow-xs space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                    5. ข้อกำหนดการใช้งานที่ยอมรับได้
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    ข้อห้ามในการใช้งาน และมาตรการเมื่อตรวจพบการฝ่าฝืน
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm sm:text-base font-normal text-muted-foreground leading-relaxed">
                <p>ผู้ใช้งานต้องไม่กระทำการดังต่อไปนี้:</p>

                <div className="space-y-3">
                  <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      ✕
                    </span>
                    <div>
                      <h4 className="font-semibold text-foreground text-xs sm:text-sm">
                        5.1 การโกงหรือใช้ระบบอัตโนมัติโดยมิชอบ
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        ห้ามใช้โปรแกรม สคริปต์ มาโคร หรือเครื่องมืออัตโนมัติเพื่อโกงเกม ปั๊มคะแนน หรือหลีกเลี่ยงข้อจำกัดของระบบ
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      ✕
                    </span>
                    <div>
                      <h4 className="font-semibold text-foreground text-xs sm:text-sm">
                        5.2 การสแปมและการโจมตีระบบ
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        ห้ามส่งคำสั่งหรือคำขอซ้ำ ๆ เพื่อรบกวนบริการ หลีกเลี่ยง Rate Limit เจาะระบบ ใช้ประโยชน์จากช่องโหว่โดยมิชอบ หรือกระทำการที่ทำให้ระบบไม่สามารถให้บริการได้ตามปกติ
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      ✕
                    </span>
                    <div>
                      <h4 className="font-semibold text-foreground text-xs sm:text-sm">
                        5.3 การใช้ฟังก์ชันเพื่อสร้างเนื้อหาที่ไม่เหมาะสม
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        ห้ามใช้ชื่อไอเทม ข้อความต้อนรับ หรือข้อความที่ตั้งค่าผ่านระบบเพื่อเผยแพร่เนื้อหาที่ผิดกฎหมาย หลอกลวง ข่มขู่ คุกคาม สร้างความเกลียดชัง หรือฝ่าฝืนข้อกำหนดของ Discord
                      </p>
                    </div>
                  </div>
                </div>

                {/* 5.4 มาตรการ */}
                <div className="p-4 sm:p-5 rounded-2xl bg-secondary/35 border border-border/70 space-y-2.5">
                  <h3 className="font-semibold text-foreground text-sm sm:text-base flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-honey" />
                    5.4 มาตรการเมื่อพบการละเมิด
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    เมื่อพบการละเมิด เราอาจดำเนินมาตรการตามความรุนแรงของเหตุการณ์ เช่น:
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-1 text-xs sm:text-sm text-muted-foreground">
                    <li>ลบหรือรีเซ็ตคะแนนที่ได้จากการทุจริต</li>
                    <li>จำกัดหรือระงับสิทธิ์การเล่นของผู้ใช้ใน Kuma Bot</li>
                    <li>จำกัดหรือระงับการให้บริการแก่เซิร์ฟเวอร์ที่เกี่ยวข้อง</li>
                    <li>ระงับสิทธิ์ Premium หรือดำเนินการอื่นที่จำเป็นและเหมาะสม</li>
                  </ul>
                  <p className="text-xs text-muted-foreground pt-1">
                    การคืนเงินหรือการยุติสิทธิ์บริการแบบชำระเงินจะพิจารณาตามเงื่อนไขของแพ็กเกจ ข้อเท็จจริง และกฎหมายที่ใช้บังคับ โดยไม่ตัดสิทธิ์ตามกฎหมายของผู้ใช้
                  </p>
                </div>
              </div>
            </section>

            {/* หมวด 6: ความพร้อมให้บริการและข้อจำกัดความรับผิด */}
            <section
              id="section-6"
              className="scroll-mt-24 rounded-2xl border border-border/70 bg-card/70 p-6 sm:p-7 shadow-xs space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                    6. ความพร้อมให้บริการและข้อจำกัดความรับผิด
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    ข้อตกลงเกี่ยวกับการบำรุงรักษาและขอบเขตความรับผิดชอบ
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm sm:text-base font-normal text-muted-foreground leading-relaxed">
                <div className="p-4 sm:p-5 rounded-2xl bg-secondary/35 border border-border/70 space-y-2">
                  <h3 className="font-semibold text-foreground text-sm sm:text-base">
                    6.1 ความพร้อมให้บริการ (Service Availability)
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    เราใช้ความพยายามตามสมควรเพื่อให้ Kuma Bot ทำงานได้อย่างต่อเนื่อง แต่ไม่สามารถรับประกันได้ว่าบริการจะพร้อมใช้งานตลอดเวลา ปราศจากข้อผิดพลาด หรือไม่มีการหยุดชะงัก
                  </p>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-secondary/35 border border-border/70 space-y-2">
                  <h3 className="font-semibold text-foreground text-sm sm:text-base">
                    6.2 การบำรุงรักษา (Maintenance)
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    เราอาจรีสตาร์ตระบบ ปรับปรุงซอฟต์แวร์ ปิดให้บริการชั่วคราว หรือเปลี่ยนแปลงฟังก์ชันเพื่อความปลอดภัยและเสถียรภาพของระบบ โดยจะแจ้งให้ทราบล่วงหน้าเมื่อสามารถทำได้ตามความเหมาะสม
                  </p>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-secondary/35 border border-border/70 space-y-2.5">
                  <h3 className="font-semibold text-foreground text-sm sm:text-base">
                    6.3 ข้อจำกัดความรับผิด (Limitation of Liability)
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    ภายใต้ขอบเขตที่กฎหมายอนุญาต เราไม่รับผิดชอบต่อความเสียหายที่เกิดจากเหตุซึ่งอยู่นอกเหนือการควบคุมตามสมควร เช่น:
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-1 text-xs sm:text-sm text-muted-foreground">
                    <li>การสูญหายหรือความเสียหายของข้อมูลจากเหตุขัดข้อง</li>
                    <li>การหยุดให้บริการของ Discord API หรือผู้ให้บริการโครงสร้างพื้นฐาน</li>
                    <li>ปัญหาจากการตั้งค่า การจัดการช่อง หรือการดำเนินการของผู้ดูแลเซิร์ฟเวอร์</li>
                    <li>ข้อพิพาทระหว่างสมาชิกกับเจ้าของเซิร์ฟเวอร์เกี่ยวกับกิจกรรมหรือของรางวัล</li>
                  </ul>
                  <p className="text-xs text-muted-foreground pt-1">
                    ข้อกำหนดนี้ไม่ตัดสิทธิ์หรือจำกัดความรับผิดในกรณีที่กฎหมายไม่อนุญาตให้ยกเว้นหรือจำกัดความรับผิดดังกล่าว
                  </p>
                </div>
              </div>
            </section>

            {/* หมวด 7: การเปลี่ยนแปลงบริการและข้อกำหนด */}
            <section
              id="section-7"
              className="scroll-mt-24 rounded-2xl border border-border/70 bg-card/70 p-6 sm:p-7 shadow-xs space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                    7. การเปลี่ยนแปลงบริการและข้อกำหนด
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    ขั้นตอนการปรับปรุงแก้ไขข้อกำหนดในอนาคต
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-sm sm:text-base font-normal text-muted-foreground leading-relaxed">
                <p>
                  เราอาจปรับปรุงฟังก์ชัน ราคาแพ็กเกจ หรือข้อกำหนดนี้ตามความจำเป็น การเปลี่ยนแปลงจะระบุวันที่อัปเดตไว้บนหน้าเอกสาร และจะมีผลตามที่ระบุในการประกาศหรือข้อกำหนดที่เกี่ยวข้อง
                </p>
                <p>
                  หากมีการเปลี่ยนแปลงสาระสำคัญ เราจะพยายามแจ้งให้ทราบตามความเหมาะสม การใช้งานต่อหลังจากวันที่มีผลอาจถือเป็นการยอมรับข้อกำหนดใหม่เฉพาะในขอบเขตที่กฎหมายอนุญาต
                </p>
              </div>
            </section>

            {/* หมวด 8: ช่องทางติดต่อ */}
            <section
              id="section-8"
              className="scroll-mt-24 rounded-2xl border border-border/70 bg-card/70 p-6 sm:p-7 shadow-xs space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                    8. ช่องทางติดต่อทีมงาน
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    ติดต่อทีมพัฒนาและผู้ดูแลระบบ Kuma Bot
                  </p>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-muted-foreground">
                หากมีคำถาม ข้อสงสัย หรือข้อเสนอแนะเกี่ยวกับข้อกำหนดการให้บริการ สามารถติดต่อทีมงานได้ที่:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Email */}
                <a
                  href="mailto:bearcafe.work@gmail.com"
                  className="p-4 rounded-2xl border border-border/70 bg-card hover:bg-secondary/40 hover:border-honey/40 transition-all flex items-center gap-3.5 group shadow-xs cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">อีเมลติดต่อ (Official Email)</p>
                    <p className="text-xs sm:text-sm font-semibold text-foreground group-hover:text-honey transition-colors truncate">
                      bearcafe.work@gmail.com
                    </p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-honey transition-colors" />
                </a>

                {/* Discord Community */}
                <a
                  href="https://discord.gg/EHHybsbHxD"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-2xl border border-border/70 bg-card hover:bg-secondary/40 hover:border-honey/40 transition-all flex items-center gap-3.5 group shadow-xs cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                    <img
                      src="/icons/discord-icon.png"
                      alt="Discord Icon"
                      className="w-10 h-10 object-contain rounded-full shadow-xs"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Discord Community</p>
                    <p className="text-xs sm:text-sm font-semibold text-honey group-hover:underline truncate">
                      เข้าร่วมเซิร์ฟเวอร์ช่วยเหลือ
                    </p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-honey" />
                </a>

                {/* Responsible Person */}
                <div className="p-4 rounded-2xl border border-border/70 bg-secondary/35 flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0 font-bold text-sm">
                    🐻
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">ผู้พัฒนาและดูแล</p>
                    <p className="text-xs sm:text-sm font-semibold text-foreground">
                      ทีมงาน Bear Café (ผู้รับผิดชอบ: zeab1u)
                    </p>
                  </div>
                </div>

                {/* Official Website */}
                <a
                  href="https://bearcafe4commu.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-2xl border border-border/70 bg-card hover:bg-secondary/40 hover:border-honey/40 transition-all flex items-center gap-3.5 group shadow-xs cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">เว็บไซต์หลัก (Website)</p>
                    <p className="text-xs sm:text-sm font-semibold text-foreground group-hover:text-honey transition-colors truncate">
                      bearcafe4commu.vercel.app
                    </p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-honey transition-colors" />
                </a>
              </div>
            </section>

            {/* เอกสารที่เกี่ยวข้อง (Related Document Callout) */}
            <section
              id="section-related"
              className="scroll-mt-24 rounded-2xl border-2 border-honey/40 bg-gradient-to-br from-card to-honey/10 p-6 sm:p-7 shadow-xs space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
                    เอกสารที่เกี่ยวข้อง (Related Policies)
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    ทำความเข้าใจการคุ้มครองข้อมูลและสิทธิความเป็นส่วนตัวของคุณ
                  </p>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                อ่าน{' '}
                <Link
                  to="/privacy-policy"
                  className="font-semibold text-honey hover:underline inline-flex items-center gap-1"
                >
                  นโยบายความเป็นส่วนตัว (Privacy Policy)
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>{' '}
                เพื่อทำความเข้าใจเกี่ยวกับข้อมูลที่ Kuma Bot เก็บรวบรวมและวิธีการใช้งานข้อมูล
              </p>

              <div className="pt-2">
                <Button
                  onClick={() => navigate('/privacy-policy')}
                  className="rounded-xl bg-honey hover:bg-honey-dark text-bear-dark font-medium shadow-xs text-xs sm:text-sm"
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  เปิดหน้านโยบายความเป็นส่วนตัว Kuma Bot
                </Button>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Floating Scroll to Top Button */}
      {showScrollTop && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 p-3 rounded-2xl bg-card border border-border shadow-lg hover:bg-secondary text-foreground transition-all cursor-pointer"
          aria-label="Scroll to top"
        >
          <ArrowUp className="w-5 h-5 text-honey" />
        </motion.button>
      )}

      {/* Footer */}
      <CozyPageFooter />
    </div>
  );
}

