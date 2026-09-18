import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Database, 
  Lock, 
  UserCheck, 
  ArrowRight,
  Bot,
  Globe,
  CheckCircle2,
  FileText,
  Layers,
  ArrowLeft,
  Mail,
  Server,
  ExternalLink
} from 'lucide-react';
import { BearLogo } from '@/components/bear-cafe/BearLogo';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { PolicyNavTabs } from '@/components/bear-cafe/PolicyNavTabs';
import { CozyPageFooter } from '@/components/bear-cafe/CozyPageFooter';

export default function PrivacyPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [activeSection, setActiveSection] = useState<string>('intro');

  const sections = [
    { id: 'intro', title: '1. บทนำและความโปร่งใส' },
    { id: 'collection', title: '2. ข้อมูลที่เราจัดเก็บ' },
    { id: 'discord-permissions', title: '3. สิทธิ์ Discord และ OAuth Scopes' },
    { id: 'bot-privacy', title: '4. ความเป็นส่วนตัวบนบอท (ไม่มีการอัดเสียง)' },
    { id: 'web-privacy', title: '5. ความเป็นส่วนตัวบน Web Dashboard' },
    { id: 'third-parties', title: '6. บริการภายนอกที่จำเป็น' },
    { id: 'retention', title: '7. ระยะเวลาจัดเก็บ & Auto-Delete' },
    { id: 'pdpa-rights', title: '8. สิทธิ์ของผู้ใช้งาน (PDPA Rights)' },
    { id: 'security', title: '9. มาตรการรักษาความปลอดภัย' },
    { id: 'contact', title: '10. การติดต่อและสอบถาม' },
  ];

  // Scrollspy to highlight active section in TOC
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 140;
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i].id);
        if (el && el.offsetTop <= scrollPosition) {
          setActiveSection(sections[i].id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors selection:bg-amber-500/30 selection:text-foreground flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-card/85 border-b border-border shadow-xs">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="group-hover:scale-105 transition-transform">
              <BearLogo size="sm" noFloat />
            </div>
            <div>
              <span className="font-bold text-base sm:text-lg text-foreground tracking-tight flex items-center gap-1.5">
                Bear Café
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-honey/15 text-bear-brown dark:text-honey border border-honey/25 hidden sm:inline-block">
                  Privacy Policy
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
              className="rounded-xl border-border hover:bg-secondary text-sm font-medium bg-card"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              {isAuthenticated ? 'กลับหน้าหลัก' : 'เข้าสู่ระบบ'}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Layout — Synchronized with Index.tsx Structure */}
      <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8 lg:gap-10 flex-1">
        {/* Main Page Style Hero Banner — 100% Match to Index.tsx */}
        <motion.div
          initial={{ opacity: 0.92, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative h-[180px] overflow-hidden rounded-2xl bg-cover bg-center bg-no-repeat sm:h-[220px] sm:rounded-[20px] lg:h-[264px]"
          style={{
            backgroundImage:
              "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.4) 100%), url('/banner/welcome_banner.jpg')",
          }}
        >
          <div className="flex h-full flex-col justify-end gap-1.5 px-4 pb-4 sm:justify-center sm:gap-2 sm:px-6 sm:pb-0 lg:px-10">
            <h1 className="md:bear-h1-bold bear-h2-bold text-white">
              นโยบายความเป็นส่วนตัว & สิทธิ์ Discord / PDPA
            </h1>
            <div>
              <p className="md:bear-body-regular-semibold bear-body-small-medium text-[#D6C3B5]">
                Bear Café ให้ความสำคัญกับความโปร่งใสและการดูแลข้อมูลส่วนบุคคลของคุณ
              </p>
              <p className="bear-body-regular-semibold bear-body-small-medium text-[#D6C3B5] line-clamp-2 sm:line-clamp-none">
                ไม่มีการดักฟังหรือบันทึกเสียงสนทนาในห้องเสียง และเก็บเฉพาะข้อมูลที่จำเป็นตามโค้ดจริง
              </p>
            </div>
          </div>
        </motion.div>

        {/* Navigation Tabs between Terms, Privacy, Permissions */}
        <PolicyNavTabs showBackToHome={false} />

        {/* Banner to Technical Permissions Page */}
        <div className="p-5 sm:p-6 rounded-2xl bg-card border border-border shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0 mt-0.5">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">ต้องการตรวจสอบข้อมูลเชิงเทคนิคและรอบ Retention?</h2>
              <p className="text-base sm:text-lg text-muted-foreground mt-1 leading-relaxed">
                ดูผังข้อมูลละเอียด ตาราง Supabase, Cron Job การลบอัตโนมัติ และสิทธิ์ Access Control ได้ที่หน้าตรวจสอบข้อมูล
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/privacy/permissions')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-honey hover:bg-honey-dark text-bear-dark text-base sm:text-lg font-semibold transition-colors shrink-0 shadow-xs cursor-pointer"
          >
            <span>เปิดหน้าตรวจสอบสิทธิ์และข้อมูล</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Layout: Sidebar TOC + Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Table of Contents (Desktop Sticky) */}
          <aside className="hidden lg:block lg:col-span-4 sticky top-24 space-y-4">
            <div className="p-5 rounded-2xl bg-card border border-border shadow-xs backdrop-blur-sm">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-honey" />
                <span>สารบัญนโยบาย</span>
              </h3>

              <nav className="space-y-1.5">
                {sections.map((sec) => (
                  <a
                    key={sec.id}
                    href={`#${sec.id}`}
                    className={`block px-3.5 py-2 rounded-xl text-base sm:text-[17px] transition-colors ${
                      activeSection === sec.id
                        ? 'bg-honey/15 text-bear-brown dark:text-honey font-bold border border-honey/30 shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
                  >
                    {sec.title}
                  </a>
                ))}
              </nav>

              <div className="pt-4 mt-4 border-t border-border space-y-2.5 text-base sm:text-[17px] text-muted-foreground">
                <a
                  href="/terms"
                  className="flex items-center justify-between text-honey hover:underline font-medium"
                >
                  <span>ข้อกำหนดการใช้งาน (Terms)</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
                <a
                  href="/privacy/permissions"
                  className="flex items-center justify-between text-honey hover:underline font-medium"
                >
                  <span>ตรวจสอบสิทธิ์เชิงเทคนิค (Permissions)</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </aside>

          {/* Main Policy Content Articles */}
          <div className="lg:col-span-8 space-y-8 text-foreground/90 leading-relaxed">
            {/* Section 1: Intro */}
            <section id="intro" className="p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-xs space-y-4 scroll-mt-24">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-honey/20 text-honey flex items-center justify-center text-base font-mono font-bold shrink-0">01</span>
                บทนำและหลักการคุ้มครองข้อมูล (Introduction)
              </h2>
              <div className="space-y-3.5 text-lg sm:text-[19px] leading-relaxed">
                <p>
                  Bear Café ยึดถือหลักการ <strong className="text-foreground">Data Minimization (เก็บเฉพาะข้อมูลที่จำเป็นต่อการใช้งานจริง)</strong> และ{' '}
                  <strong className="text-foreground">Privacy by Design</strong> โดยเราเก็บรวบรวมข้อมูลเท่าที่จำเป็นสำหรับการให้บริการคอมมูนิตี้คาเฟ่ 
                  การคำนวณแต้มกิจกรรม และการรักษาความปลอดภัยภายในเซิร์ฟเวอร์เท่านั้น
                </p>
                <p className="text-muted-foreground">
                  ระบบของเราประกอบด้วยสองส่วนหลักที่ทำงานผสานกัน คือ <strong className="text-foreground">Bear Café Bot (`bearcafe-bot`)</strong>{' '}
                  ซึ่งทำหน้าที่ดูแลกิจกรรมภายในเซิร์ฟเวอร์ Discord และ <strong className="text-foreground">Bear Café Web Dashboard (`bear-cafe-web`)</strong>{' '}
                  ซึ่งเป็นหน้าเว็บสำหรับให้สมาชิกเข้าตรวจสอบสถิติ แลกของรางวัล และจัดการไอเทม
                </p>
              </div>
            </section>

            {/* Section 2: Data Collection */}
            <section id="collection" className="p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-xs space-y-4 scroll-mt-24">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-honey/20 text-honey flex items-center justify-center text-base font-mono font-bold shrink-0">02</span>
                ข้อมูลที่เราจัดเก็บ (Data We Collect)
              </h2>
              <p className="text-lg sm:text-[19px]">ข้อมูลที่ระบบจัดเก็บแบ่งออกเป็นประเภทต่าง ๆ ดังนี้:</p>
              <ul className="space-y-3.5 list-disc list-inside text-muted-foreground pl-1 text-lg sm:text-[19px] leading-relaxed">
                <li>
                  <strong className="text-foreground">ข้อมูลบัญชี Discord:</strong> Discord User ID, Username, Display Name, และ Avatar URL (ใช้ระบุตัวตนและแสดงผลโปรไฟล์)
                </li>
                <li>
                  <strong className="text-foreground">ข้อมูลสถิติการใช้งานห้องเสียง (Voice Activity):</strong> เวลาที่เข้า-ออกห้องเสียง และระยะเวลาที่อยู่ในห้องเสียง (ใช้สำหรับระบบคิดแต้มสะสม Voice Points)
                </li>
                <li>
                  <strong className="text-foreground">ประวัติกิจกรรมและแต้มสะสม:</strong> แต้มสะสมในคาเฟ่, ประวัติการโอนแต้ม, ภารกิจประจำวัน (Quests), ประวัติการสุ่มกาชา และไอเทมในคลัง
                </li>
                <li>
                  <strong className="text-foreground">การตั้งค่าห้องเสียงส่วนตัว (Smart Room / Rent House):</strong> ชื่อห้อง, ลิมิตผู้ใช้งาน, สถานะล็อก/ซ่อนห้อง และรายชื่อ Trusted/Blocked
                </li>
                <li>
                  <strong className="text-foreground">ข้อมูลเซสชันหน้าเว็บ:</strong> Supabase Auth Session Token จัดเก็บใน Local Storage ของเบราว์เซอร์เพื่อคงสถานะการเข้าสู่ระบบ
                </li>
              </ul>
            </section>

            {/* Section 3: Discord Permissions (HIGHLIGHT!) */}
            <section id="discord-permissions" className="p-6 sm:p-8 rounded-2xl bg-card border-2 border-honey/40 shadow-xs space-y-5 scroll-mt-24 relative overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                    3. สิทธิ์ Discord และเหตุผลในการขอสิทธิ์ (Discord Permissions)
                  </h2>
                  <p className="text-base sm:text-lg text-muted-foreground mt-0.5">
                    ตรวจสอบจากโค้ดจริง (OAuth Scopes: identify และ guilds)
                  </p>
                </div>
              </div>

              {/* Callout Box on Discord guilds permission */}
              <div className="rounded-xl border border-honey/30 bg-honey/10 p-5 space-y-3">
                <div className="flex items-center gap-2 text-foreground font-bold text-lg sm:text-xl">
                  <Server className="w-5 h-5 text-honey shrink-0" />
                  ทำไมระบบจึงต้องขอสิทธิ์ "รู้ว่าท่านอยู่ในเซิร์ฟเวอร์ใดบ้าง" (guilds scope)?
                </div>
                <p className="text-lg sm:text-[19px] text-muted-foreground leading-relaxed">
                  ระบบของ Bear Café ขอสิทธิ์การเข้าถึงรายชื่อเซิร์ฟเวอร์ (<code>guilds</code> scope)
                  เพื่อวัตถุประสงค์เดียวคือ{' '}
                  <strong className="text-foreground font-semibold">
                    "ตรวจสอบและยืนยันว่าบัญชีของท่านเป็นสมาชิกของเซิร์ฟเวอร์ Bear Café หรือไม่"
                  </strong>{' '}
                  ก่อนอนุญาตให้เข้าใช้งานแดชบอร์ด
                </p>
                <div className="p-4 rounded-xl bg-card border border-border space-y-2.5 text-base sm:text-lg text-muted-foreground">
                  <p className="font-bold text-foreground flex items-center gap-2 text-base sm:text-lg">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    ความโปร่งใสที่ยืนยันจากโค้ดจริง:
                  </p>
                  <ul className="list-disc list-inside space-y-1.5 pl-1 text-base sm:text-lg">
                    <li>ระบบตรวจสอบเฉพาะ ID เซิร์ฟเวอร์ Bear Café ในหน่วยความจำ (Memory)</li>
                    <li><strong className="text-foreground">ไม่มีการบันทึกรายชื่อเซิร์ฟเวอร์อื่น ๆ ของคุณลงฐานข้อมูลเด็ดขาด</strong></li>
                  </ul>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl border border-border bg-secondary/35 space-y-2">
                  <strong className="text-foreground text-lg sm:text-xl flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-honey" /> identify scope
                  </strong>
                  <p className="text-muted-foreground text-base sm:text-[18px] leading-relaxed">
                    ขอ User ID, Username, และ Avatar เพื่อแสดงผลโปรไฟล์และบันทึกคะแนนสะสม
                  </p>
                </div>

                <div className="p-5 rounded-xl border border-border bg-secondary/35 space-y-2">
                  <strong className="text-foreground text-lg sm:text-xl flex items-center gap-2">
                    <Layers className="w-5 h-5 text-honey" /> Roles & Ban Check
                  </strong>
                  <p className="text-muted-foreground text-base sm:text-[18px] leading-relaxed">
                    ตรวจสอบยศและสถานะ Role-ban ผ่าน Discord Bot Token ก่อนอนุญาตให้เข้าแดชบอร์ด
                  </p>
                </div>
              </div>
            </section>

            {/* Section 4: Bot Specific (No Recording) */}
            <section id="bot-privacy" className="p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-xs space-y-4 scroll-mt-24">
              <div className="flex items-center gap-2.5 text-honey mb-1">
                <Bot className="w-6 h-6" />
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                  4. มาตรการความเป็นส่วนตัวบน Discord Bot
                </h2>
              </div>
              <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-lg sm:text-xl">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>ไม่มีการดักฟังหรือบันทึกเสียงสนทนา (Zero Voice Recording)</span>
                </div>
                <p className="text-lg sm:text-[19px] text-muted-foreground leading-relaxed pl-7">
                  บอท Bear Café ตรวจจับเฉพาะ <em>Voice State Events</em> (เข้าห้องไหน, ย้ายห้องเมื่อใด, อยู่กี่นาที) 
                  เพื่อคำนวณแต้มสะสม <strong className="text-foreground">ระบบไม่มี Audio Receiver หรือโค้ดใด ๆ ที่สามารถบันทึกเสียงของคุณได้ทั้งสิ้น</strong>
                </p>
              </div>
              <p className="text-muted-foreground text-lg sm:text-[19px] leading-relaxed">
                ระบบมินิเกมที่ใช้เสียง (Google Translate TTS) จะส่งเฉพาะ <em>คำเฉลยของเกม</em> ไปแปลงเป็นเสียง โดยพักเสียงใน RAM ชั่วคราว ไม่บันทึกเสียงผู้ใช้
              </p>
            </section>

            {/* Section 5: Web Specific */}
            <section id="web-privacy" className="p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-xs space-y-4 scroll-mt-24">
              <div className="flex items-center gap-2.5 text-honey mb-1">
                <Globe className="w-6 h-6" />
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                  5. ความเป็นส่วนตัวบน Web Dashboard
                </h2>
              </div>
              <div className="space-y-3.5 text-lg sm:text-[19px] leading-relaxed">
                <p className="text-muted-foreground">
                  เว็บไซต์ใช้ <strong className="text-foreground">LocalStorage</strong> ในการเก็บ Auth Session Token เพื่อคงสถานะล็อกอิน และจะถูกลบออกทันทีเมื่อกด Logout
                </p>
                <p className="text-muted-foreground">
                  เราใช้ <strong className="text-foreground">Cloudflare Turnstile</strong> เพื่อป้องกันบอทโจมตี โดยไม่มีการเก็บ Token หรือ IP Address ลงในฐานข้อมูล
                </p>
              </div>
            </section>

            {/* Section 6: Third Parties */}
            <section id="third-parties" className="p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-xs space-y-4 scroll-mt-24">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-honey/20 text-honey flex items-center justify-center text-base font-mono font-bold shrink-0">06</span>
                บริการภายนอกที่จำเป็น (Third-Party Services)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl border border-border bg-secondary/35">
                  <strong className="text-foreground block text-lg sm:text-xl mb-1">Discord API:</strong>
                  <span className="text-muted-foreground text-base sm:text-lg">ระบบล็อกอินและรับส่ง Event</span>
                </div>
                <div className="p-5 rounded-xl border border-border bg-secondary/35">
                  <strong className="text-foreground block text-lg sm:text-xl mb-1">Supabase PostgreSQL:</strong>
                  <span className="text-muted-foreground text-base sm:text-lg">ฐานข้อมูลหลักที่มี Row Level Security</span>
                </div>
                <div className="p-5 rounded-xl border border-border bg-secondary/35">
                  <strong className="text-foreground block text-lg sm:text-xl mb-1">Upstash Redis:</strong>
                  <span className="text-muted-foreground text-base sm:text-lg">แคชความปลอดภัย Anti-Spam (TTL 10-60 วินาที)</span>
                </div>
                <div className="p-5 rounded-xl border border-border bg-secondary/35">
                  <strong className="text-foreground block text-lg sm:text-xl mb-1">Cloudflare & Vercel:</strong>
                  <span className="text-muted-foreground text-base sm:text-lg">ระบบความปลอดภัยและเว็บโฮสติ้ง</span>
                </div>
              </div>
            </section>

            {/* Section 7: Retention */}
            <section id="retention" className="p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-xs space-y-4 scroll-mt-24">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-honey/20 text-honey flex items-center justify-center text-base font-mono font-bold shrink-0">07</span>
                ระยะเวลาการเก็บรักษาข้อมูล (Data Retention)
              </h2>
              <ul className="space-y-3 list-disc list-inside text-muted-foreground pl-1 text-lg sm:text-[19px] leading-relaxed">
                <li><strong className="text-foreground">เควสต์ประจำวัน:</strong> ลบอัตโนมัติเมื่อเกิน 7 วัน (Summary เกิน 30 วัน)</li>
                <li><strong className="text-foreground">ส่งดอกไม้ (Flower):</strong> ลบ Session ทันทีที่จบรายการ</li>
                <li><strong className="text-foreground">สำรองโครงสร้างห้อง:</strong> เก็บสูงสุด 5 ชุดล่าสุดต่อเซิร์ฟเวอร์</li>
                <li><strong className="text-foreground">Anti-Spam / Redis:</strong> ลบอัตโนมัติภายใน 10-60 วินาที</li>
              </ul>
            </section>

            {/* Section 8: PDPA Rights (HIGHLIGHT!) */}
            <section id="pdpa-rights" className="p-6 sm:p-8 rounded-2xl bg-card border-2 border-honey/40 shadow-xs space-y-5 scroll-mt-24">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                    8. สิทธิ์ของผู้ใช้งานและการคุ้มครองข้อมูล (PDPA Rights)
                  </h2>
                  <p className="text-base sm:text-lg text-muted-foreground mt-0.5">
                    การใช้สิทธิ์ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl border border-border bg-secondary/35 space-y-2">
                  <strong className="text-foreground text-lg sm:text-xl flex items-center gap-2">
                    • สิทธิในการเข้าถึง (Right of Access)
                  </strong>
                  <p className="text-muted-foreground text-base sm:text-[18px] leading-relaxed">
                    ตรวจสอบข้อมูลโปรไฟล์ คะแนนสะสม และประวัติธุรกรรมได้ตลอดเวลาผ่านแดชบอร์ด
                  </p>
                </div>

                <div className="p-5 rounded-xl border border-border bg-secondary/35 space-y-2">
                  <strong className="text-foreground text-lg sm:text-xl flex items-center gap-2">
                    • สิทธิในการขอแก้ไข (Right to Rectification)
                  </strong>
                  <p className="text-muted-foreground text-base sm:text-[18px] leading-relaxed">
                    ข้อมูลโปรไฟล์ซิงค์อัตโนมัติตาม Discord และการตั้งค่าห้องสามารถปรับแต่งผ่านคำสั่งบอท
                  </p>
                </div>

                <div className="p-5 rounded-xl border border-border bg-secondary/35 space-y-2">
                  <strong className="text-foreground text-lg sm:text-xl flex items-center gap-2">
                    • สิทธิในการขอลบข้อมูล (Right to Erasure)
                  </strong>
                  <p className="text-muted-foreground text-base sm:text-[18px] leading-relaxed">
                    สามารถแจ้งความประสงค์ขอลบบัญชีและประวัติการใช้งานออกจากฐานข้อมูลได้ผ่านทีมงาน
                  </p>
                </div>

                <div className="p-5 rounded-xl border border-border bg-secondary/35 space-y-2">
                  <strong className="text-foreground text-lg sm:text-xl flex items-center gap-2">
                    • สิทธิในการเพิกถอนสิทธิ์ (Revoke OAuth)
                  </strong>
                  <p className="text-muted-foreground text-base sm:text-[18px] leading-relaxed">
                    ยกเลิกการเชื่อมต่อสิทธิ์ Authorized Apps ได้ตลอดเวลาผ่านหน้า Settings ในแอป Discord
                  </p>
                </div>
              </div>
            </section>

            {/* Section 9: Security */}
            <section id="security" className="p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-xs space-y-4 scroll-mt-24">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-honey/20 text-honey flex items-center justify-center text-base font-mono font-bold shrink-0">09</span>
                มาตรการรักษาความปลอดภัย (Security Measures)
              </h2>
              <p className="text-muted-foreground text-lg sm:text-[19px] leading-relaxed">
                ข้อมูลการเชื่อมต่อทั้งหมดได้รับการเข้ารหัสด้วยมาตรฐาน HTTPS และใช้ <strong className="text-foreground">Supabase Row Level Security (RLS)</strong>{' '}
                ป้องกันไม่ให้สมาชิกรายอื่นเข้าถึงข้อมูลส่วนตัวหรือคะแนนของคุณได้ และกุญแจ Service Role Key จะถูกเก็บรักษาเป็นความลับบนสภาพแวดล้อมที่ปลอดภัยเท่านั้น
              </p>
            </section>

            {/* Section 10: Contact with Custom Icons and Join Server Link */}
            <section id="contact" className="p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-xs space-y-5 scroll-mt-24">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-honey/20 text-honey flex items-center justify-center text-base font-mono font-bold shrink-0">10</span>
                การติดต่อสอบถาม (Contact Us)
              </h2>
              
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Email Card (Full width on top row) */}
                  <a
                    href="mailto:bearcafe.work@gmail.com"
                    className="sm:col-span-2 px-4 py-3 rounded-xl sm:rounded-2xl border border-border bg-card hover:bg-secondary/40 hover:border-honey/40 transition-all flex items-center gap-3.5 group shadow-xs cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Email ติดต่อ</p>
                        <p className="text-sm sm:text-base font-bold text-foreground group-hover:text-honey transition-colors">
                          bearcafe.work@gmail.com
                        </p>
                      </div>
                      <span className="text-xs text-honey font-medium hidden sm:inline-flex items-center gap-1">
                        ส่งอีเมลหาเรา <ExternalLink className="w-3 h-3" />
                      </span>
                    </div>
                  </a>

                  {/* Discord Contact Card with Image 1 */}
                  <div className="px-4 py-3 rounded-xl sm:rounded-2xl border border-border bg-card transition-all flex items-center gap-3.5 shadow-xs">
                    <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                      <img
                        src="/icons/discord-icon.png"
                        alt="Discord Logo"
                        className="w-10 h-10 object-contain rounded-full shadow-xs"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Discord Contact</p>
                      <p className="text-sm sm:text-base font-bold text-foreground">
                        zeab1u
                      </p>
                    </div>
                  </div>

                  {/* Bear Cafe Server Card with Image 2 + Link + "กดเข้าร่วมเซิร์ฟเวอร์" */}
                  <a
                    href="https://discord.gg/bearcafe"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-3 rounded-xl sm:rounded-2xl border border-border bg-card hover:bg-secondary/40 hover:border-honey transition-all flex items-center gap-3.5 group shadow-xs cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                      <img
                        src="/icons/bearcafe-mascot.png"
                        alt="Bear Cafe Server Mascot"
                        className="w-10 h-10 object-contain rounded-full shadow-xs group-hover:scale-110 transition-transform"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <span>Bear Cafe Server</span>
                        <ExternalLink className="w-3 h-3 text-honey" />
                      </p>
                      <p className="text-sm sm:text-base font-bold text-honey group-hover:underline">
                        กดเข้าร่วมเซิร์ฟเวอร์
                      </p>
                    </div>
                  </a>
                </div>
            </section>
          </div>
        </div>
      </main>

      <CozyPageFooter />
    </div>
  );
}
