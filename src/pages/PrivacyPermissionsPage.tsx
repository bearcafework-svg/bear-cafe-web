import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Database, 
  ExternalLink, 
  Clock, 
  UserCheck, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  Sparkles,
  Layers,
  Info,
  ArrowLeft
} from 'lucide-react';
import { BearLogo } from '@/components/bear-cafe/BearLogo';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { CozyPageFooter } from '@/components/bear-cafe/CozyPageFooter';
import { PolicyNavTabs } from '@/components/bear-cafe/PolicyNavTabs';
import { motion } from 'framer-motion';
import { 
  PRIVACY_METADATA, 
  DATA_TYPES, 
  THIRD_PARTY_SERVICES, 
  RETENTION_TABLE, 
  USER_DATA_RIGHTS, 
  PrivacyStatus
} from '@/data/privacyPermissionsData';

export default function PrivacyPermissionsPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Categories list for Data Types section
  const categories = useMemo(() => {
    const set = new Set(DATA_TYPES.map((d) => d.category));
    return ['all', ...Array.from(set)];
  }, []);

  // Filtered Data Types
  const filteredDataTypes = useMemo(() => {
    return DATA_TYPES.filter((item) => {
      const matchCategory = activeCategory === 'all' || item.category === activeCategory;
      const matchSearch = 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.purpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.storage.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [activeCategory, searchQuery]);

  // Helper for System Label (user-friendly names)
  const systemLabel = (raw: string) => {
    switch (raw) {
      case 'bearcafe-bot': return 'บอท';
      case 'bear-cafe-web': return 'เว็บไซต์';
      case 'ทั้งสองระบบ': return 'บอทและเว็บไซต์';
      default: return raw;
    }
  };

  // Helper for Status Badge
  const renderStatusBadge = (status: PrivacyStatus) => {
    switch (status) {
      case 'Confirmed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>Confirmed</span>
          </span>
        );
      case 'Not Found':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-stone-500/15 text-stone-600 dark:text-stone-400 border border-stone-400/30">
            <AlertCircle className="w-3 h-3 text-stone-500" />
            <span>Not Found</span>
          </span>
        );
      case 'Unknown':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
            <HelpCircle className="w-3 h-3 text-amber-500" />
            <span>Unknown</span>
          </span>
        );
      case 'Needs Review':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-sky-500/15 text-sky-800 dark:text-sky-300 border border-sky-500/30">
            <Info className="w-3 h-3 text-sky-500" />
            <span>Needs Review</span>
          </span>
        );
      case 'Demo / Development':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-purple-500/15 text-purple-800 dark:text-purple-300 border border-purple-500/30">
            <Sparkles className="w-3 h-3 text-purple-500" />
            <span>Demo</span>
          </span>
        );
      default:
        return null;
    }
  };

  const sectionsNav = [
    { id: 'datatypes', label: '1. ประเภทข้อมูล', icon: Database },
    { id: 'thirdparty', label: '2. บริการภายนอก', icon: ExternalLink },
    { id: 'retention', label: '3. การเก็บรักษา', icon: Clock },
    { id: 'rights', label: '4. สิทธิผู้ใช้', icon: UserCheck },
  ];

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
                  Data & Permissions
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
              {PRIVACY_METADATA.title}
            </h1>
            <div className="space-y-0.5 sm:space-y-1">
              <p className="text-sm sm:text-base font-normal text-[#D6C3B5] leading-relaxed">
                การจัดการข้อมูลและความเป็นส่วนตัวเชิงเทคนิคของระบบคอมมูนิตี้ Bear Café
              </p>
              <p className="text-xs sm:text-sm font-normal text-[#D6C3B5]/80 line-clamp-2 sm:line-clamp-none">
                {PRIVACY_METADATA.subtitle}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Navigation Bar between Terms, Privacy, Permissions */}
        <PolicyNavTabs showBackToHome={false} />

        {/* Quick jump anchor links */}
        <div className="p-3 sm:p-4 rounded-2xl bg-card/70 border border-border/70 shadow-xs flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground mr-1 flex items-center gap-1 font-semibold">
            <Layers className="w-3.5 h-3.5 text-honey" /> ไปยังหัวข้อ:
          </span>
          {sectionsNav.map((s) => {
            const Icon = s.icon;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-honey/10 hover:bg-honey/20 text-foreground border border-honey/20 transition-colors"
              >
                <Icon className="w-3 h-3 text-honey" />
                <span>{s.label}</span>
              </a>
            );
          })}
        </div>

        {/* SECTION 1: ประเภทข้อมูลที่ระบบจัดเก็บ (Data Types) */}
        <section id="datatypes" className="mb-8 sm:mb-10 scroll-mt-24 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
                  Section 1 — ประเภทข้อมูลที่ระบบจัดเก็บ (Data Types)
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  จำแนกตามโครงสร้างระบบจริง พร้อมระบุวัตถุประสงค์และสถานะการตรวจสอบ
                </p>
              </div>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    activeCategory === cat
                      ? 'bg-amber-500/15 text-bear-brown dark:text-amber-300 font-semibold border border-amber-500/30 shadow-xs'
                      : 'bg-card/70 text-muted-foreground hover:text-foreground border border-border/70'
                  }`}
                >
                  {cat === 'all' ? 'ทั้งหมด' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
            <input
              type="text"
              placeholder="ค้นหาชื่อข้อมูล, วัตถุประสงค์ หรือตำแหน่งจัดเก็บ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-card/70 border border-border/70 rounded-xl !pl-10 pr-4 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-honey transition-colors"
            />
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto rounded-2xl border border-border/70 bg-card/70 shadow-xs">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border/70">
                <tr>
                  <th className="py-3 px-4 font-semibold">ข้อมูล (Data)</th>
                  <th className="py-3 px-4 font-semibold">ใช้งานใน</th>
                  <th className="py-3 px-4 font-semibold">ที่จัดเก็บ</th>
                  <th className="py-3 px-4 font-semibold">วัตถุประสงค์</th>
                  <th className="py-3 px-4 font-semibold">ระยะเวลาเก็บ</th>
                  <th className="py-3 px-4 font-semibold">ลบได้หรือไม่</th>
                  <th className="py-3 px-4 font-semibold">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-foreground">
                {filteredDataTypes.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground">{item.name}</div>
                      <div className="text-[11px] text-honey font-mono mt-0.5">{item.category}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs">
                      <span className="px-2 py-0.5 rounded bg-muted/60 border border-border/60 text-muted-foreground font-normal">
                        {systemLabel(item.system)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-muted-foreground">{item.storage}</td>
                    <td className="py-3 px-4 text-xs leading-relaxed max-w-xs text-muted-foreground">{item.purpose}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{item.retention}</td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                        item.deletable === 'ลบอัตโนมัติ' 
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                          : item.deletable === 'ลบได้เมื่อมีการร้องขอ' || item.deletable === 'ลบได้'
                          ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30'
                          : 'bg-muted/60 text-muted-foreground border border-border/60'
                      }`}>
                        {item.deletable}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {renderStatusBadge(item.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="lg:hidden space-y-3">
            {filteredDataTypes.map((item) => (
              <div key={item.id} className="bg-card/70 border border-border/70 rounded-2xl p-4 space-y-2.5 shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-honey uppercase tracking-wider font-semibold block">
                      {item.category}
                    </span>
                    <h3 className="font-semibold text-foreground text-sm">{item.name}</h3>
                  </div>
                  {renderStatusBadge(item.status)}
                </div>

                <div className="text-xs text-muted-foreground space-y-1 pt-1.5 border-t border-border/60">
                  <div><strong className="font-medium text-foreground">ใช้งานใน:</strong> {systemLabel(item.system)}</div>
                  <div><strong className="font-medium text-foreground">ที่จัดเก็บ:</strong> <span className="font-mono">{item.storage}</span></div>
                  <div><strong className="font-medium text-foreground">วัตถุประสงค์:</strong> {item.purpose}</div>
                  <div className="flex items-center justify-between pt-1">
                    <span><strong className="font-medium text-foreground">ระยะเวลา:</strong> {item.retention}</span>
                    <span className="px-2 py-0.5 rounded text-[11px] bg-muted/60 text-foreground border border-border/60 font-medium">
                      {item.deletable}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 2: บริการภายนอก (Third-Party Services) */}
        <section id="thirdparty" className="mb-8 sm:mb-10 scroll-mt-24 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
              <ExternalLink className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
                Section 2 — บริการภายนอก (Third-Party Services)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                เฉพาะบริการที่ระบบมีการส่งหรือประมวลผลข้อมูลผู้ใช้จริง
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card/70 shadow-xs">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border/70">
                <tr>
                  <th className="py-3 px-4 font-semibold">Service</th>
                  <th className="py-3 px-4 font-semibold">ใช้งานใน</th>
                  <th className="py-3 px-4 font-semibold">ข้อมูลที่ส่ง</th>
                  <th className="py-3 px-4 font-semibold">วัตถุประสงค์</th>
                  <th className="py-3 px-4 font-semibold">เก็บข้อมูลหรือไม่</th>
                  <th className="py-3 px-4 font-semibold">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-foreground">
                {THIRD_PARTY_SERVICES.map((s, i) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-semibold text-foreground">{s.name}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{systemLabel(s.project)}</td>
                    <td className="py-3 px-4 text-xs text-foreground/90">{s.dataSent}</td>
                    <td className="py-3 px-4 text-xs leading-relaxed text-muted-foreground">{s.purpose}</td>
                    <td className="py-3 px-4 text-xs font-medium">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                        s.isDataStored === 'Confirmed' 
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                      }`}>
                        {s.isDataStored}
                      </span>
                      <div className="text-[11px] text-muted-foreground mt-1">{s.retentionNote}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {renderStatusBadge(s.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECTION 3: ระยะเวลาการเก็บรักษาข้อมูล (Data Retention) */}
        <section id="retention" className="mb-8 sm:mb-10 scroll-mt-24 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
                Section 3 — ระยะเวลาการเก็บรักษาข้อมูล (Data Retention)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                นโยบายการจัดเก็บและลบข้อมูลอัตโนมัติของระบบ
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card/70 shadow-xs">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border/70">
                <tr>
                  <th className="py-3 px-4 font-semibold">ข้อมูล</th>
                  <th className="py-3 px-4 font-semibold">ใช้งานใน</th>
                  <th className="py-3 px-4 font-semibold">ระยะเวลาเก็บ</th>
                  <th className="py-3 px-4 font-semibold">วิธีลบ</th>
                  <th className="py-3 px-4 font-semibold">ลบอัตโนมัติ</th>
                  <th className="py-3 px-4 font-semibold">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-foreground">
                {RETENTION_TABLE.map((r, i) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-foreground">{r.tableOrData}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{systemLabel(r.system)}</td>
                    <td className="py-3 px-4 text-xs font-semibold text-honey">{r.retention}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{r.deleteMethod}</td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs">
                      {r.hasAutoDelete ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" /> มีระบบ Auto-delete
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-muted/60 text-muted-foreground border border-border/60">
                          ไม่พบการลบอัตโนมัติ
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {renderStatusBadge(r.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECTION 4: สิทธิในข้อมูลของผู้ใช้งาน (User Data Rights) */}
        <section id="rights" className="mb-12 scroll-mt-24 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-honey/20 text-honey flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
                Section 4 — สิทธิในข้อมูลของผู้ใช้งาน (User Data Rights)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                ความสามารถของระบบในปัจจุบันในการรองรับคำขอและการจัดการสิทธิของสมาชิก
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {USER_DATA_RIGHTS.map((right) => (
              <div 
                key={right.id} 
                className="p-4 rounded-2xl bg-card/70 border border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
              >
                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground text-sm">{right.right}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{right.description}</p>
                  <p className="text-[11px] text-muted-foreground">วิธีการ: {right.note}</p>
                </div>
                <div className="shrink-0">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                    right.supportLevel === 'Supported' 
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                      : right.supportLevel === 'Partially Supported'
                      ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                      : 'bg-muted/60 text-muted-foreground border border-border/60'
                  }`}>
                    {right.supportLevel}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <CozyPageFooter />
    </div>
  );
}
