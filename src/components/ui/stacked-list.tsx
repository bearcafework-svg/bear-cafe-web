import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Users,
  User,
  Search,
  X,
  Plus,
  Shield,
  ChevronRight,
} from 'lucide-react';

export interface StackedMemberItem {
  id: string;
  name: string;
  subtext?: string;
  status?: string;
  online?: boolean;
  avatar?: string | null;
  roleName?: string;
  roleColor?: string;
  discordUsername?: string;
  badgeContent?: React.ReactNode;
  data?: any;
  onAction?: () => void;
}

export interface StackedListProps {
  className?: string;
  title?: string;
  subtitle?: string;
  drawerTitle?: string;
  drawerSubtitle?: string;
  activeMembers?: StackedMemberItem[];
  allMembers?: StackedMemberItem[];
  onAddClick?: () => void;
  onMemberClick?: (member: StackedMemberItem) => void;
  emptyActiveText?: string;
  emptyDrawerText?: string;
}

const sweepSpring = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 35,
  mass: 0.5,
};

const DEFAULT_MEMBERS: StackedMemberItem[] = [
  {
    id: '01',
    name: 'Oliver Smith',
    status: 'Online',
    online: true,
    roleName: 'Project Manager',
    roleColor: '#f59e0b',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: '02',
    name: 'Sophie Chen',
    status: '17m ago',
    online: false,
    roleName: 'Designer',
    roleColor: '#3b82f6',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: '03',
    name: 'Noah Wilson',
    status: '29m ago',
    online: false,
    roleName: 'Data Specialist',
    roleColor: '#10b981',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: '04',
    name: 'Emma Davis',
    status: '48m ago',
    online: false,
    roleName: 'Creator',
    roleColor: '#a855f7',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: '05',
    name: 'Leo Garcia',
    status: 'Online',
    online: true,
    roleName: 'Designer',
    roleColor: '#3b82f6',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
  },
];

export function StackedList({
  className,
  title = 'สมาชิกที่มีสิทธิ์พิเศษ',
  subtitle,
  drawerTitle = 'รายชื่อสมาชิกทั้งหมด',
  drawerSubtitle,
  activeMembers,
  allMembers,
  onAddClick,
  onMemberClick,
  emptyActiveText = 'ยังไม่มีสมาชิกในกลุ่มนี้',
  emptyDrawerText = 'ไม่พบข้อมูลสมาชิก',
}: StackedListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [drawerSearch, setDrawerSearch] = useState('');
  const [drawerLimit, setDrawerLimit] = useState(30);

  const displayActiveMembers = activeMembers ?? DEFAULT_MEMBERS.filter(m => m.online);
  const displayAllMembers = allMembers ?? DEFAULT_MEMBERS;

  // Reset drawer limit when drawer search changes or drawer opens/closes
  React.useEffect(() => {
    setDrawerLimit(30);
  }, [drawerSearch, isExpanded]);

  const filteredActive = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return displayActiveMembers;
    return displayActiveMembers.filter(m =>
      m.name.toLowerCase().includes(q) ||
      (m.roleName && m.roleName.toLowerCase().includes(q)) ||
      (m.discordUsername && m.discordUsername.toLowerCase().includes(q))
    );
  }, [displayActiveMembers, searchQuery]);

  const filteredDrawer = useMemo(() => {
    const q = drawerSearch.toLowerCase().trim();
    if (!q) return displayAllMembers;
    return displayAllMembers.filter(m =>
      m.name.toLowerCase().includes(q) ||
      (m.roleName && m.roleName.toLowerCase().includes(q)) ||
      (m.discordUsername && m.discordUsername.toLowerCase().includes(q))
    );
  }, [displayAllMembers, drawerSearch]);

  const visibleDrawerMembers = useMemo(() => {
    return filteredDrawer.slice(0, drawerLimit);
  }, [filteredDrawer, drawerLimit]);

  const renderRoleBadge = (roleName?: string, roleColor?: string) => {
    if (!roleName) return null;
    const color = roleColor || '#f59e0b';
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0 border transition-colors shadow-xs"
        style={{
          backgroundColor: `${color}18`,
          color: color,
          borderColor: `${color}40`,
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="truncate max-w-[100px] sm:max-w-none">{roleName}</span>
      </div>
    );
  };

  const renderMemberRow = (member: StackedMemberItem, isClickable = false) => {
    return (
      <div
        key={member.id}
        onClick={() => {
          if (onMemberClick) onMemberClick(member);
          if (member.onAction) member.onAction();
        }}
        className={cn(
          'flex items-center group py-3 px-3 rounded-2xl border border-transparent transition-all duration-200',
          'hover:bg-muted/40 hover:border-border/40',
          isClickable && 'cursor-pointer active:scale-[0.99]'
        )}
      >
        {/* Avatar */}
        <div className="relative mr-3.5 shrink-0">
          {member.avatar ? (
            <img
              src={member.avatar}
              alt={member.name}
              className="w-11 h-11 rounded-full ring-2 ring-border/50 object-cover shadow-sm group-hover:ring-primary/40 transition-all duration-300"
            />
          ) : (
            <div className="w-11 h-11 rounded-full ring-2 ring-border/50 bg-muted/70 flex items-center justify-center text-muted-foreground shadow-sm">
              <User className="w-5 h-5" />
            </div>
          )}
          {member.online !== undefined && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-card rounded-full flex items-center justify-center shadow-xs">
              <div
                className={cn(
                  'w-2 h-2 rounded-full',
                  member.online ? 'bg-emerald-500 ring-1 ring-emerald-500/40' : 'bg-stone-500'
                )}
              />
            </div>
          )}
        </div>

        {/* Member Details */}
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground tracking-tight leading-snug truncate group-hover:text-primary transition-colors">
              {member.name}
            </h4>
            {member.discordUsername && (
              <span className="text-[11px] text-muted-foreground/70 truncate hidden sm:inline">
                @{member.discordUsername}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {member.subtext || member.status || (member.online ? 'กำลังออนไลน์' : 'ออฟไลน์')}
          </p>
        </div>

        {/* Badge & Action */}
        <div className="flex items-center gap-2 shrink-0">
          {member.badgeContent || renderRoleBadge(member.roleName, member.roleColor)}
          {isClickable && (
            <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={cn('relative w-full max-w-2xl mx-auto', className)}>
      <div className="relative w-full min-h-[580px] pb-24 bg-card/95 backdrop-blur-md rounded-[32px] border border-border shadow-xl flex flex-col overflow-hidden">
        {/* Main Header */}
        <div className="p-6 sm:p-7 pb-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Shield className="w-4 h-4" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
                  {title}
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-normal">
                    {displayActiveMembers.length}
                  </span>
                </h3>
              </div>
              {subtitle && <p className="text-xs text-muted-foreground mt-1 ml-10">{subtitle}</p>}
            </div>

            {onAddClick && (
              <Button
                variant="outline"
                size="sm"
                onClick={onAddClick}
                className="h-9 px-3 rounded-full border-border/70 text-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/40 gap-1.5 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span className="text-xs font-medium">เพิ่มสมาชิก</span>
              </Button>
            )}
          </div>

          {/* Search bar */}
          <div className="relative mb-2">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 w-4 h-4" />
            <Input
              placeholder="ค้นหาสมาชิก หรือบทบาท..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-10 pl-10 pr-4 bg-muted/40 border-border/40 focus-visible:ring-1 focus-visible:ring-primary/40 rounded-xl text-sm placeholder:text-muted-foreground/50 transition-all w-full"
            />
          </div>
        </div>

        {/* Active Members List */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filteredActive.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <Users className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
              <p>{emptyActiveText}</p>
            </div>
          ) : (
            <motion.div
              initial={false}
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
              className="space-y-1"
            >
              {filteredActive.map(member => renderMemberRow(member, false))}
            </motion.div>
          )}
        </div>

        {/* ─── Expandable Floating Drawer ─── */}
        <motion.div
          layout
          initial={false}
          animate={{
            height: isExpanded ? 'calc(100% - 20px)' : '72px',
            width: isExpanded ? 'calc(100% - 20px)' : 'calc(100% - 32px)',
            bottom: isExpanded ? '10px' : '16px',
            left: isExpanded ? '10px' : '16px',
            borderRadius: isExpanded ? '28px' : '20px',
          }}
          transition={{
            type: 'spring',
            stiffness: 260,
            damping: 32,
            mass: 0.8,
          }}
          className={cn(
            'absolute z-30 overflow-hidden border border-border shadow-2xl flex flex-col group/bar',
            'bg-card/95 backdrop-blur-xl',
            !isExpanded && 'cursor-pointer hover:border-primary/40 hover:bg-card transition-colors'
          )}
          onClick={() => !isExpanded && setIsExpanded(true)}
        >
          {/* Drawer Bar Header */}
          <div
            className={cn(
              'flex items-center justify-between px-4 h-[72px] shrink-0 select-none transition-colors',
              isExpanded ? 'border-b border-border/50 bg-muted/20' : 'hover:bg-muted/10'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-muted/60 border border-border/70 flex items-center justify-center text-muted-foreground group-hover/bar:text-primary group-hover/bar:scale-105 transition-all">
                <Users className="w-5 h-5" />
              </div>
              <motion.div layout="position">
                <h4 className="text-sm font-semibold text-foreground tracking-tight leading-snug">
                  {drawerTitle}
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {drawerSubtitle || `${displayAllMembers.length} สมาชิกในระบบ`}
                </p>
              </motion.div>
            </div>

            <div className="flex items-center gap-2">
              {!isExpanded && (
                <div className="flex items-center">
                  <div className="flex -space-x-2">
                    {displayAllMembers.slice(0, 3).map(m => (
                      <div
                        key={`thumb-${m.id}`}
                        className="w-8 h-8 rounded-full ring-2 ring-card bg-muted flex items-center justify-center overflow-hidden shadow-xs"
                      >
                        {m.avatar ? (
                          <img src={m.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    ))}
                    {displayAllMembers.length > 3 && (
                      <div className="w-8 h-8 rounded-full ring-2 ring-card bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                        +{displayAllMembers.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {isExpanded && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 active:scale-90 transition-all"
                  onClick={e => {
                    e.stopPropagation();
                    setIsExpanded(false);
                  }}
                  title="ปิดหน้าต่าง"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Drawer Expanded Content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="px-5 pt-3 pb-2"
                >
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 w-4 h-4" />
                    <Input
                      placeholder="ค้นหาสมาชิกในทำเนียบ..."
                      value={drawerSearch}
                      onChange={e => setDrawerSearch(e.target.value)}
                      className="h-9 pl-10 pr-4 bg-muted/30 border-border/40 focus-visible:ring-1 focus-visible:ring-primary/40 rounded-xl text-xs placeholder:text-muted-foreground/40 transition-all w-full"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {isExpanded && (
              <div className="flex-1 overflow-y-auto px-4 py-2 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {visibleDrawerMembers.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-8">{emptyDrawerText}</p>
                ) : (
                  <div className="space-y-1">
                    {visibleDrawerMembers.map(member => renderMemberRow(member, true))}
                    {filteredDrawer.length > drawerLimit && (
                      <div className="pt-3 pb-2 text-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setDrawerLimit(prev => prev + 30)}
                          className="h-8 px-4 rounded-full text-xs font-semibold border-border/70 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer"
                        >
                          แสดงเพิ่มเติม (เหลืออีก {filteredDrawer.length - drawerLimit} สมาชิก)
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default StackedList;
