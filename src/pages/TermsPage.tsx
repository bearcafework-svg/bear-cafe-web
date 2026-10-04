import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BearLogo } from '@/components/bear-cafe/BearLogo';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { PolicyNavTabs } from '@/components/bear-cafe/PolicyNavTabs';
import { CozyPageFooter } from '@/components/bear-cafe/CozyPageFooter';
import {
  ShieldCheck,
  UserCheck,
  FileText,
  AlertTriangle,
  HeartHandshake,
  Lock,
  ArrowUp,
  ArrowLeft,
  Sparkles,
  ExternalLink,
  Layers,
  Mail,
  Info,
  Server,
} from 'lucide-react';

interface TocItem {
  id: string;
  title: string;
  shortTitle: string;
  icon: React.ElementType;
}

const TOC_SECTIONS: TocItem[] = [
  {
    id: 'introduction',
    title: '1. บทนำและวัตถุประสงค์ของระบบ',
    shortTitle: 'บทนำและวัตถุประสงค์',
    icon: HeartHandshake,
  },
  {
    id: 'infrastructure',
    title: '2. โครงสร้างระบบและผู้ให้บริการร่วม',
    shortTitle: 'โครงสร้างและพันธมิตร',
    icon: Layers,
  },
  {
    id: 'permissions',
    title: '3. ข้อมูลที่จัดเก็บและสิทธิ์การเข้าถึง (Discord Permissions)',
    shortTitle: 'ข้อมูลและสิทธิ์บอท',
    icon: Lock,
  },
  {
    id: 'community-rules',
    title: '4. กฎระเบียบและข้อห้ามของคอมมูนิตี้',
    shortTitle: 'กติกาและข้อห้าม',
    icon: AlertTriangle,
  },
  {
    id: 'enforcement',
    title: '5. มาตรการลงโทษและขั้นตอนการดำเนินงาน',
    shortTitle: 'มาตรการลงโทษ',
    icon: ShieldCheck,
  },
  {
    id: 'pdpa-rights',
    title: '6. สิทธิ์ของผู้ใช้งานและการคุ้มครองข้อมูล (PDPA)',
    shortTitle: 'สิทธิ์ PDPA & การลบข้อมูล',
    icon: UserCheck,
  },
  {
    id: 'contact',
    title: '7. ช่องทางติดต่อและข้อมูลลิขสิทธิ์',
    shortTitle: 'ติดต่อเรา & ลิขสิทธิ์',
    icon: Mail,
  },
];

export default function TermsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  const [activeSection, setActiveSection] = useState<string>('introduction');
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);

  // Scroll spy & Scroll to top visibility
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 120;
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

  // Handle URL hash on mount
  useEffect(() => {
    if (location.hash) {
      const targetId = location.hash.replace('#', '');
      const el = document.getElementById(targetId);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors selection:bg-amber-500/30 selection:text-foreground flex flex-col font-sans">
      {/* Top Header - Edge-to-Edge aligned with CozyNavbar */}
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
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-honey/15 text-bear-brown dark:text-honey border border-honey/25 hidden sm:inline-block">
                  Terms & Permissions
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
        {/* Main Page Style Hero Banner with Thai-first minimalist typography */}
        <motion.div
          initial={{ opacity: 0.92, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative h-[180px] overflow-hidden rounded-2xl bg-cover bg-center bg-no-repeat sm:h-[220px] sm:rounded-3xl lg:h-[240px]"
          style={{
            backgroundImage:
              "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.4) 100%), url('/banner/welcome_banner.jpg')",
          }}
        >
          <div className="flex h-full flex-col justify-end gap-1.5 px-4 pb-4 sm:justify-center sm:gap-2 sm:px-6 sm:pb-0 lg:px-10">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight">
              ข้อกำหนดการใช้งาน & สิทธิ์การเข้าถึงข้อมูล
            </h1>
            <div className="space-y-0.5 sm:space-y-1">
              <p className="text-sm sm:text-base font-normal text-[#D6C3B5] leading-relaxed">
                แนวปฏิบัติ กฎระเบียบชุมชน และความโปร่งใสของระบบคอมมูนิตี้ Bear Café
              </p>
              <p className="text-xs sm:text-sm font-normal text-[#D6C3B5]/80 line-clamp-2 sm:line-clamp-none">
                เพื่อความปลอดภัยและความเป็นส่วนตัวของสมาชิกทุกคนในครอบครัวหมี
              </p>
            </div>
          </div>
        </motion.div>

        {/* Navigation Tabs between Terms, Privacy, Permissions */}
        <PolicyNavTabs showBackToHome={false} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Navigation: Sticky Table of Contents (Desktop) */}
          <aside className="hidden lg:block lg:col-span-4 sticky top-24">
            <div className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-xs backdrop-blur-sm space-y-1">
              <div className="flex items-center gap-2 pb-3 mb-2 border-b border-border/70">
                <FileText className="w-4 h-4 text-honey" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  สารบัญหัวข้อ (Table of Contents)
                </span>
              </div>
              <nav className="space-y-1">
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

              <div className="pt-3 mt-3 border-t border-border/70 text-xs sm:text-sm text-muted-foreground space-y-2">
                <a
                  href="/privacy"
                  className="text-honey hover:underline flex items-center justify-between font-medium"
                >
                  <span>นโยบายความเป็นส่วนตัว (Privacy)</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href="/privacy/permissions"
                  className="text-honey hover:underline flex items-center justify-between font-medium"
                >
                  <span>การจัดการข้อมูลและ Retention</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </aside>

          {/* Right Content Column */}
          <div className="lg:col-span-8 space-y-8">
            {/* SECTION 1: Introduction & Purpose */}
            <section
              id="introduction"
              className="scroll-mt-24 rounded-2xl border border-border/70 bg-card/70 p-6 sm:p-7 shadow-xs space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                  <HeartHandshake className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                    1. บทนำและวัตถุประสงค์ของระบบ
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    เจตนารมณ์และขอบเขตการใช้งานคอมมูนิตี้ Bear Café
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm sm:text-base font-normal text-muted-foreground leading-relaxed">
                <p>
                  ยินดีต้อนรับสู่ <strong className="font-medium text-foreground">Bear Café</strong> ชุมชนออนไลน์ที่มุ่งเน้นการสร้างพื้นที่ปลอดภัยและอบอุ่นสำหรับการพบปะ พูดคุย เล่นเกม และแบ่งปันเรื่องราวดี ๆ ร่วมกัน
                </p>
                <div className="p-4 sm:p-5 rounded-2xl bg-secondary/35 border border-border/70 space-y-2">
                  <h4 className="font-semibold text-foreground text-sm sm:text-base flex items-center gap-2">
                    🎯 วัตถุประสงค์หลักของระบบ:
                  </h4>
                  <ul className="list-disc list-inside space-y-1 pl-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    <li>สร้างคอมมูนิตี้เชิงบวกสำหรับการหาเพื่อน เล่นเกม และการแลกเปลี่ยนความรู้</li>
                    <li>ให้บริการระบบเสริม (เช่น การจัดการห้องเสียงส่วนตัว, มินิเกม, และระบบเควสต์ประจำวัน)</li>
                    <li>สนับสนุนกิจกรรมร่วมกันอย่างสร้างสรรค์ ปราศจากการคุกคามหรือแสวงหาผลประโยชน์ส่วนบุคคล</li>
                  </ul>
                </div>
                <p>
                  การเข้าใช้งานเว็บไซต์หรือเข้าร่วมเซิร์ฟเวอร์ Discord ของ Bear Café ถือว่าท่านได้อ่าน ทำความเข้าใจ 
                  และตกลงที่จะปฏิบัติตามข้อกำหนดและเงื่อนไขการใช้งานฉบับนี้โดยสมบูรณ์
                </p>
              </div>
            </section>

            {/* SECTION 2: System Infrastructure & Partners */}
            <section
              id="infrastructure"
              className="scroll-mt-24 rounded-2xl border border-border/70 bg-card/70 p-6 sm:p-7 shadow-xs space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                    2. โครงสร้างระบบและผู้ให้บริการร่วม
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    โครงสร้างพื้นฐานระดับมาตรฐานสากลที่ระบบใช้งาน
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm sm:text-base font-normal text-muted-foreground leading-relaxed">
                <p>
                  เพื่อรักษาเสถียรภาพและมาตรฐานความปลอดภัยสูงสุด ระบบ Bear Café ทำงานร่วมกับผู้ให้บริการโครงสร้างพื้นฐาน ได้แก่:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-secondary/35 space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-sm sm:text-base text-foreground">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#5865F2]" />
                      Discord Inc. (Discord API)
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      ใช้สำหรับการยืนยันตัวตน (OAuth2), ตรวจสอบสถานะการเป็นสมาชิกในเซิร์ฟเวอร์, บทบาท (Roles) และสถานะห้องเสียง
                    </p>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-secondary/35 space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-sm sm:text-base text-foreground">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#3ECF8E]" />
                      Supabase Inc.
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      ระบบคลาวด์ดาต้าเบสพร้อมการเข้ารหัสความปลอดภัย ใช้จัดเก็บโปรไฟล์ ประวัติแต้ม และบันทึกกิจกรรม
                    </p>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-secondary/35 space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-sm sm:text-base text-foreground">
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-800 dark:bg-slate-200" />
                      Vercel Inc.
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      ผู้ให้บริการเว็บโฮสติ้งและเครือข่ายส่งต่อข้อมูล (CDN) เพื่อการแสดงผลเว็บไซต์ที่รวดเร็วและปลอดภัย
                    </p>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-secondary/35 space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-sm sm:text-base text-foreground">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#F38020]" />
                      Cloudflare (Turnstile)
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      ระบบคัดกรองบอทอัตโนมัติและป้องกันการโจมตีทางไซเบอร์ ปกป้องระบบจากการยิงสแปม
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 3: Data & Discord Permissions */}
            <section
              id="permissions"
              className="scroll-mt-24 rounded-2xl border-2 border-honey/40 bg-card/70 p-6 sm:p-7 shadow-xs space-y-5 relative overflow-hidden"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                    3. ข้อมูลที่จัดเก็บและสิทธิ์การเข้าถึง (Discord Permissions)
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    เหตุผลความจำเป็นในการขอสิทธิ์แต่ละประเภทอย่างละเอียดตามโค้ดจริง
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm sm:text-base font-normal text-muted-foreground leading-relaxed">
                <p>
                  เมื่อท่านเข้าสู่ระบบด้วย Discord ระบบจะร้องขอสิทธิ์ (OAuth Scopes) และเข้าถึงข้อมูลตามความจำเป็นขั้นต่ำสุด (Data Minimization) ดังนี้:
                </p>

                {/* Callout Box on Discord guilds permission */}
                <div className="rounded-2xl border border-honey/30 bg-honey/10 p-4 sm:p-5 space-y-2.5">
                  <div className="flex items-center gap-2 text-foreground font-semibold text-sm sm:text-base">
                    <Server className="w-4 h-4 text-honey" />
                    ทำไมระบบจึงต้องขอสิทธิ์ "รู้ว่าท่านอยู่ในเซิร์ฟเวอร์ใดบ้าง" (guilds scope)?
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    ระบบของ Bear Café ขอสิทธิ์การเข้าถึงรายชื่อเซิร์ฟเวอร์ (<code>guilds</code> scope)
                    เพื่อวัตถุประสงค์เดียวคือ{' '}
                    <strong className="font-medium text-foreground">
                      "ตรวจสอบและยืนยันว่าบัญชีของท่านเป็นสมาชิกของเซิร์ฟเวอร์คอมมูนิตี้ Bear Café หรือไม่"
                    </strong>{' '}
                    เพื่อปลดล็อกการเข้าใช้งานฟังก์ชันต่าง ๆ บนเว็บไซต์ (เช่น ระบบเช็คชื่อรายวัน, คลังไอเทม, และมินิเกม)
                  </p>
                  <div className="p-3.5 sm:p-4 rounded-xl bg-card/80 border border-border/70 space-y-1.5 text-xs sm:text-sm text-muted-foreground">
                    <p className="font-semibold text-foreground flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      ความโปร่งใสสูงสุดในการจัดการข้อมูล:
                    </p>
                    <ul className="list-disc list-inside space-y-1 pl-1 leading-relaxed">
                      <li>ระบบจะตรวจสอบเฉพาะเซิร์ฟเวอร์ Bear Café (Server ID หลัก) เท่านั้น</li>
                      <li>
                        <strong className="font-medium text-foreground">ระบบไม่มีการจัดเก็บ บันทึก หรือติดตาม</strong> รายชื่อเซิร์ฟเวอร์อื่น ๆ ที่ท่านเข้าร่วมลงในฐานข้อมูล
                      </li>
                      <li>ข้อมูลเซิร์ฟเวอร์ถูกใช้ประมวลผลแบบชั่วคราวใน Memory ขณะตรวจสอบสิทธิ์เท่านั้น ไม่มีการนำไปใช้ในเชิงพาณิชย์ใด ๆ ทั้งสิ้น</li>
                    </ul>
                  </div>
                </div>

                {/* Grid of other permissions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-secondary/35 space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-sm sm:text-base text-foreground">
                      <UserCheck className="w-4 h-4 text-honey" />
                      <span>ข้อมูลโปรไฟล์พื้นฐาน (identify)</span>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      ขอสิทธิ์เข้าถึง Discord User ID, Username, Display Name และ Avatar URL เพื่อใช้ในการแสดงผลโปรไฟล์และบันทึกคะแนนสะสมของท่าน
                    </p>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-secondary/35 space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-sm sm:text-base text-foreground">
                      <Layers className="w-4 h-4 text-honey" />
                      <span>บทบาทและยศในเซิร์ฟเวอร์ (Roles)</span>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      ตรวจสอบสิทธิ์และยศของท่านใน Bear Café ผ่าน Bot Token เพื่อให้สิทธิ์เข้าถึงห้องพิเศษ, สิทธิประโยชน์ VIP และฟังก์ชันสำหรับทีมงาน
                    </p>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-secondary/35 space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-sm sm:text-base text-foreground">
                      <Sparkles className="w-4 h-4 text-honey" />
                      <span>สถานะห้องเสียง (Voice State)</span>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      ระบบบอทตรวจจับการเข้า-ออกห้องเสียงเพื่อคำนวณแต้มสะสม Voice Points และจัดการห้องเสียงส่วนตัว (<strong className="font-medium text-foreground">ไม่มีการดักฟังหรือบันทึกเสียงสนทนาใด ๆ ทั้งสิ้น</strong>)
                    </p>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-secondary/35 space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-sm sm:text-base text-foreground">
                      <Lock className="w-4 h-4 text-honey" />
                      <span>โทเคนการเข้าสู่ระบบ (Session Storage)</span>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      จัดเก็บ Auth Token ไว้ใน Local Storage ของเบราว์เซอร์ เพื่อคงสถานะการเข้าสู่ระบบ โดยจะถูกลบออกทันทีเมื่อท่านกด Logout
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 4: Community Rules & Prohibitions */}
            <section
              id="community-rules"
              className="scroll-mt-24 rounded-2xl border border-border/70 bg-card/70 p-6 sm:p-7 shadow-xs space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                    4. กฎระเบียบและข้อห้ามของคอมมูนิตี้
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    หลักปฏิบัติร่วมกันเพื่อสร้างพื้นที่ที่อบอุ่นและปลอดภัย
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm sm:text-base font-normal text-muted-foreground leading-relaxed">
                <p>
                  สมาชิกทุกคนตกลงที่จะปฏิบัติตามกฎระเบียบของคอมมูนิตี้ Bear Café โดยเคร่งครัด
                  เพื่อรักษาบรรยากาศที่น่าอยู่และเคารพซึ่งกันและกัน:
                </p>

                <div className="space-y-2.5">
                  <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-secondary/35 flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center font-semibold text-xs shrink-0 mt-0.5">
                      ✕
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm sm:text-base text-foreground">
                        ห้ามใช้ระบบเพื่อการหาคู่หรือความสัมพันธ์เชิงชู้สาว
                      </h4>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-relaxed">
                        ห้ามใช้ระบบหาเพื่อนเพื่อเจตนาจีบ ขอเป็นแฟน หรือการสร้างความสัมพันธ์เชิงโรแมนติก รวมถึงการทักไปสร้างความอึดอัดแก่ผู้อื่น
                      </p>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-secondary/35 flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center font-semibold text-xs shrink-0 mt-0.5">
                      ✕
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm sm:text-base text-foreground">
                        ห้ามการคุกคาม กลั่นแกล้ง และสร้างความเกลียดชัง (Zero Tolerance)
                      </h4>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-relaxed">
                        ห้ามใช้ถ้อยคำหยาบคาย ข่มขู่ ล้อเลียน เสียดสี ดูหมิ่นเหยียดหยาม หรือการกระทำใด ๆ ที่ทำให้ผู้อื่นรู้สึกไม่ปลอดภัย
                      </p>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-secondary/35 flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center font-semibold text-xs shrink-0 mt-0.5">
                      ✕
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm sm:text-base text-foreground">
                        ห้ามสื่อลามกอนาจาร ลิงก์อันตราย และสิ่งผิดกฎหมาย
                      </h4>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-relaxed">
                        ห้ามเผยแพร่เนื้อหาทางเพศ สื่อลามก ภาพถ่ายบุคคลอื่นโดยไม่ได้รับอนุญาต ไวรัส ฟิชชิ่ง หรือเนื้อหาที่ขัดต่อกฎหมายทุกประเภท
                      </p>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-secondary/35 flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center font-semibold text-xs shrink-0 mt-0.5">
                      ✕
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm sm:text-base text-foreground">
                        ห้ามการซื้อขายด้วยเงินจริง (No Real-Money Trading)
                      </h4>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-relaxed">
                        ห้ามนำแต้มสตรอว์เบอร์รี่ ตั๋วสุ่ม รางวัลกิจกรรม หรือบัญชีผู้ใช้งานไปแลกเปลี่ยน ซื้อขาย หรือแปลงเป็นเงินจริงโดยเด็ดขาด
                      </p>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-secondary/35 flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center font-semibold text-xs shrink-0 mt-0.5">
                      ✕
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm sm:text-base text-foreground">
                        ห้ามเจาะระบบ หรือแสวงหาผลประโยชน์จากช่องโหว่ (Exploits)
                      </h4>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-relaxed">
                        ห้ามใช้โปรแกรมบอทภายนอกปั๊มแต้ม การยิง API ซ้ำซ้อน หรืออาศัยข้อผิดพลาดของระบบเพื่อประโยชน์ส่วนตัว หากพบช่องโหว่กรุณาแจ้งทีมงานทันที
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 5: Enforcement & Measures */}
            <section
              id="enforcement"
              className="scroll-mt-24 rounded-2xl border border-border/70 bg-card/70 p-6 sm:p-7 shadow-xs space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                    5. มาตรการลงโทษและขั้นตอนการดำเนินงาน
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    ขั้นตอนการระงับสิทธิ์กรณีพบการละเมิดข้อตกลง
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm sm:text-base font-normal text-muted-foreground leading-relaxed">
                <p>
                  เพื่อปกป้องความปลอดภัยของสมาชิกส่วนใหญ่ หากตรวจพบพฤติกรรมที่ไม่เหมาะสม
                  ทีมงานผู้ดูแลระบบขอสงวนสิทธิ์ในการดำเนินมาตรการตามระดับความรุนแรงดังนี้:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="p-4 sm:p-5 rounded-2xl border border-amber-300/50 dark:border-amber-700/40 bg-amber-50/40 dark:bg-amber-950/20 text-center space-y-1.5">
                    <div className="w-8 h-8 rounded-full bg-amber-200 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 font-semibold mx-auto flex items-center justify-center text-xs">
                      1
                    </div>
                    <h4 className="font-semibold text-sm sm:text-base text-amber-900 dark:text-amber-200">
                      การแจ้งเตือน (Warning)
                    </h4>
                    <p className="text-xs sm:text-sm text-amber-800/80 dark:text-amber-300/70 leading-relaxed">
                      ตักเตือนผู้ใช้งานเมื่อพบการกระทำผิดระดับเบา พร้อมบันทึกประวัติการเตือนในระบบ
                    </p>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl border border-orange-300/50 dark:border-orange-700/40 bg-orange-50/40 dark:bg-orange-950/20 text-center space-y-1.5">
                    <div className="w-8 h-8 rounded-full bg-orange-200 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200 font-semibold mx-auto flex items-center justify-center text-xs">
                      2
                    </div>
                    <h4 className="font-semibold text-sm sm:text-base text-orange-900 dark:text-orange-200">
                      ระงับชั่วคราว (Suspension)
                    </h4>
                    <p className="text-xs sm:text-sm text-orange-800/80 dark:text-orange-300/70 leading-relaxed">
                      ระงับการเข้าถึงเว็บไซต์และระบบเสียงชั่วคราว (1-30 วัน) สำหรับกรณีฝ่าฝืนซ้ำ
                    </p>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl border border-rose-300/50 dark:border-rose-700/40 bg-rose-50/40 dark:bg-rose-950/20 text-center space-y-1.5">
                    <div className="w-8 h-8 rounded-full bg-rose-200 dark:bg-rose-900/50 text-rose-800 dark:text-rose-200 font-semibold mx-auto flex items-center justify-center text-xs">
                      3
                    </div>
                    <h4 className="font-semibold text-sm sm:text-base text-rose-900 dark:text-rose-200">
                      แบนถาวร (Permanent Ban)
                    </h4>
                    <p className="text-xs sm:text-sm text-rose-800/80 dark:text-rose-300/70 leading-relaxed">
                      เพิกถอนสิทธิ์การใช้งานเว็บไซต์และขับออกจากเซิร์ฟเวอร์ถาวร สำหรับการกระทำผิดร้ายแรง
                    </p>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-muted-foreground">
                  * การตัดสินใจลงโทษขึ้นอยู่กับดุลยพินิจของทีมงานผู้ดูแลระบบ Bear Café โดยยึดถือความปลอดภัยและความสงบสุขของส่วนรวมเป็นสำคัญ
                </p>
              </div>
            </section>

            {/* SECTION 6: PDPA Rights & Data Deletion */}
            <section
              id="pdpa-rights"
              className="scroll-mt-24 rounded-2xl border border-border/70 bg-card/70 p-6 sm:p-7 shadow-xs space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                    6. สิทธิ์ของผู้ใช้งานและการคุ้มครองข้อมูล (PDPA)
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    การใช้สิทธิ์ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm sm:text-base font-normal text-muted-foreground leading-relaxed">
                <p>
                  ผู้ใช้งานมีสิทธิ์ในการควบคุมและจัดการข้อมูลส่วนบุคคลของตนเองตามกฎหมาย ได้แก่:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-secondary/35 space-y-1.5">
                    <strong className="text-foreground font-semibold text-sm sm:text-base flex items-center gap-2">
                      • สิทธิในการเข้าถึงและขอรับสำเนา
                    </strong>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      สามารถตรวจสอบข้อมูลโปรไฟล์ คะแนนสะสม และประวัติธุรกรรมได้ตลอดเวลาผ่านหน้าแดชบอร์ด
                    </p>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-secondary/35 space-y-1.5">
                    <strong className="text-foreground font-semibold text-sm sm:text-base flex items-center gap-2">
                      • สิทธิในการขอแก้ไขข้อมูล
                    </strong>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      ข้อมูลชื่อและรูปภาพจะอัปเดตอัตโนมัติตาม Discord และการตั้งค่าห้องเสียงสามารถแก้ไขได้ผ่านคำสั่งบอท
                    </p>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-secondary/35 space-y-1.5">
                    <strong className="text-foreground font-semibold text-sm sm:text-base flex items-center gap-2">
                      • สิทธิในการขอลบข้อมูล (Right to Erasure)
                    </strong>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      สามารถแจ้งความประสงค์ขอลบบัญชีและข้อมูลส่วนตัวออกจากฐานข้อมูลระบบได้ผ่านทีมงานผู้ดูแล
                    </p>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-secondary/35 space-y-1.5">
                    <strong className="text-foreground font-semibold text-sm sm:text-base flex items-center gap-2">
                      • สิทธิในการเพิกถอนความยินยอม
                    </strong>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      สามารถยกเลิกการเชื่อมต่อสิทธิ์ Discord Authorized App ผ่านหน้าการตั้งค่าของ Discord ได้ทันที
                    </p>
                  </div>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-honey/10 border border-honey/25 space-y-1.5 text-xs sm:text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground flex items-center gap-2">
                    <Info className="w-4 h-4 text-honey" /> รายละเอียดเพิ่มเติม:
                  </p>
                  <p className="leading-relaxed">
                    ท่านสามารถตรวจสอบผังข้อมูลเชิงลึกและรอบการลบข้อมูลอัตโนมัติ (Retention Cycles) ได้ที่หน้า{' '}
                    <a href="/privacy/permissions" className="text-honey hover:underline font-medium">
                      การจัดการข้อมูลและสิทธิ์ (/privacy/permissions)
                    </a>
                  </p>
                </div>
              </div>
            </section>

            {/* SECTION 7: Contact & Copyright */}
            <section
              id="contact"
              className="scroll-mt-24 rounded-2xl border border-border/70 bg-card/70 p-6 sm:p-7 shadow-xs space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                    7. ช่องทางติดต่อและข้อมูลลิขสิทธิ์
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    ช่องทางการสื่อสารกับทีมงานและข้อกำหนดทางกฎหมาย
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm sm:text-base font-normal text-muted-foreground leading-relaxed">
                <p>
                  หากท่านมีข้อสงสัย ข้อเสนอแนะ หรือต้องการรายงานพฤติกรรมที่ไม่เหมาะสม โปรดติดต่อทีมงาน Bear Café ได้ผ่านช่องทางดังนี้:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Email Card (Full width on top row) */}
                  <a
                    href="mailto:bearcafe.work@gmail.com"
                    className="sm:col-span-2 px-4 py-3 rounded-2xl border border-border/70 bg-card hover:bg-secondary/40 hover:border-honey/40 transition-all flex items-center gap-3.5 group shadow-xs cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Email ติดต่อ</p>
                        <p className="text-xs sm:text-sm font-semibold text-foreground group-hover:text-honey transition-colors">
                          bearcafe.work@gmail.com
                        </p>
                      </div>
                      <span className="text-xs text-honey font-medium hidden sm:inline-flex items-center gap-1">
                        ส่งอีเมลหาเรา <ExternalLink className="w-3 h-3" />
                      </span>
                    </div>
                  </a>

                  {/* Discord Contact Card */}
                  <div className="px-4 py-3 rounded-2xl border border-border/70 bg-card transition-all flex items-center gap-3.5 shadow-xs">
                    <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                      <img
                        src="/icons/discord-icon.png"
                        alt="Discord Logo"
                        className="w-9 h-9 object-contain rounded-full shadow-xs"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Discord Contact</p>
                      <p className="text-xs sm:text-sm font-semibold text-foreground">
                        zeab1u
                      </p>
                    </div>
                  </div>

                  {/* Bear Cafe Server Card */}
                  <a
                    href="https://discord.gg/bearcafe"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-3 rounded-2xl border border-border/70 bg-card hover:bg-secondary/40 hover:border-honey transition-all flex items-center gap-3.5 group shadow-xs cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                      <img
                        src="/icons/bearcafe-mascot.png"
                        alt="Bear Cafe Server Mascot"
                        className="w-9 h-9 object-contain rounded-full shadow-xs group-hover:scale-110 transition-transform"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <span>Bear Cafe Server</span>
                        <ExternalLink className="w-3 h-3 text-honey" />
                      </p>
                      <p className="text-xs sm:text-sm font-semibold text-honey group-hover:underline">
                        กดเข้าร่วมเซิร์ฟเวอร์
                      </p>
                    </div>
                  </a>
                </div>

                <div className="mt-6 pt-5 border-t border-border/70 text-xs sm:text-sm text-muted-foreground leading-relaxed space-y-1">
                  <p className="font-semibold text-foreground">
                    © 2026 BEAR CAFE by Zeabiu. All rights reserved.
                  </p>
                  <p>
                    ภาพประกอบ ส่วนต่อประสานผู้ใช้ (UI Layouts) รูปแบบศิลป์
                    และองค์ประกอบความคิดสร้างสรรค์ทั้งหมดบนเว็บไซต์นี้ได้รับความคุ้มครองตามกฎหมายลิขสิทธิ์
                    ห้ามทำซ้ำ ดัดแปลง ลอกเลียนแบบ หรือแจกจ่ายโดยไม่ได้รับอนุญาตเป็นลายลักษณ์อักษร
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Floating Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 p-3 rounded-2xl bg-honey text-bear-dark shadow-lg hover:scale-105 active:scale-95 transition-all z-30 flex items-center justify-center cursor-pointer"
          title="เลื่อนขึ้นบนสุด"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}

      <CozyPageFooter />
    </div>
  );
}
