import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield, FileText, Database, ArrowLeft } from 'lucide-react';

interface PolicyNavTabsProps {
  showBackToHome?: boolean;
}

export const PolicyNavTabs: React.FC<PolicyNavTabsProps> = ({ showBackToHome = true }) => {
  const location = useLocation();
  const currentPath = location.pathname;

  const tabs = [
    {
      label: 'ข้อกำหนดการใช้งาน (Terms)',
      path: '/terms',
      icon: FileText,
      description: 'เงื่อนไขและกฎระเบียบการใช้งานเว็บไซต์และบริการ',
    },
    {
      label: 'นโยบายความเป็นส่วนตัว (Privacy)',
      path: '/privacy',
      icon: Shield,
      description: 'ความโปร่งใสในการเก็บและดูแลข้อมูลส่วนบุคคล สิทธิ์ Discord และ PDPA',
    },
    {
      label: 'การจัดการข้อมูลและสิทธิ์ (Permissions)',
      path: '/privacy/permissions',
      icon: Database,
      description: 'ภาพรวมเชิงเทคนิค Data Access & System Retention',
    },
  ];

  return (
    <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 py-2 mb-6 sm:mb-8">
      {showBackToHome && (
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground hover:text-honey transition-colors self-start sm:self-center"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>กลับสู่หน้าหลัก</span>
        </Link>
      )}

      {/* Pill Navigation Tabs */}
      <nav 
        aria-label="Legal & Privacy Navigation" 
        className="flex items-center p-1.5 rounded-2xl bg-card border border-border shadow-xs backdrop-blur-md max-w-full overflow-x-auto no-scrollbar"
      >
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentPath === tab.path;

            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-sm sm:text-base font-medium transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? 'bg-honey/20 text-bear-brown dark:text-honey border border-honey/40 font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent'
                }`}
                title={tab.description}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-honey' : 'text-muted-foreground'}`} />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
