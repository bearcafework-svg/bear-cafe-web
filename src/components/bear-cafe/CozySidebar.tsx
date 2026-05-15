import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from 'next-themes';
import { LogOut, LogIn } from 'lucide-react';
import { BearLogo } from './BearLogo';

import pointIcon from '@/assets/point-icon.png';
import lightmodeIcon from '@/assets/lightmode-icon.png';
import darkmodeIcon from '@/assets/darkmode-icon.png';
import historyIcon from '@/assets/history-icon.png';
import lotteryIcon from '@/assets/lottery-icon.png';
import ruleIcon from '@/assets/rule-icon.png';
import settingIcon from '@/assets/setting-icon.png';
import bearMascot from '@/assets/bear-mascot.png';

const DiscordIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

// Honey-tinted indigo — warm enough to sit in the Bear Cafe palette
const DISCORD_BTN =
  'w-7 h-7 rounded-full bg-[hsl(230,40%,52%)] text-[hsl(var(--cream))] flex items-center justify-center hover:scale-110 transition-transform shadow-sm';

interface NavItemProps {
  icon: string | React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  external?: boolean;
  danger?: boolean;
  accent?: boolean;
}

function NavItem({ icon, label, onClick, href, external, danger, accent }: NavItemProps) {
  const base =
    'group flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ' +
    (danger
      ? 'text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/10'
      : accent
      ? 'text-[hsl(var(--primary))] hover:bg-[hsl(var(--accent)/0.12)]'
      : 'text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]');

  const iconEl =
    typeof icon === 'string' ? (
      <img
        src={icon}
        alt=""
        className="w-5 h-5 object-contain shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:-translate-y-0.5"
      />
    ) : (
      <span className="w-5 h-5 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:-translate-y-0.5">
        {icon}
      </span>
    );

  if (href && external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={base}>
        {iconEl}
        <span>{label}</span>
      </a>
    );
  }
  if (href) {
    return (
      <Link to={href} className={base}>
        {iconEl}
        <span>{label}</span>
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={base}>
      {iconEl}
      <span>{label}</span>
    </button>
  );
}

export function CozySidebar() {
  const { user, logout, isAuthenticated } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <aside
      className="
        w-[220px] shrink-0 flex flex-col h-[100dvh] overflow-hidden
        bg-[hsl(var(--sidebar-background))]
        border-r border-[hsl(var(--sidebar-border))]
        relative
      "
    >
      {/* Subtle paper texture overlay */}
      <div className="absolute inset-0 bg-pattern-dots opacity-[0.04] pointer-events-none" />

      {/* Tiny star decorations */}
      <span className="absolute top-3 right-4 text-[10px] text-[hsl(var(--honey))] opacity-40 select-none pointer-events-none">✦</span>
      <span className="absolute top-16 right-6 text-[8px] text-[hsl(var(--honey))] opacity-25 select-none pointer-events-none">✧</span>
      <span className="absolute top-28 left-3 text-[8px] text-[hsl(var(--honey))] opacity-20 select-none pointer-events-none">✦</span>

      {/* Logo */}
      <div className="relative px-4 pt-5 pb-3 flex justify-center shrink-0">
        <BearLogo size="md" noFloat />
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-[hsl(var(--sidebar-border))] shrink-0" />

      {/* Nav */}
      <nav className="relative flex-1 overflow-y-auto px-3 py-3 space-y-0.5 min-h-0">
        <NavItem
          icon={theme === 'dark' ? lightmodeIcon : darkmodeIcon}
          label="สลับโหมด"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        />
        <NavItem
          icon={historyIcon}
          label="ประวัติการใช้งาน"
          href={isAuthenticated ? '/history' : '/login'}
        />
        {isAuthenticated && (
          <NavItem icon={pointIcon} label="เช็คแต้มของคุณ" href="/points" />
        )}
        <NavItem icon={lotteryIcon} label="โปรโมทเซิร์ฟเวอร์ฟรี" href="/discord-servers" />
        {user?.is_owner && (
          <NavItem icon={lotteryIcon} label="ลอตเตอรี่" href="/lottery" />
        )}
        <NavItem
          icon={ruleIcon}
          label="ข้อตกลงและกติกา"
          href="https://www.notion.so/2f4fa9ff914e80b29e13e5225887e07d"
          external
        />
        {(user?.is_admin || user?.is_owner || (user?.allowed_pages && user.allowed_pages.length > 0)) && (
          <NavItem icon={settingIcon} label="จัดการระบบ" href="/admin" />
        )}

        {/* Divider before logout */}
        <div className="mx-1 my-2 h-px bg-[hsl(var(--sidebar-border))]" />

        {isAuthenticated ? (
          <NavItem
            icon={<LogOut className="w-4 h-4" />}
            label="ออกจากระบบ"
            onClick={logout}
            danger
          />
        ) : (
          <NavItem
            icon={<LogIn className="w-4 h-4" />}
            label="เข้าสู่ระบบ"
            href="/login"
            accent
          />
        )}
      </nav>

      {/* Bear mascot + social links at bottom */}
      <div className="relative shrink-0 px-3 pb-4 pt-2 flex flex-col items-center gap-3">
        {/* Tiny doodle coffee cup */}
        <span className="absolute top-0 right-4 text-base opacity-20 select-none pointer-events-none">☕</span>

        {/* Bear mascot */}
        <img
          src={bearMascot}
          alt="Bear mascot"
          className="w-16 h-16 object-contain opacity-80 select-none"
        />

        {/* Social links */}
        <div className="flex items-center gap-2">
          <a
            href="https://discord.gg/bearcafe"
            target="_blank"
            rel="noopener noreferrer"
            className={DISCORD_BTN}
            aria-label="Discord"
          >
            <DiscordIcon />
          </a>
        </div>

        {/* Member count */}
        <p className="text-[10px] text-[hsl(var(--sidebar-foreground))] opacity-40 text-center leading-tight">
          Bear Cafe © 2026
        </p>
      </div>
    </aside>
  );
}
