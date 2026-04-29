import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { BearLogo } from './BearLogo';
import { MascotMessage } from './MascotMessage';
import { LogOut, LogIn, Users, MessageSquare } from 'lucide-react'; 
import { useTheme } from 'next-themes';

import pointIcon from '@/assets/point-icon.png';
import lightmodeIcon from '@/assets/lightmode-icon.png';
import darkmodeIcon from '@/assets/darkmode-icon.png';
import historyIcon from '@/assets/history-icon.png';
import lotteryIcon from '@/assets/lottery-icon.png';
import ruleIcon from '@/assets/rule-icon.png';
import settingIcon from '@/assets/setting-icon.png';

const DiscordIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

const YouTubeIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

interface HomeSidebarProps {
  onlineCount: number | null;
  memberCount?: number | null;
}

export function HomeSidebar({ onlineCount, memberCount }: HomeSidebarProps) {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <aside className="w-full lg:w-72 shrink-0 bg-gradient-to-b from-peach/30 via-cream to-blush/20 dark:from-coffee/50 dark:via-mocha dark:to-coffee/30 border-r border-latte/40 dark:border-coffee/40 flex flex-col h-[100dvh] max-h-[100dvh] overflow-hidden">
      {/* Logo */}
      <div className="px-4 py-3 flex justify-center shrink-0 [@media(max-height:820px)]:py-2">
        <BearLogo size="lg" noFloat />
      </div>

      {/* User Profile */}
      <div className="px-4 py-2 flex flex-col items-center shrink-0 [@media(max-height:820px)]:py-1.5">
        <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white dark:border-coffee/50 shadow-lg [@media(max-height:900px)]:w-16 [@media(max-height:900px)]:h-16 [@media(max-height:720px)]:w-14 [@media(max-height:720px)]:h-14">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-peach to-blush flex items-center justify-center">
              <span className="text-2xl">🐻</span>
            </div>
          )}
        </div>
        {isAuthenticated ? (
          user?.discord_username ? (
            <>
              <p className="mt-2 font-bold text-base text-foreground truncate max-w-full px-2 [@media(max-height:820px)]:text-sm [@media(max-height:820px)]:mt-1">{user.discord_username}</p>
              <p className="text-xs text-muted-foreground truncate max-w-full px-2 [@media(max-height:820px)]:text-[11px]">{user.username}</p>
            </>
          ) : (
            <p className="mt-2 font-semibold text-base text-foreground truncate max-w-full px-2 [@media(max-height:820px)]:text-sm [@media(max-height:820px)]:mt-1">{user?.username || 'Guest'}</p>
          )
        ) : (
          <p className="mt-2 font-semibold text-sm text-muted-foreground [@media(max-height:820px)]:text-xs [@media(max-height:820px)]:mt-1">ยังไม่ได้เข้าสู่ระบบ</p>
        )}
      </div>

      {/* Navigation */}
      <nav className="px-4 py-2.5 flex-1 space-y-1 min-h-0 overflow-y-auto [@media(max-height:820px)]:py-1.5 [@media(max-height:820px)]:space-y-0.5">
        
        {/* สลับโหมด */}
        <button
          onClick={toggleTheme}
          className="group w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-foreground hover:bg-white/50 dark:hover:bg-black/20 transition-colors [@media(max-height:820px)]:py-2 [@media(max-height:820px)]:text-sm"
        >
          <img 
            src={theme === 'dark' ? lightmodeIcon : darkmodeIcon} 
            alt="Theme Toggle Icon" 
            className="w-6 h-6 shrink-0 object-contain drop-shadow-sm transition-all duration-300 group-hover:scale-125 group-hover:-translate-y-1 [@media(max-height:820px)]:w-5 [@media(max-height:820px)]:h-5" 
          />
          <span className="font-medium">สลับโหมด</span>
        </button>

        {/* ประวัติการใช้งาน */}
        <Link
          to={isAuthenticated ? "/history" : "/login"}
          className="group w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-foreground hover:bg-white/50 dark:hover:bg-black/20 transition-colors [@media(max-height:820px)]:py-2 [@media(max-height:820px)]:text-sm"
        >
          <img 
            src={historyIcon} 
            alt="History Icon" 
            className="w-6 h-6 shrink-0 object-contain drop-shadow-sm transition-all duration-300 group-hover:scale-125 group-hover:-translate-y-1 [@media(max-height:820px)]:w-5 [@media(max-height:820px)]:h-5" 
          />
          <span className="font-medium">ประวัติการใช้งาน</span>
        </Link>

        {/* เช็คแต้มของคุณ */}
        {user && (
          <Link
            to="/points"
            className="group w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-foreground hover:bg-white/50 dark:hover:bg-black/20 transition-colors [@media(max-height:820px)]:py-2 [@media(max-height:820px)]:text-sm"
          >
            <img 
              src={pointIcon} 
              alt="Point Icon" 
              className="w-6 h-6 shrink-0 object-contain drop-shadow-sm transition-all duration-300 group-hover:scale-125 group-hover:-translate-y-1 [@media(max-height:820px)]:w-5 [@media(max-height:820px)]:h-5" 
            />
            <span className="font-medium">เช็คแต้มของคุณ</span>
          </Link>
        )}

        {/* โปรโมทเซิร์ฟเวอร์ฟรี */}
        <Link
          to="/discord-servers"
          className="group w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-foreground hover:bg-white/50 dark:hover:bg-black/20 transition-colors [@media(max-height:820px)]:py-2 [@media(max-height:820px)]:text-sm"
        >
          <img 
            src={lotteryIcon} 
            alt="Promote Server Icon" 
            className="w-6 h-6 shrink-0 object-contain drop-shadow-sm transition-all duration-300 group-hover:scale-125 group-hover:-translate-y-1 [@media(max-height:820px)]:w-5 [@media(max-height:820px)]:h-5" 
          />
          <span className="font-medium">โปรโมทเซิร์ฟเวอร์ฟรี</span>
        </Link>

        {/* ลอตเตอรี่ */}
        {user?.is_owner && (
          <Link
            to="/lottery"
            className="group w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-foreground hover:bg-white/50 dark:hover:bg-black/20 transition-colors [@media(max-height:820px)]:py-2 [@media(max-height:820px)]:text-sm"
          >
            <img 
              src={lotteryIcon} 
              alt="Lottery Icon" 
              className="w-6 h-6 shrink-0 object-contain drop-shadow-sm transition-all duration-300 group-hover:scale-125 group-hover:-translate-y-1 [@media(max-height:820px)]:w-5 [@media(max-height:820px)]:h-5" 
            />
            <span className="font-medium">ลอตเตอรี่</span>
          </Link>
        )}

        {/* ข้อตกลงและกติกา */}
        <a
          href="https://www.notion.so/2f4fa9ff914e80b29e13e5225887e07d"
          target="_blank"
          rel="noopener noreferrer"
          className="group w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-foreground hover:bg-white/50 dark:hover:bg-black/20 transition-colors [@media(max-height:820px)]:py-2 [@media(max-height:820px)]:text-sm"
        >
          <img 
            src={ruleIcon} 
            alt="Rule Icon" 
            className="w-6 h-6 shrink-0 object-contain drop-shadow-sm transition-all duration-300 group-hover:scale-125 group-hover:-translate-y-1 [@media(max-height:820px)]:w-5 [@media(max-height:820px)]:h-5" 
          />
          <span className="font-medium">ข้อตกลงและกติกา</span>
        </a>


        {/* จัดการระบบ (Admin) */}
        {(user?.is_admin || user?.is_owner || (user?.allowed_pages && user.allowed_pages.length > 0)) && (
          <Link
            to="/admin"
            className="group w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-foreground hover:bg-white/50 dark:hover:bg-black/20 transition-colors [@media(max-height:820px)]:py-2 [@media(max-height:820px)]:text-sm"
          >
            <img 
              src={settingIcon} 
              alt="Setting Icon" 
              className="w-6 h-6 shrink-0 object-contain drop-shadow-sm transition-all duration-300 group-hover:scale-125 group-hover:-translate-y-1 [@media(max-height:820px)]:w-5 [@media(max-height:820px)]:h-5" 
            />
            <span className="font-medium">จัดการระบบ</span>
          </Link>
        )}

        {/* Login / Logout */}
        {isAuthenticated ? (
          <button
            onClick={logout}
            className="group w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors [@media(max-height:820px)]:py-2 [@media(max-height:820px)]:text-sm"
          >
            <LogOut className="w-5 h-5 shrink-0 transition-all duration-300 group-hover:scale-125 group-hover:-translate-y-1" />
            <span className="font-medium">ออกจากระบบ</span>
          </button>
        ) : (
          <Link
            to="/login"
            className="group w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-primary hover:bg-primary/10 transition-colors [@media(max-height:820px)]:py-2 [@media(max-height:820px)]:text-sm"
          >
            <LogIn className="w-5 h-5 shrink-0 transition-all duration-300 group-hover:scale-125 group-hover:-translate-y-1" />
            <span className="font-medium">เข้าสู่ระบบ</span>
          </Link>
        )}
      </nav>

      {/* Mascot Message */}
      <div className="shrink-0 [@media(max-height:900px)]:scale-[0.95] [@media(max-height:900px)]:origin-top [@media(max-height:760px)]:scale-[0.88] [@media(max-height:680px)]:hidden">
        <MascotMessage />
      </div>

      {/* Online & Member Count */}
      <div className="px-4 py-2 shrink-0 [@media(max-height:820px)]:py-1.5">
        <div className="bg-gradient-to-r from-honey/20 to-peach/20 dark:from-honey/10 dark:to-coffee/20 rounded-xl p-2.5 border border-latte/40 dark:border-coffee/40 [@media(max-height:820px)]:p-2">
          {/* Total members */}
          {memberCount !== null && memberCount !== undefined && (
            <div className="flex items-center justify-center gap-2 pt-1.5 border-t border-latte/40 dark:border-coffee/40">
              <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0 [@media(max-height:820px)]:w-3 [@media(max-height:820px)]:h-3" />
              <p className="text-xs text-muted-foreground [@media(max-height:820px)]:text-[11px]">
                สมาชิกทั้งหมด <span className="font-semibold text-foreground">{memberCount?.toLocaleString()}</span> คน
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Social Links */}
      <div className="p-3 pb-safe flex items-center justify-center gap-3 shrink-0 [@media(max-height:820px)]:py-2 [@media(max-height:820px)]:gap-2" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <a
          href="https://discord.gg/bearcafe"
          target="_blank"
          rel="noopener noreferrer"
          className="w-10 h-10 rounded-full bg-[hsl(235,86%,65%)] text-primary-foreground flex items-center justify-center hover:scale-110 transition-transform shadow-md [@media(max-height:820px)]:w-8 [@media(max-height:820px)]:h-8"
          aria-label="Discord"
        >
          <DiscordIcon />
        </a>
        <a
          href="https://www.tiktok.com/@bearcafe.official"
          target="_blank"
          rel="noopener noreferrer"
          className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center hover:scale-110 transition-transform shadow-md [@media(max-height:820px)]:w-8 [@media(max-height:820px)]:h-8"
          aria-label="TikTok"
        >
          <TikTokIcon />
        </a>
        <a
          href="https://www.youtube.com/@Bearcafe"
          target="_blank"
          rel="noopener noreferrer"
          className="w-10 h-10 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:scale-110 transition-transform shadow-md [@media(max-height:820px)]:w-8 [@media(max-height:820px)]:h-8"
          aria-label="YouTube"
        >
          <YouTubeIcon />
        </a>
      </div>
    </aside>
  );
}
