import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from 'next-themes';
import { LogIn, Settings } from 'lucide-react';
import { BearLogo } from './BearLogo';
import { useUserBalances } from '@/hooks/useUserBalances';
import {
  CaffeLatteIcon,
  StrawberryColorIcon,
  TicketColorIcon,
  TearTicketColorIcon,
} from '@/icon/outline';
import { cn, formatNumber } from '@/lib/utils';

const NOTION_RULES_URL =
  'https://www.notion.so/2f4fa9ff914e80b29e13e5225887e07d';

export const COZY_SIDEBAR_WIDTH = 272;

interface NavItemConfig {
  label: string;
  href?: string;
  external?: boolean;
  onClick?: () => void;
  matchPath?: string;
  requireAuth?: boolean;
}

interface NavItemProps extends NavItemConfig {
  isActive?: boolean;
  icon?: React.ReactNode;
}

function NavItem({ label, href, external, onClick, isActive, icon }: NavItemProps) {
  const base = cn(
    'group flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
    isActive
      ? 'bg-[hsl(var(--honey)/0.18)] text-[hsl(var(--bear-brown))] dark:bg-[hsl(var(--honey)/0.12)] dark:text-[hsl(var(--honey))]'
      : 'text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]',
  );

  const iconEl = (
    <span className="w-5 h-5 flex items-center justify-center shrink-0">
      {icon ?? <CaffeLatteIcon size={20} />}
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
    <button type="button" onClick={onClick} className={base}>
      {iconEl}
      <span>{label}</span>
    </button>
  );
}

function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
        {title}
      </p>
      {children}
    </div>
  );
}

function SidebarProfile() {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="px-4 py-3 flex items-center gap-3 shrink-0">
      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[hsl(var(--honey)/0.6)] shadow-sm shrink-0">
        {isAuthenticated && user?.avatar_url ? (
          <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-peach to-blush flex items-center justify-center text-xl">
            🐻
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {isAuthenticated && user ? (
          <>
            <p className="font-bold text-sm text-foreground truncate">
              {user.discord_username ?? user.username}
            </p>
            {user.discord_username && user.discord_username !== user.username && (
              <p className="text-xs text-muted-foreground truncate">{user.username}</p>
            )}
          </>
        ) : (
          <p className="text-sm font-medium text-muted-foreground">ยังไม่ได้เข้าสู่ระบบ</p>
        )}
      </div>
    </div>
  );
}

function SidebarBalances() {
  const { user, isAuthenticated } = useAuth();
  const { points, maxCap, ticketPoint, ticketPiecePoint, loading } = useUserBalances(
    isAuthenticated ? user?.discord_id : null,
  );

  if (!isAuthenticated) return null;

  const pct = maxCap > 0 ? Math.min((points / maxCap) * 100, 100) : 0;

  return (
    <div className="px-3 pb-2 space-y-2 shrink-0">
      <div className="rounded-2xl border border-[hsl(var(--sidebar-border))] bg-card px-3 py-3 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <StrawberryColorIcon size={18} />
          <span className="text-[11px] font-medium text-muted-foreground leading-tight">
            แต้มสตรอว์เบอร์รี่สะสม
          </span>
        </div>
        <p className="text-base font-bold text-foreground tabular-nums">
          {loading ? '—' : formatNumber(points)}
          <span className="text-xs font-normal text-muted-foreground">
            {' '}/ {loading ? '—' : formatNumber(maxCap)}
          </span>
        </p>
        <div className="mt-2.5 h-1.5 rounded-full bg-[hsl(var(--latte)/0.5)] dark:bg-[hsl(var(--coffee)/0.4)] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-honey to-peach transition-all duration-500"
            style={{ width: loading ? '0%' : `${pct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--sidebar-border))] bg-card px-3 py-2.5 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <TearTicketColorIcon size={20} />
            <span className="text-sm font-medium text-foreground">เศษตั๋ว</span>
          </div>
          <span className="text-sm font-bold text-foreground tabular-nums shrink-0">
            {loading ? '—' : formatNumber(ticketPiecePoint)}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--sidebar-border))] bg-card px-3 py-2.5 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <TicketColorIcon size={20} />
            <span className="text-sm font-medium text-foreground">ตั๋ว</span>
          </div>
          <span className="text-sm font-bold text-foreground tabular-nums shrink-0">
            {loading ? '—' : formatNumber(ticketPoint)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function CozySidebar() {
  const { user, logout, isAuthenticated } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();

  const hasAdminAccess =
    user?.is_admin ||
    user?.is_owner ||
    (user?.allowed_pages?.length ?? 0) > 0;

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  // Unauthenticated users are sent to login for protected routes
  const authHref = (path: string) => (isAuthenticated ? path : '/login');

  const serviceItems: NavItemConfig[] = [
    { label: 'หน้าหลัก', href: '/', matchPath: '/' },
    { label: 'กาชา', href: '/gacha', matchPath: '/gacha' },
    { label: 'กรอกโค้ด', href: authHref('/points'), matchPath: '/points', requireAuth: true },
  ];

  const usageItems: NavItemConfig[] = [
    { label: 'กระเป๋าเก็บของ', href: authHref('/inventory'), matchPath: '/inventory', requireAuth: true },
    { label: 'ข้อตกลง', href: NOTION_RULES_URL, external: true },
  ];

  return (
    <aside
      style={{ width: COZY_SIDEBAR_WIDTH }}
      className={cn(
        'shrink-0 flex flex-col h-[100dvh] overflow-hidden',
        'bg-[hsl(var(--sidebar-background))]',
        'border-r border-[hsl(var(--sidebar-border))]',
      )}
    >
      <div className="px-4 pt-4 pb-2 flex items-center gap-2.5 shrink-0">
        <BearLogo size="sm" noFloat />
        <span className="bear-h2-bold text-mocha dark:text-[#FFFFFF]">Bear Cafe</span>
      </div>

      <SidebarProfile />
      <SidebarBalances />

      <nav className="flex-1 overflow-y-auto px-2 py-1 min-h-0 space-y-1">
        <NavSection title="บริการของเรา">
          {serviceItems.map((item) => (
            <NavItem
              key={item.label}
              {...item}
              isActive={item.matchPath ? isActive(item.matchPath) : false}
            />
          ))}
        </NavSection>

        <NavSection title="ข้อมูลการใช้งาน">
          {usageItems.map((item) => (
            <NavItem
              key={item.label}
              {...item}
              isActive={item.matchPath ? isActive(item.matchPath) : false}
            />
          ))}
          <NavItem
            label="สลับธีม"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          />
        </NavSection>
      </nav>

      <div className="shrink-0 px-2 pb-4 pt-1">
        <div className="mx-1 mb-2 h-px bg-[hsl(var(--sidebar-border))]" />
        {/* Admin panel visible to owners, admins, or users with any allowed page */}
        {hasAdminAccess && (
          <NavItem
            label="จัดการระบบ"
            href="/admin"
            isActive={isActive('/admin')}
            icon={<Settings className="w-4 h-4" />}
          />
        )}
        {isAuthenticated ? (
          <NavItem
            label="ออกจากระบบ"
            onClick={logout}
          />
        ) : (
          <Link
            to="/login"
            className="group flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm font-medium text-[hsl(var(--primary))] hover:bg-[hsl(var(--accent)/0.12)] transition-all duration-200"
          >
            <span className="w-5 h-5 flex items-center justify-center shrink-0">
              <LogIn className="w-4 h-4" />
            </span>
            <span>เข้าสู่ระบบ</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
