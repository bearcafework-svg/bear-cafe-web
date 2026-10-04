import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield, FileText, Database, ArrowLeft } from 'lucide-react';

interface PolicyNavTabsProps {
  showBackToHome?: boolean;
}

export const PolicyNavTabs: React.FC<PolicyNavTabsProps> = ({ showBackToHome = false }) => {
  const location = useLocation();
  const currentPath = location.pathname;

  const tabs = [
    {
      label: 'ข้อกำหนดการใช้งาน',
      enLabel: 'Terms',
      path: '/terms',
      icon: FileText,
      description: 'เงื่อนไขและกฎระเบียบการใช้งานเว็บไซต์และบริการ',
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

  return (
    <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 py-1">
      {showBackToHome && (
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors self-start sm:self-center"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>กลับสู่หน้าหลัก</span>
        </Link>
      )}

      {/* Pill Navigation Tabs */}
      <nav
        aria-label="Legal & Privacy Navigation"
        className="flex items-center p-1.5 rounded-2xl bg-card/80 border border-border/70 shadow-xs backdrop-blur-md max-w-full overflow-x-auto no-scrollbar w-full sm:w-auto"
      >
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 w-full sm:w-auto justify-start sm:justify-center">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentPath === tab.path;

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
