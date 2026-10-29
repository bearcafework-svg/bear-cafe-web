import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield, FileText, Database, ArrowLeft, Bot, Sparkles } from 'lucide-react';

interface PolicyNavTabsProps {
  showBackToHome?: boolean;
  variant?: 'auto' | 'community' | 'kuma';
}

export const PolicyNavTabs: React.FC<PolicyNavTabsProps> = ({ 
  showBackToHome = false,
  variant = 'auto'
}) => {
  const location = useLocation();
  const currentPath = location.pathname;

  const isKuma = variant === 'kuma' || (variant === 'auto' && (
    currentPath === '/term-of-service' || 
    currentPath === '/privacy-policy' || 
    currentPath.startsWith('/kuma')
  ));

  const communityTabs = [
    {
      label: 'ข้อกำหนดการใช้งาน',
      enLabel: 'Terms',
      path: '/terms',
      icon: FileText,
      description: 'เงื่อนไขและกฎระเบียบการใช้งานเว็บไซต์และบริการคอมมูนิตี้ Bear Café',
    },
    {
      label: 'นโยบายความเป็นส่วนตัว',
      enLabel: 'Privacy',
      path: '/privacy',
      icon: Shield,
      description: 'ความโปร่งใสในการเก็บและดูแลข้อมูลส่วนบุคคล สิทธิ์ Discord และ PDPA',
    },
    {
      label: 'การจัดการข้อมูลและสิทธิ์',
      enLabel: 'Permissions',
      path: '/privacy/permissions',
      icon: Database,
      description: 'ภาพรวมเชิงเทคนิค Data Access & System Retention',
    },
  ];

  const kumaTabs = [
    {
      label: 'ข้อกำหนดการให้บริการ',
      enLabel: 'Terms of Service',
      path: '/term-of-service',
      icon: FileText,
      description: 'ข้อกำหนดและเงื่อนไขการใช้งาน Kuma Bot',
    },
    {
      label: 'นโยบายความเป็นส่วนตัว',
      enLabel: 'Privacy Policy',
      path: '/privacy-policy',
      icon: Shield,
      description: 'นโยบายความเป็นส่วนตัวและการคุ้มครองข้อมูล Kuma Bot',
    },
  ];

  const activeTabs = isKuma ? kumaTabs : communityTabs;

  return (
    <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 py-1">
      <div className="flex items-center gap-2 self-start sm:self-center">
        {showBackToHome && (
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mr-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>กลับสู่หน้าหลัก</span>
          </Link>
        )}

        {/* Cross switcher pill between Community & Kuma Bot */}
        {isKuma ? (
          <Link
            to="/terms"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground bg-secondary/60 hover:bg-secondary border border-border/70 transition-colors"
            title="สลับไปยังเอกสารกฎระเบียบคอมมูนิตี้ Bear Café"
          >
            <Sparkles className="w-3.5 h-3.5 text-honey" />
            <span>เอกสารคอมมูนิตี้ Bear Café</span>
          </Link>
        ) : (
          <Link
            to="/term-of-service"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground bg-secondary/60 hover:bg-secondary border border-border/70 transition-colors"
            title="สลับไปยังข้อกำหนดและนโยบายของ Kuma Bot"
          >
            <Bot className="w-3.5 h-3.5 text-honey" />
            <span>ข้อกำหนดบอท Kuma (Kuma Bot)</span>
          </Link>
        )}
      </div>

      {/* Pill Navigation Tabs */}
      <nav
        aria-label="Legal & Privacy Navigation"
        className="flex items-center p-1.5 rounded-2xl bg-card/80 border border-border/70 shadow-xs backdrop-blur-md max-w-full overflow-x-auto no-scrollbar w-full sm:w-auto"
      >
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 w-full sm:w-auto justify-start sm:justify-center">
          {activeTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentPath === tab.path || 
              (tab.path === '/term-of-service' && (currentPath === '/kuma/terms' || currentPath === '/kuma/term-of-service')) ||
              (tab.path === '/privacy-policy' && (currentPath === '/kuma/privacy' || currentPath === '/kuma/privacy-policy'));

            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? 'bg-amber-500/15 text-bear-brown dark:text-amber-300 border border-amber-500/30 font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/70 border border-transparent'
                }`}
                title={tab.description}
              >
                <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isActive ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`} />
                <span>{tab.label}</span>
                <span className="text-[11px] opacity-70 font-normal hidden md:inline">({tab.enLabel})</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
