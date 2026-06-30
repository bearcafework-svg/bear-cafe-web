import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BearLogoText } from '@/components/bear-cafe/BearLogo';
import { withRetry } from '@/lib/retry';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft, Users, FolderOpen, Flag, Search, Ban, Shield, ShieldCheck,
  Eye, CheckCircle, XCircle, Clock, Palette, Image as ImageIcon, Ticket, Heart, Home,
  ClipboardList, AlertTriangle, ChevronRight, Settings, LayoutDashboard, RefreshCw, ShoppingCart,
  Key, ArrowLeftRight, ShieldBan, Coffee, Send, CalendarCheck, Layers,
} from 'lucide-react';
import { SearchBar } from '@/components/admin/SearchBar';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { AdminSkeletonRows } from '@/components/admin/AdminSkeletonCards';
import { ADMIN_PAGES } from '@/lib/admin-pages';
import { BannedRolesManagement } from '@/components/admin/BannedRolesManagement';
import { BannedWordsManagement } from '@/components/admin/BannedWordsManagement';
import { CategoriesManagement } from '@/components/admin/CategoriesManagement';
import { DiscordRolesManagement } from '@/components/admin/DiscordRolesManagement';
import { RedeemCodesManagement } from '@/components/admin/RedeemCodesManagement';
import { TagWarnLogsManagement } from '@/components/admin/TagWarnLogsManagement';
import { TradingHistoryManagement } from '@/components/admin/TradingHistoryManagement';
import { DiscordServersManagement } from '@/components/admin/DiscordServersManagement';
import { MaintenanceToggle } from '@/components/admin/MaintenanceToggle';
import { PermissionsManagement } from '@/components/admin/PermissionsManagement';
import { HealingMessagesManagement } from '@/components/admin/HealingMessagesManagement';
import { ContractsManagement } from '@/components/admin/ContractsManagement';

import { RoleTransferManagement } from '@/components/admin/RoleTransferManagement';
import { NonTransferableRolesManagement } from '@/components/admin/NonTransferableRolesManagement';
import { RolesToDeleteManagement } from '@/components/admin/RolesToDeleteManagement';
import { BulkRoleManagement } from '@/components/admin/BulkRoleManagement';
import { CheckinRewardsManagement } from '@/components/admin/CheckinRewardsManagement';
import { RoleMigrationManagement } from '@/components/admin/RoleMigrationManagement';
import { useMaintenanceMode } from '@/hooks/useMaintenanceMode';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';
import { BannerManagement } from '@/components/admin/BannerManagement';
import { CampaignsManagement } from '@/components/admin/CampaignsManagement';
import { ProductCatalogManagement } from '@/components/admin/ProductCatalogManagement';

type Profile = Tables<'profiles'>;
type Report = Tables<'reports'>;
type ReportStatus = Tables<'reports'>['status'];
type UserRole = Tables<'user_roles'>;
interface TagWarnCancelRequest {
  id: string;
  warn_timestamp: string;
  warn_sequence: string | null;
  member_id: string | null;
  requested_by: string;
  requested_by_name: string | null;
  status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  external_sync_status: 'pending' | 'success' | 'failed';
  external_synced_at: string | null;
  external_sync_error: string | null;
  created_at: string;
}

/* ─── Nav item config ─── */
interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  ownerOnly?: boolean;
  group: string;
}

const ICON_MAP: Record<string, React.ElementType> = {
  'users': Users,
  'banned-roles': Ban,
  'banned-words': AlertTriangle,
  'tag-warn': ClipboardList,
  'contracts': Home,
  'healing-messages': Heart,
  'trading-history': ShoppingCart,
  'role-transfer': ArrowLeftRight,
  'bulk-role-manage': Users,
  'reports': Flag,
  'categories': FolderOpen,
  'banners': ImageIcon,
  'roles': Palette,
  'checkin-rewards': CalendarCheck,
  'redeem-codes': Ticket,
  'non-transferable-roles': ShieldBan,
  'discord-servers': Settings,
  'campaigns': Send,
  'product-catalog': ShoppingCart,
};

const NAV_ITEMS: NavItem[] = ADMIN_PAGES.map(p => ({
  id: p.id,
  label: p.label,
  icon: ICON_MAP[p.id] || Settings,
  ownerOnly: p.ownerOnly,
  group: p.group,
}));

const GROUP_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  moderation: { label: 'การดูแล', icon: Shield },
  content: { label: 'เนื้อหา', icon: LayoutDashboard },
  system: { label: 'ระบบ', icon: Settings },
};
export default function AdminPage() {
  const navigate = useNavigate();
  const { section } = useParams<{ section?: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState(
    () => section || localStorage.getItem('admin_active_tab') || 'users'
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Admin role allowed pages from site_settings
  const [adminRolePages, setAdminRolePages] = useState<string[]>([]);

  const { isMaintenanceMode, maintenanceMessage, enabledStaff, toggleMaintenanceMode, updateMaintenanceMode } = useMaintenanceMode();
  const hasAdminAccess = user?.is_admin || user?.is_owner || (user?.allowed_pages && user.allowed_pages.length > 0);
  const isOwner = user?.is_owner;
  const userAllowedPages = user?.allowed_pages || [];

  // Fetch admin_allowed_pages from site_settings
  useEffect(() => {
    if (!user?.is_admin || user?.is_owner) return;
    supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'admin_allowed_pages')
      .maybeSingle()
      .then(({ data }) => {
        const value = data?.value as { pages?: string[] } | null;
        const pages = value?.pages;
        if (Array.isArray(pages)) setAdminRolePages(pages);
      });
  }, [user?.is_admin, user?.is_owner]);

  useEffect(() => {
    if (user && !hasAdminAccess) {
      toast({ title: 'ไม่มีสิทธิ์เข้าถึง', description: 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้', variant: 'destructive' });
      navigate('/');
    }
  }, [user, hasAdminAccess, navigate, toast]);

  // Filter nav items based on role + custom permissions (merged, not overridden)
  const visibleItems = NAV_ITEMS.filter(item => {
    if (isOwner) return true; // Owner sees all
    // Merge admin role pages + custom permission pages
    const fromAdmin = user?.is_admin
      ? (adminRolePages.length > 0 ? adminRolePages.includes(item.id) : !item.ownerOnly)
      : false;
    const fromCustom = userAllowedPages.includes(item.id);
    return fromAdmin || fromCustom;
  });

  const groups = ['moderation', 'content', 'system'].filter(g =>
    visibleItems.some(i => i.group === g)
  );

  const activeItem = visibleItems.find(i => i.id === activeTab);

  // Auto-redirect to first accessible tab if current tab is not accessible
  useEffect(() => {
    if (visibleItems.length > 0) {
      const isAccessible = visibleItems.some(i => i.id === activeTab);
      if (!isAccessible) {
        const firstId = visibleItems[0].id;
        setActiveTab(firstId);
        localStorage.setItem('admin_active_tab', firstId);
      }
    }
  }, [visibleItems, activeTab]);

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    localStorage.setItem('admin_active_tab', id);
    navigate(`/admin/${id}`, { replace: true });
    if (isMobile) setSidebarOpen(false);
  };

  /* ─── Sidebar nav content (shared between mobile sheet & desktop) ─── */
  const renderNav = () => (
    <nav className="flex flex-col gap-1 p-2">
      {groups.map((groupKey) => {
        const groupInfo = GROUP_LABELS[groupKey];
        const GroupIcon = groupInfo.icon;
        const items = visibleItems.filter(i => i.group === groupKey);
        if (items.length === 0) return null;

        return (
          <div key={groupKey} className="mb-2">
            <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <GroupIcon className="w-3.5 h-3.5" />
              {groupInfo.label}
            </div>
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ease-out',
                    isActive
                      ? 'bg-primary/10 text-primary shadow-sm dark:bg-primary/20 ring-1 ring-primary/10'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground active:bg-muted/70'
                  )}
                >
                  <Icon className={cn('w-4 h-4 shrink-0', isActive && 'text-primary')} />
                  <span className="truncate">{item.label}</span>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto text-primary/60" />}
                </button>
              );
            })}
          </div>
        );
      })}
    </nav>
  );

  /* ─── Content area ─── */
  const canAccessPage = (pageId: string) => {
    if (isOwner) return true;
    const fromAdmin = user?.is_admin
      ? (adminRolePages.length > 0 ? adminRolePages.includes(pageId) : true)
      : false;
    const fromCustom = userAllowedPages.includes(pageId);
    return fromAdmin || fromCustom;
  };

  const renderContent = () => {
    try {
      switch (activeTab) {
        case 'users': return canAccessPage('users') ? <UsersManagement currentUser={user} isOwner={isOwner} /> : null;
        case 'banned-roles': return canAccessPage('banned-roles') ? <BannedRolesManagement /> : null;
        case 'banned-words': return canAccessPage('banned-words') ? <BannedWordsManagement /> : null;
        case 'tag-warn': return canAccessPage('tag-warn') ? <TagWarnLogsManagement /> : null;
        case 'contracts': return canAccessPage('contracts') ? <ContractsManagement /> : null;
        case 'healing-messages': return canAccessPage('healing-messages') ? <HealingMessagesManagement /> : null;
        case 'trading-history': return canAccessPage('trading-history') ? <TradingHistoryManagement /> : null;
        case 'categories': return canAccessPage('categories') ? <CategoriesManagement /> : null;
        case 'banners': return canAccessPage('banners') ? <BannerManagement /> : null;
        case 'roles': return canAccessPage('roles') ? <DiscordRolesManagement /> : null;
        case 'checkin-rewards': return canAccessPage('checkin-rewards') ? <CheckinRewardsManagement /> : null;
        case 'role-transfer': return canAccessPage('role-transfer') ? <RoleTransferManagement /> : null;
        case 'bulk-role-manage': return canAccessPage('bulk-role-manage') ? <BulkRoleManagement /> : null;
        case 'reports': return canAccessPage('reports') ? <ReportsManagement /> : null;
        case 'redeem-codes': return canAccessPage('redeem-codes') ? <RedeemCodesManagement /> : null;
        case 'non-transferable-roles': return canAccessPage('non-transferable-roles') ? <NonTransferableRolesManagement /> : null;
        case 'roles-to-delete': return canAccessPage('roles-to-delete') ? <RolesToDeleteManagement /> : null;
        case 'discord-servers': return canAccessPage('discord-servers') ? <DiscordServersManagement /> : null;
        case 'permissions': return isOwner ? <PermissionsManagement /> : null;
        case 'campaigns': return canAccessPage('campaigns') ? <CampaignsManagement /> : null;
        case 'product-catalog': return canAccessPage('product-catalog') ? <ProductCatalogManagement /> : null;
        default: return null;
      }
    } catch (error) {
      console.error('Error rendering admin content:', error);
      return (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-destructive">เกิดข้อผิดพลาดในการโหลดหน้านี้</p>
            <Button onClick={() => window.location.reload()} className="mt-4">รีโหลดหน้า</Button>
          </CardContent>
        </Card>
      );
    }
  };

  // Sync URL section → activeTab when navigating directly
  useEffect(() => {
    if (section && section !== activeTab) {
      setActiveTab(section);
      localStorage.setItem('admin_active_tab', section);
    }
  }, [section, activeTab]);

  if (!hasAdminAccess) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-latte/30 to-peach/20 dark:from-background dark:via-background dark:to-muted/20">
      {/* ─── Header ─── */}
      <header className="border-b border-latte dark:border-border bg-cream/80 dark:bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="rounded-xl bg-cream/80 dark:bg-muted shadow-sm shrink-0 w-9 h-9"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <BearLogoText />
            <Badge className="gap-1 bg-gradient-to-r from-primary to-bear-brown text-primary-foreground text-xs hidden sm:flex">
              <Shield className="w-3 h-3" />
              Admin Panel
            </Badge>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Mobile menu toggle */}
            {isMobile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="gap-1.5 text-xs"
              >
                {activeItem && <activeItem.icon className="w-3.5 h-3.5" />}
                <span className="max-w-[80px] truncate">{activeItem?.label}</span>
                <ChevronRight className={cn('w-3 h-3 transition-transform', sidebarOpen && 'rotate-90')} />
              </Button>
            )}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-honey/20 flex items-center justify-center text-base">
              🐻
            </div>
            <span className="font-medium hidden lg:block text-sm">{user?.username}</span>
          </div>
        </div>
      </header>

      {/* ─── Mobile nav dropdown ─── */}
      {isMobile && sidebarOpen && (
        <div className="border-b border-border bg-card/95 backdrop-blur-md animate-in slide-in-from-top-2 duration-200 z-40 relative">
          <div className="max-h-[60vh] overflow-y-auto">
            {renderNav()}
          </div>
        </div>
      )}

      {/* ─── Main layout ─── */}
      <div className="max-w-[1600px] mx-auto flex">
        {/* Desktop sidebar */}
        {!isMobile && (
          <aside className="w-60 lg:w-64 shrink-0 border-r border-latte/60 dark:border-border bg-cream/40 dark:bg-card/40 sticky top-[53px] h-[calc(100vh-53px)] overflow-y-auto">
            <div className="py-3">
              {renderNav()}
              {/* Maintenance toggle at bottom of sidebar */}
              {isOwner && (
                <div className="px-3 pt-4 mt-4 border-t border-border">
                  <MaintenanceToggle
                    isEnabled={isMaintenanceMode}
                    enabledStaff={enabledStaff}
                    message={maintenanceMessage}
                    onToggle={toggleMaintenanceMode}
                    onUpdateMaintenance={updateMaintenanceMode}
                  />
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6">
          <div className="max-w-6xl mx-auto space-y-6">
          {/* Mobile maintenance toggle */}
          {isMobile && isOwner && (
            <div className="mb-4">
              <MaintenanceToggle
                isEnabled={isMaintenanceMode}
                enabledStaff={enabledStaff}
                message={maintenanceMessage}
                onToggle={toggleMaintenanceMode}
                onUpdateMaintenance={updateMaintenanceMode}
              />
            </div>
          )}

          {/* Page title — improved hierarchy */}
          <div className="flex items-center gap-3 pb-4 border-b border-border/40">
            {activeItem && (
              <>
                <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0">
                  <activeItem.icon className="w-5 h-5 text-primary admin-icon" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-foreground leading-tight">{activeItem.label}</h1>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {GROUP_LABELS[activeItem.group]?.label}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="animate-fade-in">
            {renderContent()}
          </div>
          </div>{/* end max-w-6xl */}
        </main>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Users Management Component
   ═══════════════════════════════════════════════════════ */
interface UsersManagementProps {
  currentUser: { id: string; is_owner?: boolean } | null;
  isOwner?: boolean;
}

const USERS_PER_PAGE = 15;

interface CustomPermission { id: string; name: string; color: string | null; }

function UsersManagement({ currentUser, isOwner }: UsersManagementProps) {
  const navigate = useNavigate();
  const [users, setUsers] = useState<(Profile & { roles?: UserRole[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();

  // Custom permissions dialog
  const [customPermissions, setCustomPermissions] = useState<CustomPermission[]>([]);
  const [permDialogUser, setPermDialogUser] = useState<(Profile & { roles?: UserRole[] }) | null>(null);
  const [userCustomPerms, setUserCustomPerms] = useState<string[]>([]); // permission_ids
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const [profiles, roles] = await withRetry(async () => {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles').select('*').order('created_at', { ascending: false });
        if (profilesError) throw profilesError;

        const { data: roles, error: rolesError } = await supabase.from('user_roles').select('*');
        if (rolesError) throw rolesError;

        return [profiles, roles] as const;
      });

      const usersWithRoles = (profiles || []).map(profile => ({
        ...profile,
        roles: (roles || []).filter(r => r.user_id === profile.id),
      }));
      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถโหลดข้อมูลผู้ใช้ได้', variant: 'destructive' });
      setUsers([]); // Set empty array on error to prevent undefined
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function openPermDialog(u: Profile & { roles?: UserRole[] }) {
    setPermDialogUser(u);
    setLoadingPerms(true);
    try {
      const [{ data: allPerms }, { data: userPerms }] = await Promise.all([
        supabase.from('custom_permissions').select('id, name, color').order('name'),
        supabase.from('user_custom_permissions').select('permission_id').eq('user_id', u.id),
      ]);
      setCustomPermissions((allPerms || []) as CustomPermission[]);
      setUserCustomPerms((userPerms || []).map((p) => p.permission_id));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPerms(false);
    }
  }

  async function saveUserPerms() {
    if (!permDialogUser) return;
    setSavingPerms(true);
    try {
      // Delete all existing
      await supabase.from('user_custom_permissions').delete().eq('user_id', permDialogUser.id);
      // Insert selected
      if (userCustomPerms.length > 0) {
        await supabase.from('user_custom_permissions').insert(
          userCustomPerms.map(pid => ({ user_id: permDialogUser.id, permission_id: pid, assigned_by: currentUser?.id }))
        );
      }
      toast({ title: 'บันทึกสิทธิ์แล้ว' });
      setPermDialogUser(null);
    } catch (e) {
      const error = e as Error;
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setSavingPerms(false);
    }
  }

  function toggleCustomPerm(permId: string) {
    setUserCustomPerms(prev =>
      prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
    );
  }

  async function toggleBan(userId: string, currentlyBanned: boolean) {
    if (userId === currentUser?.id) {
      toast({ title: 'ไม่สามารถดำเนินการได้', description: 'คุณไม่สามารถแบนตัวเองได้', variant: 'destructive' });
      return;
    }
    const targetUser = users.find(u => u.id === userId);
    const targetIsOwner = targetUser?.roles?.some(r => r.role === 'owner');
    if (targetIsOwner && !isOwner) {
      toast({ title: 'ไม่มีสิทธิ์', description: 'คุณไม่สามารถแบน Owner ได้', variant: 'destructive' });
      return;
    }
    try {
      const { data, error } = await supabase.from('profiles').update({ is_banned: !currentlyBanned }).eq('id', userId).select().single();
      if (error || !data) { toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถอัปเดตสถานะการแบนได้', variant: 'destructive' }); return; }
      setUsers(users.map(u => u.id === userId ? { ...u, is_banned: !currentlyBanned } : u));
      toast({ title: currentlyBanned ? 'ปลดแบนแล้ว' : 'แบนแล้ว', description: currentlyBanned ? 'ผู้ใช้ถูกปลดแบนแล้ว' : 'ผู้ใช้ถูกแบนแล้ว' });
    } catch (error) {
      console.error('Error toggling ban:', error);
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    }
  }

  async function toggleRole(userId: string, role: 'moderator', hasRole: boolean) {
    if (!isOwner) { toast({ title: 'ไม่มีสิทธิ์', description: 'เฉพาะ Owner เท่านั้นที่สามารถจัดการสิทธิ์ Owner ได้', variant: 'destructive' }); return; }
    if (userId === currentUser?.id) { toast({ title: 'ไม่สามารถดำเนินการได้', description: 'คุณไม่สามารถถอดสิทธิ์ของตัวเองได้', variant: 'destructive' }); return; }
    try {
      if (hasRole) {
        const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('user_roles').insert({ user_id: userId, role });
        if (error) throw error;
      }
      fetchUsers();
      toast({ title: 'อัปเดตสิทธิ์แล้ว', description: hasRole ? 'ลบสิทธิ์ Owner แล้ว' : 'เพิ่มสิทธิ์ Owner แล้ว' });
    } catch (error) {
      console.error('Error toggling role:', error);
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    }
  }

  const filteredUsers = (users || []).filter(u => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (u.username || '').toLowerCase().includes(q) ||
      (u.discord_id || '').includes(q) ||
      (u.discord_username ?? '').toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedUsers = filteredUsers.slice((safeCurrentPage - 1) * USERS_PER_PAGE, safeCurrentPage * USERS_PER_PAGE);

  // Reset to page 1 when search changes
  useEffect(() => { setCurrentPage(1); }, [searchQuery]);



  return (
    <div className="space-y-4">
    <Card className="admin-card">
      <CardHeader className="px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Users className="w-4 h-4" />
            จัดการผู้ใช้
            <Badge variant="secondary" className="text-xs">{filteredUsers.length}</Badge>
          </CardTitle>
          <div className="w-full sm:w-72">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="ค้นหาผู้ใช้, Discord ID, username..."
              />
            </div>
        </div>
      </CardHeader>
      <CardContent className="px-0 sm:px-6 pb-4 sm:pb-6">
        {loading ? (
          <AdminSkeletonRows count={8} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm">ผู้ใช้</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden md:table-cell">Discord ID</TableHead>
                    <TableHead className="text-xs sm:text-sm">สิทธิ์</TableHead>
                    <TableHead className="text-xs sm:text-sm">สถานะ</TableHead>
                    <TableHead className="text-right text-xs sm:text-sm">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((u) => (
                    <TableRow key={u.id} className="admin-row-clickable">
                      <TableCell className="py-2 sm:py-3 px-2 sm:px-4">
                        <div className="flex items-center gap-2">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full shrink-0" alt="" />
                          ) : (
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm">🐻</div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-xs sm:text-sm truncate max-w-[80px] sm:max-w-[160px]">{u.username}</p>
                            {u.discord_username && (
                              <p className="text-[10px] text-muted-foreground truncate max-w-[80px] sm:max-w-[160px]">@{u.discord_username}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs sm:text-sm hidden md:table-cell py-2 sm:py-3 px-2 sm:px-4">
                        <div className="space-y-0.5">
                          <p className="font-mono text-xs">{u.discord_id}</p>
                          {u.discord_username && (
                            <p className="text-[10px] text-muted-foreground">@{u.discord_username}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 sm:py-3 px-2 sm:px-4">
                        <div className="flex flex-wrap gap-0.5 sm:gap-1">
                          {u.roles?.find(r => r.role === 'moderator') && <Badge variant="default" className="bg-honey text-foreground text-[10px] sm:text-xs px-1.5 sm:px-2">Owner</Badge>}
                          {!u.roles?.some(r => r.role === 'moderator') && <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 sm:px-2">User</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 sm:py-3 px-2 sm:px-4">
                        {u.is_banned ? (
                          <Badge variant="destructive" className="gap-0.5 sm:gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2"><Ban className="w-2.5 h-2.5 sm:w-3 sm:h-3" />แบน</Badge>
                        ) : (
                          <Badge variant="outline" className="text-success border-success text-[10px] sm:text-xs px-1.5 sm:px-2">ปกติ</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right py-2 sm:py-3 px-2 sm:px-4">
                        <div className="flex justify-end gap-0.5 sm:gap-1">
                          {isOwner && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => toggleRole(u.id, 'moderator', !!u.roles?.find(r => r.role === 'moderator'))} title="ให้/ถอดสิทธิ์ Owner" disabled={u.id === currentUser?.id} className="h-7 w-7 sm:h-8 sm:w-8 p-0">
                                <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => openPermDialog(u)} title="จัดการสิทธิ์กำหนดเอง" className="h-7 w-7 sm:h-8 sm:w-8 p-0">
                                <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </Button>
                            </>
                          )}
                          <Button variant={u.is_banned ? 'outline' : 'ghost'} size="sm" onClick={() => toggleBan(u.id, u.is_banned)} title="แบน/ปลดแบน" disabled={u.id === currentUser?.id} className="h-7 w-7 sm:h-8 sm:w-8 p-0">
                            <Ban className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-3 sm:px-0 pt-4 border-t border-border mt-4">
                <p className="text-xs text-muted-foreground">
                  หน้า {safeCurrentPage} / {totalPages}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={safeCurrentPage <= 1}
                    className="h-8 px-3 text-xs"
                  >
                    ก่อนหน้า
                  </Button>
                  {/* Page numbers - show max 5 */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => {
                      if (totalPages <= 5) return true;
                      if (p === 1 || p === totalPages) return true;
                      return Math.abs(p - safeCurrentPage) <= 1;
                    })
                    .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
                      if (i > 0 && typeof arr[i - 1] === 'number' && (p as number) - (arr[i - 1] as number) > 1) {
                        acc.push('ellipsis');
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, i) =>
                      item === 'ellipsis' ? (
                        <span key={`e-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                      ) : (
                        <Button
                          key={item}
                          variant={safeCurrentPage === item ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(item as number)}
                          className="h-8 w-8 p-0 text-xs"
                        >
                          {item}
                        </Button>
                      )
                    )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={safeCurrentPage >= totalPages}
                    className="h-8 px-3 text-xs"
                  >
                    ถัดไป
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>

    {/* ─── Custom Permissions Dialog ─── */}
    <Dialog open={!!permDialogUser} onOpenChange={(open) => { if (!open) setPermDialogUser(null); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-4 h-4" />
            สิทธิ์กำหนดเอง — {permDialogUser?.username}
          </DialogTitle>
        </DialogHeader>
        {loadingPerms ? (
          <div className="text-center py-6 text-sm text-muted-foreground">กำลังโหลด...</div>
        ) : customPermissions.length === 0 ? (
          <p className="text-center py-6 text-sm text-muted-foreground">ยังไม่มีสิทธิ์กำหนดเองในระบบ</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {customPermissions.map(perm => (
              <label key={perm.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                <Checkbox
                  checked={userCustomPerms.includes(perm.id)}
                  onCheckedChange={() => toggleCustomPerm(perm.id)}
                />
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: perm.color || '#6366f1' }} />
                <span className="text-sm font-medium">{perm.name}</span>
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setPermDialogUser(null)}>ยกเลิก</Button>
          <Button onClick={saveUserPerms} disabled={savingPerms}>
            {savingPerms ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Reports Management Component
   ═══════════════════════════════════════════════════════ */
function ReportsManagement() {
  const [reports, setReports] = useState<(Report & { reporter?: Profile; reported_user?: Profile })[]>([]);
  const [cancelRequests, setCancelRequests] = useState<(TagWarnCancelRequest & { requester?: Profile; approver?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [caseQuery, setCaseQuery] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [baristaQuery, setBaristaQuery] = useState('');
  const [dateQuery, setDateQuery] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  const normalizeUserLabel = (value?: string | null) => {
    if (!value) return 'Unknown';
    const matched = value.match(/^User-(\d+)$/i);
    return matched?.[1] || value;
  };

  const fetchReports = useCallback(async () => {
    try {
      const data = await withRetry(async () => {
        const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return data;
      });
      const userIds = new Set<string>();
      (data || []).forEach(r => { 
        if (r.reporter_id) userIds.add(r.reporter_id); 
        if (r.reported_user_id) userIds.add(r.reported_user_id); 
      });
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', Array.from(userIds));
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      const reportsWithUsers = (data || []).map(r => ({ ...r, reporter: profileMap.get(r.reporter_id), reported_user: profileMap.get(r.reported_user_id) }));
      setReports(reportsWithUsers);

      const { data: cancelData, error: cancelError } = await supabase
        .from('tag_warn_cancel_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (cancelError) throw cancelError;

      const typedCancelData = (cancelData || []) as unknown as TagWarnCancelRequest[];

      const requestUserIds = new Set<string>();
      typedCancelData.forEach((req) => {
        if (req.requested_by) requestUserIds.add(req.requested_by);
        if (req.approved_by) requestUserIds.add(req.approved_by);
      });

      let requestProfileMap = new Map<string, Profile>();
      if (requestUserIds.size > 0) {
        const { data: requestProfiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', Array.from(requestUserIds));
        requestProfileMap = new Map((requestProfiles || []).map((p) => [p.id, p]));
      }

      setCancelRequests(
        typedCancelData.map((req) => ({
          ...req,
          requester: requestProfileMap.get(req.requested_by),
          approver: req.approved_by ? requestProfileMap.get(req.approved_by) : undefined,
        })),
      );
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถโหลดรายงานได้', variant: 'destructive' });
      setReports([]); // Set empty array on error
      setCancelRequests([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  async function updateReportStatus(reportId: string, status: ReportStatus) {
    try {
      const { error } = await supabase.from('reports').update({ status, handled_at: status !== 'open' ? new Date().toISOString() : null }).eq('id', reportId);
      if (error) throw error;
      setReports(reports.map(r => r.id === reportId ? { ...r, status } : r));
      toast({ title: 'อัปเดตสถานะแล้ว' });
    } catch (error) {
      console.error('Error updating report:', error);
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    }
  }

  async function updateCancelRequestStatus(req: TagWarnCancelRequest, status: 'approved' | 'rejected') {
    if (!user?.id) {
      toast({ title: 'ไม่พบข้อมูลผู้ใช้', description: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง', variant: 'destructive' });
      return;
    }

    setApprovingId(req.id);

    const nowIso = new Date().toISOString();
    const payload =
      status === 'approved'
        ? {
            status,
            approved_by: user.id,
            approved_at: nowIso,
            rejected_by: null,
            rejected_at: null,
          }
        : {
            status,
            rejected_by: user.id,
            rejected_at: nowIso,
            approved_by: null,
            approved_at: null,
            external_sync_status: req.external_sync_status,
            external_synced_at: req.external_synced_at,
            external_sync_error: req.external_sync_error,
          };

    try {
      let updatedPayload = payload;

      if (status === 'approved') {
        const { data, error } = await supabase.functions.invoke('tag-warn-cancel-sync', {
          body: {
            request_id: req.id,
            approved_by: user.id,
          },
        });

        if (error) throw error;

        const requestData = data?.request;
        if (!requestData) {
          throw new Error('ไม่พบข้อมูลคำขอหลังอนุมัติ');
        }

        updatedPayload = {
          status: requestData.status,
          approved_by: requestData.approved_by,
          approved_at: requestData.approved_at,
          rejected_by: requestData.rejected_by,
          rejected_at: requestData.rejected_at,
          external_sync_status: requestData.external_sync_status,
          external_synced_at: requestData.external_synced_at,
          external_sync_error: requestData.external_sync_error,
        };

        if (data?.sync_success === false) {
          toast({
            title: 'อนุมัติสำเร็จ แต่ sync log หลักไม่สำเร็จ',
            description: 'สถานะคำขอถูกอัปเดตแล้ว แต่ส่งข้อมูล cancel ไป TagWarn ไม่สำเร็จ กรุณากด Retry จากหน้า Admin อีกครั้ง',
            variant: 'destructive',
          });
        }
      } else {
        const { error } = await supabase
          .from('tag_warn_cancel_requests')
          .update(payload)
          .eq('id', req.id)
          .eq('status', 'pending');

        if (error) throw error;
      }

      setCancelRequests((prev) =>
        prev.map((item) => {
          if (item.id !== req.id) return item;
          return {
            ...item,
            ...updatedPayload,
            approver: status === 'approved' ? ({ id: user.id, username: user.username ?? null } as Profile) : undefined,
          };
        }),
      );

      if (!(status === 'approved' && updatedPayload.external_sync_status === 'failed')) {
        toast({
          title: status === 'approved' ? 'อนุมัติคำขอสำเร็จ' : 'ปฏิเสธคำขอสำเร็จ',
          description: `เคส #${req.warn_sequence ?? '-'} ถูก${status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'}แล้ว`,
        });
      }
    } catch (error) {
      console.error('Error updating cancel request:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถอัปเดตคำขอได้', variant: 'destructive' });
    } finally {
      setApprovingId(null);
    }
  }

  async function approveCancelRequest(req: TagWarnCancelRequest) {
    await updateCancelRequestStatus(req, 'approved');
  }

  async function rejectCancelRequest(req: TagWarnCancelRequest) {
    await updateCancelRequestStatus(req, 'rejected');
  }

  const filteredReports = reports
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .filter((r) => {
      const statusMatched = filterStatus === 'all' || r.status === filterStatus;
      const caseMatched = !caseQuery.trim() || r.id.toLowerCase().includes(caseQuery.trim().toLowerCase());

      const memberLabel = normalizeUserLabel(r.reported_user?.username);
      const memberMatched =
        !memberQuery.trim() ||
        r.reported_user_id.toLowerCase().includes(memberQuery.trim().toLowerCase()) ||
        memberLabel.toLowerCase().includes(memberQuery.trim().toLowerCase());

      const baristaLabel = normalizeUserLabel(r.reporter?.username);
      const baristaMatched =
        !baristaQuery.trim() ||
        r.reporter_id.toLowerCase().includes(baristaQuery.trim().toLowerCase()) ||
        baristaLabel.toLowerCase().includes(baristaQuery.trim().toLowerCase());

      const reportDate = new Date(r.created_at).toISOString().slice(0, 10);
      const dateMatched = !dateQuery || reportDate === dateQuery;

      return statusMatched && caseMatched && memberMatched && baristaMatched && dateMatched;
    });

  const statusConfig: Record<string, { label: string; icon: typeof CheckCircle; className: string }> = {
    open: { label: 'รอดำเนินการ', icon: Clock, className: 'text-warning border-warning' },
    investigating: { label: 'กำลังตรวจสอบ', icon: Eye, className: 'text-info border-info' },
    resolved: { label: 'แก้ไขแล้ว', icon: CheckCircle, className: 'text-success border-success' },
    dismissed: { label: 'ยกเลิก', icon: XCircle, className: 'text-muted-foreground' },
  };

  const typeLabels: Record<string, string> = {
    inappropriate_behavior: 'พฤติกรรมไม่เหมาะสม',
    adult_content: 'เนื้อหาผู้ใหญ่',
    spam: 'สแปม',
    harassment: 'คุกคาม',
    other: 'อื่นๆ',
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Flag className="w-5 h-5" />
            จัดการรายงาน
          </CardTitle>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40"><SelectValue placeholder="กรองสถานะ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value="open">รอดำเนินการ</SelectItem>
              <SelectItem value="investigating">กำลังตรวจสอบ</SelectItem>
              <SelectItem value="resolved">แก้ไขแล้ว</SelectItem>
              <SelectItem value="dismissed">ยกเลิก</SelectItem>
            </SelectContent>
          </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <Input
              value={caseQuery}
              onChange={(e) => setCaseQuery(e.target.value)}
              placeholder="ค้นหาเลขเคส"
            />
            <Input
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
              placeholder="ค้นหา Member ID"
            />
            <Input
              value={baristaQuery}
              onChange={(e) => setBaristaQuery(e.target.value)}
              placeholder="ค้นหา Barista ID"
            />
            <Input
              type="date"
              value={dateQuery}
              onChange={(e) => setDateQuery(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">คำขอยกเลิก TagWarn (ต้องอนุมัติโดย Owner)</h3>
            <Badge variant="outline">{cancelRequests.length} คำขอ</Badge>
          </div>

          {cancelRequests.length === 0 ? (
            <div className="text-sm text-muted-foreground border rounded-lg p-3">ยังไม่มีคำขอยกเลิก</div>
          ) : (
            <div className="space-y-2">
              {cancelRequests.map((req) => (
                <Card key={req.id} className="border-l-4 border-l-amber-500/60">
                  <CardContent className="p-3 flex flex-wrap items-center gap-3 justify-between">
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">เคส #{req.warn_sequence ?? '-'}</Badge>
                        <Badge variant={req.status === 'pending' ? 'outline' : req.status === 'approved' ? 'default' : 'destructive'}>
                          {req.status === 'pending' ? 'รออนุมัติ' : req.status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธ'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{new Date(req.created_at).toLocaleString('th-TH')}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        สมาชิก: <strong className="text-foreground">{req.member_id ?? '-'}</strong> • ผู้ส่งคำขอ:{' '}
                        <strong className="text-foreground">{req.requested_by_name || req.requester?.username || 'Unknown'}</strong>
                        {req.approved_at && (
                          <>
                            {' '}• อนุมัติเมื่อ {new Date(req.approved_at).toLocaleString('th-TH')}
                          </>
                        )}
                      </p>
                    </div>

                    {req.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="destructive" onClick={() => rejectCancelRequest(req)} disabled={approvingId === req.id} className="gap-1">
                          <XCircle className="w-3.5 h-3.5" /> ปฏิเสธ
                        </Button>
                        <Button size="sm" onClick={() => approveCancelRequest(req)} disabled={approvingId === req.id} className="gap-2">
                          {approvingId === req.id && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                          <CheckCircle className="w-3.5 h-3.5" /> อนุมัติ
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
        ) : filteredReports.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">ไม่มีรายงาน</div>
        ) : (
          <div className="space-y-4">
            {filteredReports.map((report) => {
              const config = statusConfig[report.status];
              const StatusIcon = config.icon;
              return (
                <Card key={report.id} className="border-l-4 border-l-warning">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={config.className}><StatusIcon className="w-3 h-3 mr-1" />{config.label}</Badge>
                          <Badge variant="secondary">{typeLabels[report.report_type] || report.report_type}</Badge>
                          <span className="text-xs text-muted-foreground">{new Date(report.created_at).toLocaleString('th-TH')}</span>
                        </div>
                        <div className="text-sm whitespace-pre-wrap break-words max-h-32 overflow-y-auto pr-2">
                          {report.description}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>
                            Barista ID: <strong className="text-foreground">{normalizeUserLabel(report.reporter?.username)}</strong>
                          </span>
                          <span>
                            Member ID: <strong className="text-foreground">{normalizeUserLabel(report.reported_user?.username)}</strong>
                          </span>
                        </div>
                      </div>
                      <Select value={report.status} onValueChange={(value: ReportStatus) => updateReportStatus(report.id, value)}>
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">รอดำเนินการ</SelectItem>
                          <SelectItem value="investigating">กำลังตรวจสอบ</SelectItem>
                          <SelectItem value="resolved">แก้ไขแล้ว</SelectItem>
                          <SelectItem value="dismissed">ยกเลิก</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
