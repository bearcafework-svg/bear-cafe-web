import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, 
  Server, 
  Database, 
  Activity, 
  ExternalLink, 
  Clock, 
  KeyRound, 
  UserCheck, 
  CheckSquare, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  Sparkles,
  Layers,
  ArrowDown,
  Lock,
  Cpu,
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
  SYSTEM_OVERVIEWS, 
  DATA_TYPES, 
  THIRD_PARTY_SERVICES, 
  RETENTION_TABLE, 
  ACCESS_CONTROL_ITEMS, 
  USER_DATA_RIGHTS, 
  PRIVACY_CHECKLIST_ITEMS,
  PrivacyStatus
} from '@/data/privacyPermissionsData';

export default function PrivacyPermissionsPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Persistent checklist state via localStorage
  const [checklist, setChecklist] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('bear_cafe_privacy_checklist_v1');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    const initial: Record<string, boolean> = {};
    PRIVACY_CHECKLIST_ITEMS.forEach((item) => {
      initial[item.id] = item.checked;
    });
    return initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem('bear_cafe_privacy_checklist_v1', JSON.stringify(checklist));
    } catch {
      // ignore
    }
  }, [checklist]);

  const toggleChecklistItem = (id: string) => {
    setChecklist((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const completedCount = useMemo(() => {
    return Object.values(checklist).filter(Boolean).length;
  }, [checklist]);

  // Categories list for Section 2
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

  // Helper for Status Badge
  const renderStatusBadge = (status: PrivacyStatus) => {
    switch (status) {
      case 'Confirmed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>Confirmed</span>
          </span>
        );
      case 'Not Found':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-500/15 text-stone-600 dark:text-stone-400 border border-stone-400/30">
            <AlertCircle className="w-3 h-3 text-stone-500" />
            <span>Not Found</span>
          </span>
        );
      case 'Unknown':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
            <HelpCircle className="w-3 h-3 text-amber-500" />
            <span>Unknown</span>
          </span>
        );
      case 'Needs Review':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-500/15 text-sky-800 dark:text-sky-300 border border-sky-500/30">
            <Info className="w-3 h-3 text-sky-500" />
            <span>Needs Review</span>
          </span>
        );
      case 'Demo / Development':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/15 text-purple-800 dark:text-purple-300 border border-purple-500/30">
            <Sparkles className="w-3 h-3 text-purple-500" />
            <span>Demo</span>
          </span>
        );
      default:
        return null;
    }
  };

  const sectionsNav = [
    { id: 'overview', label: '1. ภาพรวมระบบ', icon: Server },
    { id: 'datatypes', label: '2. ประเภทข้อมูล', icon: Database },
    { id: 'dataflow', label: '3. Data Flow', icon: Activity },
    { id: 'thirdparty', label: '4. Third-Party', icon: ExternalLink },
    { id: 'retention', label: '5. การเก็บรักษา', icon: Clock },
    { id: 'access', label: '6. การเข้าถึง', icon: KeyRound },
    { id: 'rights', label: '7. สิทธิผู้ใช้', icon: UserCheck },
    { id: 'checklist', label: '8. ตรวจสอบระบบ', icon: CheckSquare },
  ];

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
              {PRIVACY_METADATA.title}
            </h1>
            <div>
              <p className="md:bear-body-regular-semibold bear-body-small-medium text-[#D6C3B5]">
                การจัดการข้อมูลและความเป็นส่วนตัวเชิงเทคนิคของระบบคอมมูนิตี้ Bear Café
              </p>
              <p className="bear-body-regular-semibold bear-body-small-medium text-[#D6C3B5] line-clamp-2 sm:line-clamp-none">
                {PRIVACY_METADATA.subtitle}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Navigation Bar between Terms, Privacy, Permissions */}
        <PolicyNavTabs showBackToHome={false} />

        {/* Quick jump anchor links */}
        <div className="mb-10 p-4 rounded-2xl bg-card border border-honey/25 dark:border-white/10 shadow-xs flex flex-wrap items-center gap-2">
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

        {/* SECTION 1: ภาพรวมระบบ (System Overview) */}
        <section id="overview" className="mb-12 scroll-mt-24">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-honey/20 text-honey flex items-center justify-center">
                <Server className="w-4 h-4" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                Section 1 — ภาพรวมระบบ (System Overview)
              </h2>
            </div>
            <span className="text-xs text-muted-foreground hidden sm:inline-block">2 ระบบหลัก</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SYSTEM_OVERVIEWS.map((sys) => (
              <div 
                key={sys.id}
                className="bg-card border border-honey/20 dark:border-white/10 rounded-2xl p-6 shadow-xs relative flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                        {sys.name}
                        <code className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                          {sys.project}
                        </code>
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                        {sys.role}
                      </p>
                    </div>
                    {renderStatusBadge(sys.status)}
                  </div>

                  <div className="space-y-3 my-4 text-xs sm:text-sm">
                    <div className="p-3 rounded-xl bg-muted/40 border border-border">
                      <span className="text-muted-foreground block text-xs font-semibold mb-0.5">ฐานข้อมูลหลัก (Database)</span>
                      <span className="text-foreground font-mono text-xs">{sys.database}</span>
                    </div>

                    {sys.tempStorage && (
                      <div className="p-3 rounded-xl bg-muted/40 border border-border">
                        <span className="text-muted-foreground block text-xs font-semibold mb-0.5">พื้นที่เก็บข้อมูลชั่วคราว (Cache)</span>
                        <span className="text-foreground font-mono text-xs">{sys.tempStorage}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    บริการภายนอกที่เกี่ยวข้อง:
                  </h4>
                  <div className="space-y-2">
                    {sys.externalServices.map((ext, i) => (
                      <div 
                        key={i} 
                        className="flex items-start justify-between gap-2 text-xs p-2.5 rounded-xl bg-card border border-border"
                      >
                        <div>
                          <strong className="text-foreground block">{ext.name}</strong>
                          <span className="text-muted-foreground text-[11px]">{ext.note}</span>
                        </div>
                        {renderStatusBadge(ext.status)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 2: ประเภทข้อมูลที่ระบบจัดเก็บ (Data Types) */}
        <section id="datatypes" className="mb-12 scroll-mt-24">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-honey/20 text-honey flex items-center justify-center">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                  Section 2 — ประเภทข้อมูลที่ระบบจัดเก็บ (Data Types)
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  จำแนกตามโครงสร้างระบบจริง พร้อมระบุวัตถุประสงค์และหลักฐานในโค้ด
                </p>
              </div>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                    activeCategory === cat
                      ? 'bg-honey text-bear-dark font-semibold shadow-xs'
                      : 'bg-card text-muted-foreground hover:text-foreground border border-border'
                  }`}
                >
                  {cat === 'all' ? 'ทั้งหมด' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Search bar */}
          <div className="mb-4 relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาชื่อข้อมูล, วัตถุประสงค์ หรือตำแหน่งจัดเก็บ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-honey"
            />
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                <tr>
                  <th className="py-3 px-4">ข้อมูล (Data)</th>
                  <th className="py-3 px-4">ระบบ</th>
                  <th className="py-3 px-4">ที่จัดเก็บ</th>
                  <th className="py-3 px-4">วัตถุประสงค์</th>
                  <th className="py-3 px-4">ระยะเวลาเก็บ</th>
                  <th className="py-3 px-4">ลบได้หรือไม่</th>
                  <th className="py-3 px-4">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {filteredDataTypes.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground">{item.name}</div>
                      <div className="text-[11px] text-honey font-mono mt-0.5">{item.category}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs">
                      <span className="px-2 py-0.5 rounded bg-muted border border-border text-muted-foreground">
                        {item.system}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-muted-foreground">{item.storage}</td>
                    <td className="py-3 px-4 text-xs leading-relaxed max-w-xs">{item.purpose}</td>
                    <td className="py-3 px-4 text-xs">{item.retention}</td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                        item.deletable === 'ลบอัตโนมัติ' 
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                          : item.deletable === 'ลบได้เมื่อมีการร้องขอ' || item.deletable === 'ลบได้'
                          ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30'
                          : 'bg-muted text-muted-foreground border border-border'
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
              <div key={item.id} className="bg-card border border-border rounded-xl p-4 space-y-2.5 shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-honey uppercase tracking-wider font-semibold block">
                      {item.category}
                    </span>
                    <h3 className="font-bold text-foreground text-sm">{item.name}</h3>
                  </div>
                  {renderStatusBadge(item.status)}
                </div>

                <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t border-border">
                  <div><strong className="text-foreground">ระบบ:</strong> {item.system}</div>
                  <div><strong className="text-foreground">ที่จัดเก็บ:</strong> <span className="font-mono">{item.storage}</span></div>
                  <div><strong className="text-foreground">วัตถุประสงค์:</strong> {item.purpose}</div>
                  <div className="flex items-center justify-between pt-1">
                    <span><strong className="text-foreground">ระยะเวลา:</strong> {item.retention}</span>
                    <span className="px-2 py-0.5 rounded text-[11px] bg-muted text-foreground border border-border">
                      {item.deletable}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 3: DATA FLOW (Visual Flow) */}
        <section id="dataflow" className="mb-12 scroll-mt-24">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-9 h-9 rounded-xl bg-honey/20 text-honey flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                Section 3 — แผนภาพการไหลของข้อมูล (Data Flow)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                แสดงเฉพาะเส้นทางที่มีการเชื่อมต่อจริงตาม Source Code
              </p>
            </div>
          </div>

          <div className="bg-card border border-honey/25 dark:border-white/10 rounded-2xl p-6 sm:p-8 shadow-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
              {/* Step 1: User & Interface */}
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-muted/30 border border-honey/30 text-center relative shadow-xs">
                  <div className="w-9 h-9 rounded-full bg-honey/20 text-honey flex items-center justify-center mx-auto mb-2">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-foreground text-sm">Discord User</h4>
                  <p className="text-xs text-muted-foreground mt-1">ผู้ใช้งานใน Discord / ผู้เข้าชมเว็บไซต์</p>
                </div>

                <div className="text-center text-muted-foreground py-1">
                  <ArrowDown className="w-4 h-4 mx-auto animate-bounce text-honey" />
                  <span className="text-[11px]">ยืนยันตัวตน & กิจกรรม</span>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border text-center">
                  <h4 className="font-bold text-foreground text-sm">Discord Gateway / OAuth2</h4>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    identify, guilds scopes<br />
                    Voice State Events
                  </p>
                </div>
              </div>

              {/* Step 2: Processing Systems */}
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-card border border-border text-center h-[120px] flex flex-col justify-center">
                  <h4 className="font-bold text-foreground text-sm flex items-center justify-center gap-1.5">
                    <Cpu className="w-4 h-4 text-honey" />
                    Bear Café Bot & Web
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    ประมวลผลคำสั่ง, เช็คชื่อ, กิจกรรมห้องเสียง, แดชบอร์ด
                  </p>
                </div>

                <div className="text-center text-muted-foreground py-1">
                  <ArrowDown className="w-4 h-4 mx-auto text-honey" />
                  <span className="text-[11px]">แยกจัดเก็บตามประเภท</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-lg bg-card border border-amber-500/30 text-center">
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold block uppercase">Temporary</span>
                    <strong className="text-xs text-foreground block">Upstash Redis</strong>
                    <span className="text-[10px] text-muted-foreground">TTL 10-60s (Anti-Spam)</span>
                  </div>

                  <div className="p-3 rounded-lg bg-card border border-sky-500/30 text-center">
                    <span className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold block uppercase">Client Session</span>
                    <strong className="text-xs text-foreground block">localStorage</strong>
                    <span className="text-[10px] text-muted-foreground">Auth Token Only</span>
                  </div>
                </div>
              </div>

              {/* Step 3: Persistent Database & Third Parties */}
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2">
                    <Database className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-foreground text-sm">Supabase PostgreSQL</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    จัดเก็บถาวร: บัญชี, แต้มสะสม, เควสต์, กาชา, ประวัติธุรกรรม
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border text-center">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-honey mb-1">
                    External Third Parties
                  </h4>
                  <ul className="text-xs text-muted-foreground space-y-1 text-left list-disc list-inside">
                    <li><strong className="text-foreground">Cloudflare:</strong> Verify Turnstile token</li>
                    <li><strong className="text-foreground">Google TTS:</strong> แปลงคำศัพท์มินิเกม (RAM)</li>
                    <li><strong className="text-foreground">Vercel:</strong> Web Hosting / CDN</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: THIRD-PARTY SERVICES */}
        <section id="thirdparty" className="mb-12 scroll-mt-24">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-9 h-9 rounded-xl bg-honey/20 text-honey flex items-center justify-center">
              <ExternalLink className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                Section 4 — บริการภายนอก (Third-Party Services)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                เฉพาะบริการที่โค้ดมีการส่งหรือประมวลผลข้อมูลผู้ใช้จริง
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                <tr>
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">ใช้กับระบบ</th>
                  <th className="py-3 px-4">ข้อมูลที่ส่ง</th>
                  <th className="py-3 px-4">วัตถุประสงค์</th>
                  <th className="py-3 px-4">เก็บข้อมูลหรือไม่</th>
                  <th className="py-3 px-4">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {THIRD_PARTY_SERVICES.map((s, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-foreground">{s.name}</td>
                    <td className="py-3 px-4 text-xs font-mono text-muted-foreground">{s.project}</td>
                    <td className="py-3 px-4 text-xs text-foreground/90">{s.dataSent}</td>
                    <td className="py-3 px-4 text-xs leading-relaxed">{s.purpose}</td>
                    <td className="py-3 px-4 text-xs font-medium">
                      <span className={`px-2 py-0.5 rounded text-[11px] ${
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

        {/* SECTION 5: RETENTION */}
        <section id="retention" className="mb-12 scroll-mt-24">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-9 h-9 rounded-xl bg-honey/20 text-honey flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                Section 5 — ระยะเวลาการเก็บรักษาข้อมูล (Data Retention)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                ตรวจสอบจาก Cron Job, Redis TTL และโค้ดจัดการข้อมูลจริง
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                <tr>
                  <th className="py-3 px-4">Data / Table</th>
                  <th className="py-3 px-4">ระบบ</th>
                  <th className="py-3 px-4">Retention</th>
                  <th className="py-3 px-4">วิธีลบ</th>
                  <th className="py-3 px-4">Auto-Delete</th>
                  <th className="py-3 px-4">หลักฐานจากโค้ด</th>
                  <th className="py-3 px-4">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {RETENTION_TABLE.map((r, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-foreground">{r.tableOrData}</td>
                    <td className="py-3 px-4 text-xs font-mono text-muted-foreground">{r.system}</td>
                    <td className="py-3 px-4 text-xs font-semibold text-honey">{r.retention}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{r.deleteMethod}</td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs">
                      {r.hasAutoDelete ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" /> มีระบบ Auto-delete
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-muted text-muted-foreground border border-border">
                          ไม่พบการลบอัตโนมัติ
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground font-mono">{r.evidence}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {renderStatusBadge(r.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECTION 6: ACCESS CONTROL */}
        <section id="access" className="mb-12 scroll-mt-24">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-9 h-9 rounded-xl bg-honey/20 text-honey flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                Section 6 — การเข้าถึงข้อมูล (Access Control)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                ระดับการเข้าถึงข้อมูลตาม Implementation จริงและ Supabase RLS Policies
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ACCESS_CONTROL_ITEMS.map((item, i) => (
              <div key={i} className="p-5 rounded-2xl bg-card border border-border space-y-2.5 shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-foreground text-sm sm:text-base flex items-center gap-2">
                    <Lock className="w-4 h-4 text-honey" />
                    {item.actor}
                  </h3>
                  {renderStatusBadge(item.status)}
                </div>
                <div className="text-xs text-foreground/90 space-y-1.5 pt-1">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">ข้อมูลที่สามารถเข้าถึง:</span>
                    <span>{item.accessibleData}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">ระดับการเข้าถึง (Access Level):</span>
                    <span className="font-medium text-honey">{item.accessLevel}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono pt-1">
                    {item.implementationNote}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 7: USER DATA RIGHTS */}
        <section id="rights" className="mb-12 scroll-mt-24">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-9 h-9 rounded-xl bg-honey/20 text-honey flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                Section 7 — สิทธิในข้อมูลของผู้ใช้งาน (User Data Rights)
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
                className="p-4 rounded-xl bg-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
              >
                <div className="space-y-1">
                  <h3 className="font-bold text-foreground text-sm">{right.right}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{right.description}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">วิธีการ: {right.note}</p>
                </div>
                <div className="shrink-0">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                    right.supportLevel === 'Supported' 
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                      : right.supportLevel === 'Partially Supported'
                      ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                      : 'bg-muted text-muted-foreground border border-border'
                  }`}>
                    {right.supportLevel}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 8: PRIVACY POLICY CHECKLIST */}
        <section id="checklist" className="mb-12 scroll-mt-24">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-honey/20 text-honey flex items-center justify-center">
                <CheckSquare className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                  Section 8 — รายการตรวจสอบสำหรับผู้ดูแล (Privacy Policy Checklist)
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Checklist เชิงเทคนิคสำหรับเจ้าของระบบเพื่อตรวจสอบความพร้อมก่อนบังคับใช้นโยบาย (บันทึกอัตโนมัติในเบราว์เซอร์)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground font-medium">
                เสร็จสิ้น: <strong className="text-honey">{completedCount}</strong> / {PRIVACY_CHECKLIST_ITEMS.length} รายการ
              </span>
            </div>
          </div>

          <div className="bg-card border border-honey/20 dark:border-white/10 rounded-2xl p-6 divide-y divide-border shadow-xs">
            {PRIVACY_CHECKLIST_ITEMS.map((item) => {
              const isChecked = !!checklist[item.id];
              return (
                <label
                  key={item.id}
                  className="flex items-start gap-3.5 py-3 first:pt-0 last:pb-0 cursor-pointer hover:bg-muted/40 px-2 rounded-lg transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleChecklistItem(item.id)}
                    className="mt-0.5 rounded border-border text-honey focus:ring-honey/40 bg-card w-4 h-4"
                  />
                  <div className="flex-1 text-xs sm:text-sm">
                    <span className={`transition-colors ${isChecked ? 'text-muted-foreground line-through opacity-75' : 'text-foreground'}`}>
                      {item.label}
                    </span>
                    <span className="text-[10px] text-honey font-mono ml-2">[{item.category}]</span>
                  </div>
                </label>
              );
            })}
          </div>
        </section>
      </main>

      <CozyPageFooter />
    </div>
  );
}
