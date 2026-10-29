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
  ShieldCheck,
  ShieldAlert,
  Database,
  Lock,
  UserCheck,
  Server,
  ArrowLeft,
  ArrowUp,
  ExternalLink,
  Mail,
  Calendar,
  Clock,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Bot,
  Layers,
  Globe,
  Radio,
  VolumeX,
  MessageSquareOff,
  CreditCard,
  Trash2,
  FileText,
  Sparkles,
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
    title: 'บทนำและหลักการคุ้มครองข้อมูล (PDPA)',
    shortTitle: 'บทนำ',
    icon: ShieldCheck,
  },
  {
    id: 'section-1',
    title: '1. ข้อมูลที่เราเก็บรวบรวม (Guild & User Data)',
    shortTitle: '1. ข้อมูลที่จัดเก็บ',
    icon: Database,
  },
  {
    id: 'section-2',
    title: '2. ข้อมูลที่เราไม่เก็บรวบรวม (Zero Voice & No Chat Logs)',
    shortTitle: '2. ข้อมูลที่ไม่เก็บ',
    icon: VolumeX,
  },
  {
    id: 'section-3',
    title: '3. วัตถุประสงค์ในการใช้ข้อมูล',
    shortTitle: '3. วัตถุประสงค์การใช้',
    icon: Layers,
  },
  {
    id: 'section-4',
    title: '4. ผู้ให้บริการภายนอกและการเปิดเผยข้อมูล (Discord, Supabase, TTS)',
    shortTitle: '4. ผู้ให้บริการภายนอก',
    icon: Server,
  },
  {
    id: 'section-5',
    title: '5. ระยะเวลาในการเก็บรักษาข้อมูล (Data Retention)',
    shortTitle: '5. ระยะเวลาเก็บรักษา',
    icon: Trash2,
  },
  {
    id: 'section-6',
    title: '6. สิทธิของเจ้าของข้อมูลส่วนบุคคล (PDPA Rights)',
    shortTitle: '6. สิทธิของเจ้าของข้อมูล',
    icon: UserCheck,
  },
  {
    id: 'section-7',
    title: '7. มาตรการรักษาความปลอดภัย',
    shortTitle: '7. ความปลอดภัยข้อมูล',
    icon: Lock,
  },
  {
    id: 'section-8',
    title: '8. การเปลี่ยนแปลงนโยบายความเป็นส่วนตัว',
    shortTitle: '8. การเปลี่ยนแปลงนโยบาย',
    icon: Clock,
  },
  {
    id: 'section-9',
    title: '9. ติดต่อเรา (Contact Information)',
    shortTitle: '9. ติดต่อเรา',
    icon: Mail,
  },
  {
    id: 'section-related',
    title: 'เอกสารที่เกี่ยวข้อง (Terms of Service)',
    shortTitle: 'ข้อกำหนดการให้บริการ',
    icon: FileText,
  },
];

export default function KumaPrivacyPage() {
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
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold backdrop-blur-md border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                Privacy Policy
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white/90 text-xs font-medium backdrop-blur-md border border-white/15">
                Kuma Bot (บอทคุมะ)
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight">
              นโยบายความเป็นส่วนตัว
            </h1>

            <p className="text-xs sm:text-sm font-normal text-[#D6C3B5] max-w-2xl leading-relaxed">
              การเก็บรวบรวม การใช้งาน การคุ้มครองข้อมูล และสิทธิความเป็นส่วนตัวตามกฎหมาย PDPA ของ Kuma Bot
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
                <ShieldCheck className="w-4 h-4 text-honey" />
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
                <ShieldCheck className="w-4 h-4 text-honey" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  สารบัญนโยบาย (Privacy TOC)
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

              {/* Cross Link to Terms of Service */}
              <div className="pt-3 border-t border-border/70 text-xs sm:text-sm space-y-2">
                <Link
                  to="/term-of-service"
                  className="text-honey hover:underline flex items-center justify-between font-medium group"
                >
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>ข้อกำหนดการให้บริการ (Terms)</span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/50 text-[11px] text-muted-foreground leading-relaxed">
                  คุ้มครองข้อมูลตาม <strong>PDPA</strong>
                  <br />
                  ผู้ดูแลระบบ: <strong>zeab1u</strong>
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
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                    บทนำและหลักการคุ้มครองข้อมูล
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    เจตนารมณ์ในการคุ้มครองข้อมูลส่วนบุคคลของ Kuma Bot
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm sm:text-base font-normal text-muted-foreground leading-relaxed">
                <p>
                  <strong className="font-semibold text-foreground">Kuma Bot</strong> (“เรา” หรือ “ผู้ให้บริการ”) พัฒนาและดูแลโดยทีมงาน Bear Café เราให้ความสำคัญกับความเป็นส่วนตัวและการคุ้มครองข้อมูลส่วนบุคคลของผู้ใช้งาน
                </p>
                <p>
                  นโยบายฉบับนี้อธิบายประเภทข้อมูลที่เราเก็บรวบรวม วิธีการใช้ข้อมูล การเปิดเผยข้อมูล ระยะเวลาเก็บรักษา มาตรการรักษาความปลอดภัย และสิทธิของเจ้าของข้อมูล โดยมีวัตถุประสงค์เพื่อให้ผู้ใช้งานเข้าใจการทำงานของบริการและสามารถใช้สิทธิของตนได้อย่างเหมาะสม
                </p>
                <div className="p-4 sm:p-5 rounded-2xl bg-secondary/35 border border-border/70 space-y-1.5">
                  <p className="font-semibold text-foreground text-xs sm:text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-honey" />
                    กฎหมายที่เกี่ยวข้อง:
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    การประมวลผลข้อมูลจะดำเนินการตามกฎหมายคุ้มครองข้อมูลส่วนบุคคลที่ใช้บังคับ รวมถึงพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA) ในกรณีที่เกี่ยวข้อง
                  </p>
                </div>
              </div>
            </section>

            {/* หมวด 1: ข้อมูลที่เราเก็บรวบรวม */}
            <section
              id="section-1"
              className="scroll-mt-24 rounded-2xl border border-border/70 bg-card/70 p-6 sm:p-7 shadow-xs space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                    1. ข้อมูลที่เราเก็บรวบรวม
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    จัดเก็บเฉพาะข้อมูลที่จำเป็นต่อการให้บริการและการทำงานของบอท
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm sm:text-base font-normal text-muted-foreground leading-relaxed">
                <p>
                  เราเก็บรวบรวมข้อมูลเท่าที่จำเป็นต่อการให้บริการ ดูแลความปลอดภัย และรักษาการทำงานของ Kuma Bot โดยข้อมูลอาจแบ่งออกเป็นประเภทต่อไปนี้:
                </p>

                {/* 1.1 Guild Data */}
                <div className="p-4 sm:p-5 rounded-2xl bg-secondary/35 border border-border/70 space-y-3">
                  <h3 className="font-semibold text-foreground text-sm sm:text-base flex items-center gap-2">
                    <Server className="w-4 h-4 text-honey" />
                    1.1 ข้อมูลระดับเซิร์ฟเวอร์ (Guild Data)
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    เมื่อมีการเชิญบอทเข้าร่วมเซิร์ฟเวอร์หรือมีการตั้งค่าระบบ เราอาจเก็บข้อมูลดังต่อไปนี้:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <div className="p-3 rounded-xl bg-card border border-border/60 text-xs">
                      <strong className="text-foreground block mb-0.5">• Guild ID</strong>
                      <span>รหัสประจำเซิร์ฟเวอร์สำหรับแยกข้อมูลระหว่างเซิร์ฟเวอร์</span>
                    </div>
                    <div className="p-3 rounded-xl bg-card border border-border/60 text-xs">
                      <strong className="text-foreground block mb-0.5">• Guild Name และ Icon URL</strong>
                      <span>ชื่อและ URL ของไอคอนเซิร์ฟเวอร์ เพื่อใช้แสดงผลในส่วนที่เกี่ยวข้อง</span>
                    </div>
                    <div className="p-3 rounded-xl bg-card border border-border/60 text-xs">
                      <strong className="text-foreground block mb-0.5">• Owner ID</strong>
                      <span>รหัส Discord ของเจ้าของเซิร์ฟเวอร์ เพื่อใช้ตรวจสอบสิทธิ์การตั้งค่าที่เกี่ยวข้อง</span>
                    </div>
                    <div className="p-3 rounded-xl bg-card border border-border/60 text-xs">
                      <strong className="text-foreground block mb-0.5">• Channel IDs</strong>
                      <span>รหัสช่องที่ผู้ดูแลกำหนดให้ใช้สำหรับมินิเกม</span>
                    </div>
                    <div className="p-3 rounded-xl bg-card border border-border/60 text-xs">
                      <strong className="text-foreground block mb-0.5">• Game Settings</strong>
                      <span>การตั้งค่าเกม ธีมภาพ คะแนนที่ได้รับ และตัวเลือกอื่นที่เกี่ยวข้อง</span>
                    </div>
                    <div className="p-3 rounded-xl bg-card border border-border/60 text-xs">
                      <strong className="text-foreground block mb-0.5">• Plan และ Expiry Status</strong>
                      <span>สถานะแพ็กเกจ Standard หรือ Premium และวันหมดอายุของสิทธิ์ หากมี</span>
                    </div>
                  </div>
                </div>

                {/* 1.2 User Data */}
                <div className="p-4 sm:p-5 rounded-2xl bg-secondary/35 border border-border/70 space-y-3">
                  <h3 className="font-semibold text-foreground text-sm sm:text-base flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-honey" />
                    1.2 ข้อมูลระดับผู้ใช้งาน (User Data)
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    เมื่อผู้ใช้เข้าร่วมกิจกรรมหรือเล่นมินิเกม เราอาจเก็บข้อมูลดังต่อไปนี้:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <div className="p-3 rounded-xl bg-card border border-border/60 text-xs">
                      <strong className="text-foreground block mb-0.5">• User ID</strong>
                      <span>รหัสประจำตัวผู้ใช้บน Discord เพื่อระบุเจ้าของคะแนนและสถิติ</span>
                    </div>
                    <div className="p-3 rounded-xl bg-card border border-border/60 text-xs">
                      <strong className="text-foreground block mb-0.5">• Username และ Display Name</strong>
                      <span>ชื่อที่ใช้แสดงผลในตารางคะแนนหรือประกาศผู้ชนะ</span>
                    </div>
                    <div className="p-3 rounded-xl bg-card border border-border/60 text-xs">
                      <strong className="text-foreground block mb-0.5">• Game Stats</strong>
                      <span>คะแนนสะสม จำนวนครั้งที่ตอบถูก และสถิติที่เกี่ยวข้อง โดยแยกตามเซิร์ฟเวอร์</span>
                    </div>
                    <div className="p-3 rounded-xl bg-card border border-border/60 text-xs">
                      <strong className="text-foreground block mb-0.5">• สถานะการเล่นชั่วคราว</strong>
                      <span>ข้อมูลที่จำเป็นต่อการประมวลผลคำตอบ ป้องกันการกดซ้ำ และจัดการเซสชันเกม</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground italic pt-1">
                    * ข้อมูลสถานะการเล่นบางส่วนอาจอยู่ในหน่วยความจำของระบบหรือฐานข้อมูล ทั้งนี้ขึ้นอยู่กับประเภทของข้อมูลและการทำงานจริงของฟังก์ชันนั้น
                  </p>
                </div>
              </div>
            </section>

            {/* หมวด 2: ข้อมูลที่เราไม่เก็บรวบรวม */}
            <section
              id="section-2"
              className="scroll-mt-24 rounded-2xl border-2 border-emerald-500/40 bg-card/70 p-6 sm:p-7 shadow-xs space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                    2. ข้อมูลที่เราไม่เก็บรวบรวม
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    ความโปร่งใสสูงสุด — สิ่งที่ Kuma Bot ไม่มีนโยบายจัดเก็บโดยเด็ดขาด
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm sm:text-base font-normal text-muted-foreground leading-relaxed">
                <p>ตามการออกแบบบริการ Kuma Bot ไม่มีวัตถุประสงค์ในการเก็บข้อมูลต่อไปนี้:</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* 2.1 Voice */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-sm sm:text-base text-foreground">
                      <VolumeX className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      2.1 ไม่มีการบันทึกเสียงใน Voice Channel
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      Kuma Bot ไม่ได้มีฟังก์ชันบันทึกเสียงสนทนาของสมาชิกใน Voice Channel เพื่อจัดเก็บเป็นไฟล์เสียง
                    </p>
                  </div>

                  {/* 2.3 DM */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-secondary/35 border border-border/70 space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-sm sm:text-base text-foreground">
                      <MessageSquareOff className="w-4 h-4 text-honey shrink-0" />
                      2.3 ไม่มีการอ่านหรือจัดเก็บแชทส่วนตัว (DM)
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      Kuma Bot ไม่ได้ออกแบบมาเพื่ออ่านข้อความ Direct Messages ของผู้ใช้หรือจัดเก็บประวัติการสนทนาส่วนตัว
                    </p>
                  </div>

                  {/* 2.4 Financial */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-secondary/35 border border-border/70 space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-sm sm:text-base text-foreground">
                      <CreditCard className="w-4 h-4 text-honey shrink-0" />
                      2.4 ไม่มีการร้องขอข้อมูลการเงินโดยตรง
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      Kuma Bot ไม่จำเป็นต้องใช้รหัสผ่าน Discord หมายเลขบัตรเครดิต หรือข้อมูลบัญชีธนาคารของผู้ใช้เพื่อให้บริการมินิเกมตามปกติ
                    </p>
                  </div>

                  {/* 2.2 Chat History Notice */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-secondary/35 border border-border/70 space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-sm sm:text-base text-foreground">
                      <XCircle className="w-4 h-4 text-honey shrink-0" />
                      2.2 ไม่จัดเก็บแชททั่วไปเป็นประวัติ
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      บอทไม่บันทึกข้อความแชททั่วไปลงฐานข้อมูลเพื่อสร้างประวัติการสนทนา ตรวจสอบข้อความเฉพาะในช่องเกมตามความจำเป็นเท่านั้น
                    </p>
                  </div>
                </div>

                {/* Detailed notice on message processing */}
                <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/70 space-y-2 text-xs sm:text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground flex items-center gap-2">
                    <Radio className="w-4 h-4 text-honey" />
                    รายละเอียดการประมวลผลข้อความตรวจคำตอบ:
                  </p>
                  <p className="leading-relaxed">
                    ระบบจำเป็นต้องประมวลผลข้อความที่ส่งเข้ามาในช่องมินิเกมที่กำหนด เพื่อใช้ตรวจคำตอบตามการทำงานของเกม ข้อความดังกล่าวอาจถูกส่งผ่านระบบประมวลผลในหน่วยความจำหรือส่วนประกอบอื่นที่เกี่ยวข้อง และจะไม่ถูกจัดเก็บเป็นประวัติแชทโดยเจตนา ทั้งนี้ การประมวลผลและการเก็บบันทึกทางเทคนิคต้องเป็นไปตามการตั้งค่าจริงของระบบ
                  </p>
                  <p className="leading-relaxed italic pt-1 text-muted-foreground/80">
                    * ข้อมูลบางประเภทอาจถูกประมวลผลโดย Discord หรือผู้ให้บริการชำระเงินที่เกี่ยวข้อง หากมีการใช้งานบริการภายนอกดังกล่าว ซึ่งอยู่ภายใต้นโยบายของผู้ให้บริการนั้นด้วย
                  </p>
                </div>
              </div>
            </section>

            {/* หมวด 3: วัตถุประสงค์ในการใช้ข้อมูล */}
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
                    3. วัตถุประสงค์ในการใช้ข้อมูล
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    เหตุผลความจำเป็นในการประมวลผลข้อมูลของระบบ
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm sm:text-base font-normal text-muted-foreground leading-relaxed">
                <p>เราใช้ข้อมูลตามความจำเป็นสำหรับวัตถุประสงค์ดังต่อไปนี้:</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-secondary/35 space-y-1">
                    <strong className="text-foreground text-xs sm:text-sm block font-semibold">
                      • ให้บริการมินิเกม:
                    </strong>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      ตรวจคำตอบ คำนวณคะแนน อัปเดตสถิติ และแสดงตารางคะแนน
                    </p>
                  </div>

                  <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-secondary/35 space-y-1">
                    <strong className="text-foreground text-xs sm:text-sm block font-semibold">
                      • จัดการเซสชันเกม:
                    </strong>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      รักษาสถานะของเกมที่กำลังเล่น และช่วยให้ระบบดำเนินการต่อได้หลังเกิดเหตุขัดข้อง หากฟังก์ชันดังกล่าวรองรับ
                    </p>
                  </div>

                  <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-secondary/35 space-y-1">
                    <strong className="text-foreground text-xs sm:text-sm block font-semibold">
                      • จัดการสิทธิ์การใช้งาน:
                    </strong>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      ตรวจสอบโควตาของแผน Standard และสถานะ Premium
                    </p>
                  </div>

                  <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-secondary/35 space-y-1">
                    <strong className="text-foreground text-xs sm:text-sm block font-semibold">
                      • ป้องกันการทุจริต:
                    </strong>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      ตรวจสอบความถี่ของคำสั่งหรือคำตอบ และป้องกันการใช้ระบบในทางที่ไม่เหมาะสม
                    </p>
                  </div>

                  <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-secondary/35 space-y-1">
                    <strong className="text-foreground text-xs sm:text-sm block font-semibold">
                      • แสดงผลข้อมูลสมาชิก:
                    </strong>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      แสดงชื่อ คะแนน และสถิติในส่วนที่จำเป็นต่อการใช้งาน
                    </p>
                  </div>

                  <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-secondary/35 space-y-1">
                    <strong className="text-foreground text-xs sm:text-sm block font-semibold">
                      • ดูแลความปลอดภัยและแก้ไขปัญหา:
                    </strong>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      ตรวจสอบข้อผิดพลาดและรักษาเสถียรภาพของบริการเท่าที่จำเป็น
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs sm:text-sm font-medium text-bear-brown dark:text-amber-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-honey shrink-0" />
                  <span>เราไม่ใช้ข้อมูลส่วนบุคคลเพื่อขายหรือให้เช่าข้อมูลแก่บุคคลภายนอกเพื่อการโฆษณา</span>
                </div>
              </div>
            </section>

            {/* หมวด 4: ผู้ให้บริการภายนอกและการเปิดเผยข้อมูล */}
            <section
              id="section-4"
              className="scroll-mt-24 rounded-2xl border border-border/70 bg-card/70 p-6 sm:p-7 shadow-xs space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                    4. ผู้ให้บริการภายนอกและการเปิดเผยข้อมูล
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    พันธมิตรโครงสร้างพื้นฐานที่ระบบ Kuma Bot ใช้งาน
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm sm:text-base font-normal text-muted-foreground leading-relaxed">
                <p>
                  Kuma Bot อาจต้องส่งหรือรับข้อมูลผ่านผู้ให้บริการภายนอกที่จำเป็นต่อการทำงาน ดังนี้:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* 4.1 Discord API */}
                  <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-secondary/35 space-y-2">
                    <div className="font-semibold text-sm sm:text-base text-foreground flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#5865F2]" />
                        4.1 Discord API
                      </span>
                      <a
                        href="https://discord.com/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-honey hover:underline text-xs inline-flex items-center gap-1 font-medium"
                      >
                        Privacy Policy <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      ใช้รับส่งคำสั่ง ข้อมูลสมาชิก ข้อมูลเซิร์ฟเวอร์ และเหตุการณ์ต่าง ๆ ที่เกี่ยวข้องกับการทำงานของบอท การใช้งานดังกล่าวอยู่ภายใต้ข้อกำหนดและนโยบายของ Discord
                    </p>
                  </div>

                  {/* 4.2 Supabase */}
                  <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-secondary/35 space-y-2">
                    <div className="font-semibold text-sm sm:text-base text-foreground flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#3ECF8E]" />
                        4.2 Supabase
                      </span>
                      <a
                        href="https://supabase.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-honey hover:underline text-xs inline-flex items-center gap-1 font-medium"
                      >
                        supabase.com <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      ใช้เป็นระบบฐานข้อมูลสำหรับจัดเก็บการตั้งค่า คะแนน สถิติ และข้อมูลอื่นที่จำเป็นต่อบริการ ข้อมูลที่จัดเก็บและมาตรการรักษาความปลอดภัยขึ้นอยู่กับการตั้งค่าของโครงการ Supabase และผู้ให้บริการโครงสร้างพื้นฐานที่เกี่ยวข้อง
                    </p>
                  </div>

                  {/* 4.3 TTS */}
                  <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-secondary/35 space-y-2">
                    <div className="font-semibold text-sm sm:text-base text-foreground flex items-center gap-2">
                      <Radio className="w-4 h-4 text-honey" />
                      4.3 บริการสังเคราะห์เสียง (TTS)
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      เกมที่ใช้เสียงอาจเรียกใช้บริการสังเคราะห์เสียง เช่น Google Translate TTS หรือบริการที่ระบบกำหนด เพื่อสร้างเสียงอ่านคำศัพท์
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      ข้อมูลที่จำเป็นต่อการสร้างเสียง เช่น ข้อความคำศัพท์ อาจถูกส่งไปยังบริการภายนอกดังกล่าว การส่งข้อมูลนี้ไม่จำเป็นต้องมีข้อมูลระบุตัวตนของผู้ใช้โดยตรง อย่างไรก็ตาม ข้อมูลที่ส่งจริงขึ้นอยู่กับการทำงานของระบบและบริการที่ใช้งานในขณะนั้น
                    </p>
                  </div>

                  {/* 4.4 Legal Necessity */}
                  <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-secondary/35 space-y-2">
                    <div className="font-semibold text-sm sm:text-base text-foreground flex items-center gap-2">
                      <Lock className="w-4 h-4 text-honey" />
                      4.4 เหตุจำเป็นอื่นตามกฎหมาย
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      เราอาจเปิดเผยข้อมูลเมื่อจำเป็นตามกฎหมาย คำสั่งที่มีผลผูกพัน หรือเพื่อป้องกันการทุจริตและรักษาความปลอดภัยของบริการ โดยจะจำกัดข้อมูลที่เปิดเผยให้เหมาะสมกับเหตุจำเป็น
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* หมวด 5: ระยะเวลาในการเก็บรักษาข้อมูล */}
            <section
              id="section-5"
              className="scroll-mt-24 rounded-2xl border border-border/70 bg-card/70 p-6 sm:p-7 shadow-xs space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                    5. ระยะเวลาในการเก็บรักษาข้อมูล (Data Retention)
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    รอบระยะเวลาการเก็บและการล้างข้อมูลออกจากระบบ
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm sm:text-base font-normal text-muted-foreground leading-relaxed">
                <p>
                  เราจะเก็บข้อมูลเท่าที่จำเป็นต่อวัตถุประสงค์ในการให้บริการ การรักษาความปลอดภัย และการปฏิบัติตามกฎหมายที่เกี่ยวข้อง:
                </p>

                <div className="space-y-3">
                  {/* 5.1 */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-secondary/35 border border-border/70 space-y-1.5">
                    <h3 className="font-semibold text-foreground text-sm sm:text-base">
                      5.1 คะแนนและสถิติ
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      คะแนนและสถิติจะถูกเก็บไว้ตราบเท่าที่จำเป็นต่อการให้บริการและการแสดงผลข้อมูลของเซิร์ฟเวอร์ โดยอาจถูกลบหรือรีเซ็ตเมื่อมีเหตุจำเป็น เช่น การร้องขอลบข้อมูล การปิดบริการ หรือการดำเนินการเพื่อแก้ไขการทุจริต
                    </p>
                  </div>

                  {/* 5.2 */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-secondary/35 border border-border/70 space-y-1.5">
                    <h3 className="font-semibold text-foreground text-sm sm:text-base">
                      5.2 เซสชันเกม
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      ข้อมูลเซสชันที่ไม่จำเป็นแล้วจะถูกลบหรือสิ้นสุดการใช้งานตามกระบวนการของระบบ เช่น เมื่อเกมจบลงหรือมีผู้ตอบถูก ทั้งนี้ ระยะเวลาจริงอาจแตกต่างกันตามประเภทเซสชันและวิธีการจัดเก็บ
                    </p>
                  </div>

                  {/* 5.3 */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-secondary/35 border border-border/70 space-y-2">
                    <h3 className="font-semibold text-foreground text-sm sm:text-base flex items-center gap-2">
                      <Clock className="w-4 h-4 text-honey" />
                      5.3 เมื่อบอทออกจากเซิร์ฟเวอร์ (Guild Removal)
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      เมื่อ Kuma Bot ถูกนำออกจากเซิร์ฟเวอร์ ฟังก์ชันที่ต้องอาศัยเซิร์ฟเวอร์นั้นจะหยุดทำงาน
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      ข้อมูลการตั้งค่าและคะแนนอาจถูกเก็บไว้ชั่วคราวเพื่อรองรับกรณีเพิ่มบอทกลับเข้ามา โดยมีแผนกำหนดระยะเวลา 90 วันก่อนนำข้อมูลเข้าสู่กระบวนการลบถาวร ทั้งนี้ ระยะเวลาดังกล่าวต้องเป็นไปตามระบบลบข้อมูลที่ใช้งานจริง
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      หากมีการร้องขอลบข้อมูลก่อนครบกำหนด เราจะพิจารณาดำเนินการตามสิทธิของเจ้าของข้อมูลและข้อกำหนดทางกฎหมาย
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* หมวด 6: สิทธิของเจ้าของข้อมูลส่วนบุคคล (PDPA) */}
            <section
              id="section-6"
              className="scroll-mt-24 rounded-2xl border-2 border-honey/40 bg-card/70 p-6 sm:p-7 shadow-xs space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                    6. สิทธิของเจ้าของข้อมูลส่วนบุคคล
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    สิทธิตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm sm:text-base font-normal text-muted-foreground leading-relaxed">
                <p>ภายใต้เงื่อนไขและข้อยกเว้นที่กฎหมายกำหนด คุณอาจมีสิทธิดังต่อไปนี้:</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-secondary/35 space-y-1.5">
                    <strong className="text-foreground font-semibold text-sm sm:text-base flex items-center gap-2">
                      • 6.1 สิทธิในการเข้าถึงข้อมูล
                    </strong>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      คุณสามารถตรวจสอบคะแนนและสถิติของตนเองผ่านคำสั่งที่ระบบรองรับ เช่น <code className="text-xs px-1.5 py-0.5 rounded bg-muted">/profile</code> หรือ <code className="text-xs px-1.5 py-0.5 rounded bg-muted">/points</code> หากเปิดใช้งานในเซิร์ฟเวอร์นั้น
                    </p>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-secondary/35 space-y-1.5">
                    <strong className="text-foreground font-semibold text-sm sm:text-base flex items-center gap-2">
                      • 6.2 สิทธิในการขอแก้ไขข้อมูล
                    </strong>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      คุณสามารถติดต่อทีมงานเพื่อแจ้งข้อมูลที่ไม่ถูกต้องหรือขอให้ตรวจสอบและแก้ไขข้อมูลส่วนบุคคลตามสิทธิที่กฎหมายกำหนด
                    </p>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-secondary/35 space-y-1.5">
                    <strong className="text-foreground font-semibold text-sm sm:text-base flex items-center gap-2">
                      • 6.3 สิทธิในการขอลบข้อมูล
                    </strong>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      คุณสามารถยื่นคำร้องขอลบข้อมูลที่เชื่อมโยงกับ Discord User ID ของคุณผ่าน Discord Community หรืออีเมลที่ระบุไว้ท้ายเอกสาร เจ้าของเซิร์ฟเวอร์สามารถติดต่อทีมงานเพื่อขอให้ตรวจสอบหรือลบข้อมูลของเซิร์ฟเวอร์ได้ตามขอบเขตสิทธิที่เกี่ยวข้อง การลบข้อมูลอาจมีข้อยกเว้นในกรณีที่จำเป็นต้องเก็บรักษาตามกฎหมาย หรือมีเหตุอื่นที่กฎหมายอนุญาตให้เก็บไว้
                    </p>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-secondary/35 space-y-1.5">
                    <strong className="text-foreground font-semibold text-sm sm:text-base flex items-center gap-2">
                      • 6.4 สิทธิในการคัดค้านหรือจำกัดการประมวลผล
                    </strong>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      คุณอาจใช้สิทธิคัดค้านหรือขอจำกัดการประมวลผลข้อมูลได้ตามเงื่อนไขที่กฎหมายกำหนด โดยทีมงานจะพิจารณาตามประเภทข้อมูลและวัตถุประสงค์ในการประมวลผล
                    </p>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-secondary/35 space-y-1.5 sm:col-span-2">
                    <strong className="text-foreground font-semibold text-sm sm:text-base flex items-center gap-2">
                      • 6.5 สิทธิในการถอนความยินยอม
                    </strong>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      ในกรณีที่การประมวลผลอาศัยความยินยอม คุณสามารถถอนความยินยอมได้ตามช่องทางที่กำหนด โดยการถอนความยินยอมไม่กระทบต่อการประมวลผลที่ดำเนินการไปแล้วโดยชอบก่อนการถอน การหยุดใช้งานหรือการนำบอทออกจากเซิร์ฟเวอร์อาจหยุดการประมวลผลบางส่วน แต่ไม่ได้หมายความว่าข้อมูลที่จัดเก็บไว้ทั้งหมดจะถูกลบทันที
                    </p>
                  </div>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-secondary/35 border border-border/70 space-y-1.5">
                  <h4 className="font-semibold text-foreground text-xs sm:text-sm flex items-center gap-2">
                    <Mail className="w-4 h-4 text-honey" />
                    6.6 ช่องทางการใช้สิทธิ:
                  </h4>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    โปรดติดต่อทีมงานพร้อมรายละเอียดคำร้องที่จำเป็น เพื่อให้สามารถตรวจสอบคำขอและยืนยันตัวตนได้อย่างเหมาะสม เราจะดำเนินการภายในระยะเวลาที่กฎหมายกำหนด
                  </p>
                </div>
              </div>
            </section>

            {/* หมวด 7: มาตรการรักษาความปลอดภัย */}
            <section
              id="section-7"
              className="scroll-mt-24 rounded-2xl border border-border/70 bg-card/70 p-6 sm:p-7 shadow-xs space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                    7. มาตรการรักษาความปลอดภัย
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    การปกป้องข้อมูลและการป้องกันการเข้าถึงโดยมิชอบ
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm sm:text-base font-normal text-muted-foreground leading-relaxed">
                <p>
                  เราใช้มาตรการทางเทคนิคและการจัดการตามความเหมาะสมเพื่อป้องกันการเข้าถึง การเปิดเผย การแก้ไข หรือการทำลายข้อมูลโดยไม่ได้รับอนุญาต โดยแนวทางที่เกี่ยวข้องอาจประกอบด้วย:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-secondary/35 space-y-1">
                    <strong className="text-foreground text-xs sm:text-sm block font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-honey" />
                      การจำกัดสิทธิ์ (Access Limitation)
                    </strong>
                    <p className="text-xs text-muted-foreground">
                      จำกัดการเข้าถึงฐานข้อมูลและข้อมูลสำคัญให้เฉพาะผู้ที่จำเป็นต้องใช้งาน
                    </p>
                  </div>

                  <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-secondary/35 space-y-1">
                    <strong className="text-foreground text-xs sm:text-sm block font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-honey" />
                      การจัดการข้อมูลรับรอง (Credentials Management)
                    </strong>
                    <p className="text-xs text-muted-foreground">
                      เก็บข้อมูลรับรองของระบบไว้ในสภาพแวดล้อมที่เหมาะสม และหลีกเลี่ยงการเปิดเผยต่อผู้ใช้งานทั่วไป
                    </p>
                  </div>

                  <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-secondary/35 space-y-1">
                    <strong className="text-foreground text-xs sm:text-sm block font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-honey" />
                      การควบคุมการเข้าถึงฐานข้อมูล (Database Controls)
                    </strong>
                    <p className="text-xs text-muted-foreground">
                      ใช้การตรวจสอบสิทธิ์และมาตรการป้องกันการเข้าถึงข้อมูลที่ไม่เกี่ยวข้อง
                    </p>
                  </div>

                  <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-secondary/35 space-y-1">
                    <strong className="text-foreground text-xs sm:text-sm block font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-honey" />
                      ความปลอดภัยระหว่างส่งข้อมูล (Encryption in Transit)
                    </strong>
                    <p className="text-xs text-muted-foreground">
                      ใช้การเชื่อมต่อที่มีการป้องกันตามที่ผู้ให้บริการโครงสร้างพื้นฐานรองรับ
                    </p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground italic">
                  * แม้เราจะใช้ความพยายามในการรักษาความปลอดภัย แต่ไม่สามารถรับประกันได้ว่าระบบใด ๆ จะปราศจากความเสี่ยงหรือเหตุการณ์ข้อมูลรั่วไหลโดยสิ้นเชิง หากเกิดเหตุการณ์ที่เข้าข่ายต้องแจ้งตามกฎหมาย เราจะดำเนินการตามหน้าที่ที่เกี่ยวข้อง
                </p>
              </div>
            </section>

            {/* หมวด 8: การเปลี่ยนแปลงนโยบายความเป็นส่วนตัว */}
            <section
              id="section-8"
              className="scroll-mt-24 rounded-2xl border border-border/70 bg-card/70 p-6 sm:p-7 shadow-xs space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                    8. การเปลี่ยนแปลงนโยบายความเป็นส่วนตัว
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    การทบทวนและปรับปรุงเอกสารให้ทันสมัย
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-sm sm:text-base font-normal text-muted-foreground leading-relaxed">
                <p>
                  เราอาจแก้ไขนโยบายนี้เมื่อมีการเปลี่ยนแปลงฟังก์ชันของ Kuma Bot วิธีประมวลผลข้อมูล หรือข้อกำหนดทางกฎหมาย โดยจะแสดงวันที่อัปเดตล่าสุดไว้ที่ด้านบนของเอกสาร
                </p>
                <p>
                  หากมีการเปลี่ยนแปลงสาระสำคัญ เราจะพยายามแจ้งให้ผู้ใช้งานทราบผ่านช่องทางที่เหมาะสม
                </p>
              </div>
            </section>

            {/* หมวด 9: ติดต่อเรา */}
            <section
              id="section-9"
              className="scroll-mt-24 rounded-2xl border border-border/70 bg-card/70 p-6 sm:p-7 shadow-xs space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                    9. ติดต่อเรา (Contact Us)
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    ติดต่อสอบถามหรือใช้สิทธิเกี่ยวกับข้อมูลส่วนบุคคล
                  </p>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-muted-foreground">
                หากมีคำถามเกี่ยวกับนโยบายความเป็นส่วนตัว หรือต้องการใช้สิทธิเกี่ยวกับข้อมูลส่วนบุคคล สามารถติดต่อได้ที่:
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
                    <p className="text-xs text-muted-foreground">ผู้ดูแลระบบ & ทีมงาน</p>
                    <p className="text-xs sm:text-sm font-semibold text-foreground">
                      zeab1u • ทีมงาน Bear Café
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
                    ทำความเข้าใจเงื่อนไขและข้อกำหนดในการใช้บริการ Kuma Bot
                  </p>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                อ่าน{' '}
                <Link
                  to="/term-of-service"
                  className="font-semibold text-honey hover:underline inline-flex items-center gap-1"
                >
                  ข้อกำหนดและเงื่อนไขการให้บริการ (Terms of Service)
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>{' '}
                เพื่อทำความเข้าใจเงื่อนไขการใช้งาน Kuma Bot
              </p>

              <div className="pt-2">
                <Button
                  onClick={() => navigate('/term-of-service')}
                  className="rounded-xl bg-honey hover:bg-honey-dark text-bear-dark font-medium shadow-xs text-xs sm:text-sm"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  เปิดหน้าข้อกำหนดการให้บริการ Kuma Bot
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

