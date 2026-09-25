import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useUserBalances } from '@/hooks/useUserBalances';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler';
import { BearLogo } from './BearLogo';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  CaffeLatteIcon,
  TicketColorIcon,
  TearTicketColorIcon,
  TeaBagPackagingColorIcon,
  GreenTeaCupArtIcon,
} from '@/icon/outline';
import {
  LogIn,
  LogOut,
  Settings,
  ChevronDown,
  ShieldCheck,
  Crown,
} from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';

interface NavLinkItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  requireAuth?: boolean;
}

export function CozyNavbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const { points, maxCap, ticketPoint, ticketPiecePoint, loading: balancesLoading } = useUserBalances(
    isAuthenticated ? user?.discord_id : null,
  );

  const hasAdminAccess =
    Boolean(user?.is_admin ||
    user?.is_owner ||
    (user?.allowed_pages?.length ?? 0) > 0);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const navLinks: NavLinkItem[] = [
    { label: 'หน้าแรก', href: '/', icon: <CaffeLatteIcon size={18} /> },
  ];

  const pct = maxCap > 0 ? Math.min((points / maxCap) * 100, 100) : 0;

  return (
    <header className="sticky top-0 z-50 w-full bg-background/85 dark:bg-[#14100E]/85 backdrop-blur-md border-b border-latte/30 dark:border-[#2A221E] transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Logo & Brand */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0 group focus-visible:outline-none">
          <BearLogo size="sm" noFloat />
          <span className="bear-h2-bold text-mocha dark:text-[#FFFFFF] text-lg sm:text-xl font-black tracking-tight group-hover:text-primary transition-colors">
            Bear Cafe
          </span>
        </Link>

        {/* Center: Desktop Quick Nav Tabs */}
        <nav className="hidden md:flex items-center gap-1.5 bg-latte/15 dark:bg-card/40 p-1 rounded-full border border-latte/30 dark:border-[#2A221E] shadow-2xs">
          {navLinks.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.label}
                to={item.href}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200',
                  active
                    ? 'bg-primary text-primary-foreground shadow-xs shadow-primary/30'
                    : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5',
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right: Theme Toggler & User Profile Menu */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <AnimatedThemeToggler
            className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl border border-latte/40 dark:border-border/60 bg-white/80 dark:bg-card/80 hover:bg-white dark:hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-xs shrink-0"
            title="สลับธีม (โหมดมืด / สว่าง)"
          />

          {!isAuthenticated ? (
            <Button
              asChild
              size="sm"
              className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 text-xs sm:text-sm px-3.5 sm:px-4 h-9 sm:h-10 font-bold"
            >
              <Link to="/login">
                <LogIn className="w-4 h-4 mr-1.5" />
                <span>เข้าสู่ระบบ</span>
              </Link>
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1 rounded-full border border-latte/40 dark:border-[#2A221E] bg-white/80 dark:bg-card/80 hover:bg-white dark:hover:bg-card transition-all shadow-xs group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                  aria-label="เมนูผู้ใช้"
                >
                  <div className="w-8 h-8 sm:w-8 sm:h-8 rounded-full overflow-hidden border border-primary/40 shadow-2xs shrink-0 bg-stone-100 dark:bg-stone-900">
                    {user?.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-peach to-blush flex items-center justify-center text-sm">
                        🐻
                      </div>
                    )}
                  </div>
                  <span className="hidden sm:inline-block max-w-[100px] md:max-w-[130px] truncate text-xs sm:text-sm font-bold text-foreground">
                    {user?.discord_username || user?.username}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-transform duration-200" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                className="w-80 sm:w-84 p-2 rounded-2xl border border-latte/40 dark:border-[#2A221E] bg-card/95 dark:bg-[#181412]/95 backdrop-blur-xl shadow-2xl space-y-2 z-50"
              >
                {/* User Header */}
                <div className="p-2.5 rounded-xl bg-latte/15 dark:bg-black/20 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-primary/50 shadow-sm shrink-0 bg-stone-100 dark:bg-stone-900">
                    {user?.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-peach to-blush flex items-center justify-center text-lg">
                        🐻
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-bold text-sm text-foreground truncate">
                        {user?.discord_username || user?.username}
                      </p>
                      {user?.is_owner && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          <Crown className="w-2.5 h-2.5" />
                          Owner
                        </span>
                      )}
                      {!user?.is_owner && user?.is_admin && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                          <ShieldCheck className="w-2.5 h-2.5" />
                          Admin
                        </span>
                      )}
                    </div>
                    {user?.discord_username && user.discord_username !== user.username && (
                      <p className="text-xs text-muted-foreground truncate">{user.username}</p>
                    )}
                  </div>
                </div>

                {/* Balances Card */}
                <div className="p-2.5 rounded-xl border border-latte/30 dark:border-[#2A221E] bg-white/60 dark:bg-[#120F0D]/60 space-y-2">
                  <div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-medium">แต้มสะสม</span>
                      <span className="font-bold tabular-nums text-foreground">
                        {balancesLoading ? '—' : formatNumber(points)}{' '}
                        <span className="text-muted-foreground font-normal">
                          / {balancesLoading ? '—' : formatNumber(maxCap)}
                        </span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-latte/30 dark:bg-black/40 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-honey to-peach transition-all duration-500"
                        style={{ width: balancesLoading ? '0%' : `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-latte/20 dark:border-[#2A221E]">
                    <div className="flex items-center justify-between rounded-lg bg-background/50 px-2 py-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <TearTicketColorIcon size={16} />
                        <span className="text-xs text-muted-foreground">เศษตั๋ว</span>
                      </div>
                      <span className="text-xs font-bold tabular-nums text-foreground">
                        {balancesLoading ? '—' : formatNumber(ticketPiecePoint)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-background/50 px-2 py-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <TicketColorIcon size={16} />
                        <span className="text-xs text-muted-foreground">ตั๋ว</span>
                      </div>
                      <span className="text-xs font-bold tabular-nums text-foreground">
                        {balancesLoading ? '—' : formatNumber(ticketPoint)}
                      </span>
                    </div>
                  </div>
                </div>

                <DropdownMenuSeparator className="bg-latte/20 dark:bg-[#2A221E]" />

                {/* Navigation Links */}
                <div className="space-y-0.5">
                  <DropdownMenuItem
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium cursor-pointer"
                  >
                    <CaffeLatteIcon size={18} />
                    <span className="flex-1">หน้าหลัก</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => navigate('/inventory')}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium cursor-pointer"
                  >
                    <TeaBagPackagingColorIcon size={18} />
                    <span className="flex-1">กระเป๋าเก็บของ</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => navigate('/terms')}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium cursor-pointer"
                  >
                    <GreenTeaCupArtIcon size={18} />
                    <span className="flex-1">ข้อตกลงและกฎการใช้งาน</span>
                  </DropdownMenuItem>

                  {hasAdminAccess && (
                    <DropdownMenuItem
                      onClick={() => navigate('/admin/overview')}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-amber-600 dark:text-amber-400 cursor-pointer bg-amber-500/10 hover:bg-amber-500/15"
                    >
                      <Settings className="w-4 h-4" />
                      <span className="flex-1">แผงควบคุมแอดมิน</span>
                    </DropdownMenuItem>
                  )}
                </div>

                <DropdownMenuSeparator className="bg-latte/20 dark:bg-[#2A221E]" />

                {/* Logout Button */}
                <DropdownMenuItem
                  onClick={logout}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>ออกจากระบบ</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
