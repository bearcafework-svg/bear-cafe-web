import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
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
import { cn } from '@/lib/utils';

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

  const hasAdminAccess =
    Boolean(user?.is_admin ||
    user?.is_owner ||
    (user?.allowed_pages?.length ?? 0) > 0);

  return (
    <header className="sticky top-0 z-50 w-full bg-background/85 dark:bg-[#14100E]/85 backdrop-blur-md border-b border-latte/30 dark:border-[#2A221E] transition-colors">
      <div className="w-full px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Logo & Brand */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0 group focus-visible:outline-none">
          <BearLogo size="sm" noFloat />
          <span className="bear-h2-bold text-mocha dark:text-[#FFFFFF] text-lg sm:text-xl font-black tracking-tight group-hover:text-primary transition-colors">
            Bear Cafe
          </span>
        </Link>

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

                <DropdownMenuSeparator className="bg-latte/20 dark:bg-[#2A221E]" />

                {/* Navigation Links */}
                <div className="space-y-0.5">

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
                  variant="destructive"
                  onClick={logout}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400 focus:bg-red-500/10 focus:text-red-600 dark:focus:text-red-400 cursor-pointer transition-colors"
                >
                  <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
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
