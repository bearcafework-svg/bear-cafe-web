import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { useLocation } from 'react-router-dom';

interface User {
  id: string;
  username: string;
  discord_username: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  discord_id: string;
  is_admin: boolean;
  is_owner: boolean;
  is_banned: boolean;
  ban_reason: string | null;
  allowed_pages: string[];
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (turnstileToken: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PROFILE_FETCH_TIMEOUT_MS = 15000;

type UserRoleRow = { role: string | null };
type PermissionIdRow = { permission_id: string | null };
type CustomPermissionRow = { allowed_pages: string[] | null };
type ProfileRow = {
  id: string;
  username: string;
  discord_username: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  discord_id: string;
  is_banned: boolean | null;
  ban_reason: string | null;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const buildFallbackUser = useCallback((sessionUser: SupabaseUser): User => {
    const metadata = sessionUser.user_metadata || {};
    return {
      id: sessionUser.id,
      username: metadata.username || metadata.full_name || metadata.name || 'ผู้ใช้',
      discord_username: metadata.discord_username || null,
      avatar_url: metadata.avatar_url || metadata.picture || null,
      banner_url: null,
      discord_id: metadata.discord_id || metadata.sub || sessionUser.id,
      is_admin: false,
      is_owner: false,
      is_banned: false,
      ban_reason: null,
      allowed_pages: [],
    };
  }, []);

  const fetchUserProfile = useCallback(async (sessionUser: SupabaseUser): Promise<User | null> => {
    console.log('[Auth] Fetching profile for user:', sessionUser.id);

    const [profileResult, rolesResult, permIdsResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, username, discord_username, avatar_url, banner_url, discord_id, is_banned, ban_reason, role')
        .eq('id', sessionUser.id)
        .maybeSingle(),
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', sessionUser.id),
      supabase
        .from('user_custom_permissions')
        .select('permission_id')
        .eq('user_id', sessionUser.id),
    ]);

    if (profileResult.error) {
      console.error('[Auth] Profile fetch error:', profileResult.error);
      throw profileResult.error;
    }

    const profile = profileResult.data as (ProfileRow & { role?: string | null }) | null;
    if (!profile) {
      console.warn('[Auth] Profile not found for user:', sessionUser.id);
      return null;
    }

    const roleRows = (rolesResult.data ?? []) as UserRoleRow[];
    const roleSet = new Set(roleRows.map((r) => r.role).filter(Boolean));
    const is_owner = profile.role === 'owner';
    const is_admin = roleSet.has('admin');

    const allPages = new Set<string>();
    const permissionRows = (permIdsResult.data ?? []) as PermissionIdRow[];
    const permIds = permissionRows.map((r) => r.permission_id).filter((id): id is string => Boolean(id));
    if (permIds.length > 0) {
      const { data: cpData } = await supabase
        .from('custom_permissions')
        .select('allowed_pages')
        .in('id', permIds);
      const customPermissions = (cpData ?? []) as CustomPermissionRow[];
      customPermissions.forEach((cp) => {
        if (Array.isArray(cp.allowed_pages)) {
          cp.allowed_pages.forEach((p: string) => allPages.add(p));
        }
      });
    }

    console.log('[Auth] Profile loaded:', profile.username);

    return {
      id: profile.id,
      username: profile.username,
      discord_username: profile.discord_username || null,
      avatar_url: profile.avatar_url,
      banner_url: profile.banner_url,
      discord_id: profile.discord_id,
      is_admin,
      is_owner,
      is_banned: profile.is_banned || false,
      ban_reason: profile.ban_reason,
      allowed_pages: Array.from(allPages),
    };
  }, []);

  const fetchUserProfileWithTimeout = useCallback(async (sessionUser: SupabaseUser): Promise<User> => {
    const timeoutPromise = new Promise<null>((resolve) => {
      window.setTimeout(() => resolve(null), PROFILE_FETCH_TIMEOUT_MS);
    });
    const profile = await Promise.race([fetchUserProfile(sessionUser), timeoutPromise]);
    if (!profile) {
      console.warn('[Auth] Profile fetch timed out — using fallback WITHOUT resetting roles');
      return buildFallbackUser(sessionUser);
    }
    return profile;
  }, [buildFallbackUser, fetchUserProfile]);

  const loadUserProfile = useCallback((sessionUser: SupabaseUser, isMounted: boolean, setLoading: boolean) => {
    fetchUserProfile(sessionUser)
      .then((profile) => {
        if (!isMounted) return;
        setUser(prev => profile ?? prev ?? buildFallbackUser(sessionUser));
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('[Auth] Failed to fetch user profile:', error);
        if (!isMounted) return;
        setUser(prev => prev ?? buildFallbackUser(sessionUser));
        if (setLoading) setIsLoading(false);
      });
  }, [buildFallbackUser, fetchUserProfile]);

  const syncDiscordProfile = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('sync-discord-profile');
      if (error) { console.warn('[Auth] Profile sync failed:', error.message); return; }
      if (data?.updated) {
        console.log('[Auth] Discord profile synced:', data.username);
        setUser(prev => prev ? { ...prev, username: data.username, avatar_url: data.avatar_url, banner_url: data.banner_url } : null);
      }
    } catch (e) {
      console.warn('[Auth] Profile sync error:', e);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    console.log('[Auth] Setting up real-time profile watch for user:', user.id);
    syncDiscordProfile();
    const channel = supabase
      .channel(`profile-watch-${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, (payload) => {
        const p = payload.new as { is_banned: boolean; ban_reason: string | null; username: string; avatar_url: string | null; banner_url: string | null; role?: string | null };
        console.log('[Auth] Profile update received');
        setUser(prev => prev ? {
          ...prev,
          is_banned: p.is_banned,
          ban_reason: p.ban_reason,
          username: p.username,
          avatar_url: p.avatar_url,
          banner_url: p.banner_url,
          is_owner: p.role === 'owner',
        } : null);
      })
      .subscribe((status) => { console.log('[Auth] Realtime subscription status:', status); });
    return () => { console.log('[Auth] Cleaning up real-time profile subscription'); supabase.removeChannel(channel); };
  }, [syncDiscordProfile, user?.id]);

  useEffect(() => {
    let isMounted = true;
    let profileLoaded = false;
    console.log('[Auth] Initializing auth context');

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log('[Auth] State change:', event, 'user:', newSession?.user?.id);
      if (!isMounted) return;
      setSession(newSession);

      if (event === 'SIGNED_OUT') {
        setUser(null); setSession(null); setIsLoading(false); profileLoaded = false; return;
      }
      if (newSession?.user) {
        if (event === 'TOKEN_REFRESHED' && profileLoaded) { console.log('[Auth] Token refreshed, skipping profile reload'); return; }
        if (event === 'INITIAL_SESSION') return;
        profileLoaded = true;
        setTimeout(() => { if (!isMounted) return; loadUserProfile(newSession.user, isMounted, true); }, 0);
      } else {
        setUser(null); setIsLoading(false); profileLoaded = false;
      }
    });

    supabase.auth.getSession().then(({ data: { session: existingSession }, error }) => {
      console.log('[Auth] Initial session check:', existingSession?.user?.id, 'error:', error?.message);
      if (!isMounted) return;
      if (error) { console.error('[Auth] Session error:', error); setIsLoading(false); return; }
      setSession(existingSession);
      if (existingSession?.user) { profileLoaded = true; loadUserProfile(existingSession.user, isMounted, true); }
      else { console.log('[Auth] No existing session, user not logged in'); setIsLoading(false); }
    }).catch((error) => { console.error('[Auth] Init error:', error); if (isMounted) setIsLoading(false); });

    return () => { isMounted = false; subscription.unsubscribe(); };
  }, [loadUserProfile]);

  const isInIframe = useCallback(() => { try { return window.self !== window.top; } catch (e) { return true; } }, []);

  const login = useCallback(async (turnstileToken: string) => {
    if (isRedirecting) { console.log('[Auth] Login already in progress'); return; }
    console.log('[Auth] Starting login flow');
    setIsRedirecting(true);
    try {
      const response = await supabase.functions.invoke('discord-auth', {
        body: { turnstileToken, redirectUrl: `${window.location.origin}/auth/callback` },
      });
      console.log('[Auth] Discord auth response:', response.data ? 'success' : 'failed');
      if (response.error) { console.error('[Auth] Discord auth error:', response.error); setIsRedirecting(false); throw new Error(response.error.message); }
      if (response.data?.authUrl) {
        if (isInIframe()) { console.log('[Auth] Opening Discord auth in new window (iframe detected)'); window.open(response.data.authUrl, '_blank', 'noopener,noreferrer'); setIsRedirecting(false); }
        else { console.log('[Auth] Redirecting to Discord auth'); window.location.href = response.data.authUrl; }
      } else { console.error('[Auth] Failed to get OAuth URL:', response); setIsRedirecting(false); throw new Error('Failed to get OAuth URL'); }
    } catch (error) { console.error('[Auth] Login error:', error); setIsRedirecting(false); throw error; }
  }, [isInIframe, isRedirecting]);

  const logout = useCallback(async () => {
    console.log('[Auth] Logging out');
    try { setUser(null); setSession(null); await supabase.auth.signOut(); window.location.href = '/login'; }
    catch (error) { console.error('[Auth] Logout error:', error); window.location.href = '/login'; }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!session?.user) return;
    console.log('[Auth] Refreshing user profile');
    try { const profile = await fetchUserProfileWithTimeout(session.user); setUser(profile); }
    catch (error) { console.error('[Auth] Failed to refresh user profile:', error); }
  }, [fetchUserProfileWithTimeout, session?.user]);

  const location = useLocation();
  const devBypassActive = import.meta.env.DEV && location.pathname.startsWith('/admin');

  const value = useMemo(() => {
    if (devBypassActive) {
      const mockAdminUser: User = {
        id: 'mock-admin-id',
        username: 'Mock Administrator (Local Dev)',
        discord_username: 'mock_admin',
        avatar_url: null,
        banner_url: null,
        discord_id: '123456789012345678',
        is_admin: true,
        is_owner: true,
        is_banned: false,
        ban_reason: null,
        allowed_pages: ['users', 'banned-roles', 'banned-words', 'tag-warn', 'contracts', 'healing-messages', 'trading-history', 'role-transfer', 'bulk-role-manage', 'reports', 'categories', 'banners', 'roles', 'checkin-rewards', 'campaigns', 'product-catalog', 'discord-servers', 'redeem-codes', 'non-transferable-roles', 'roles-to-delete', 'permissions'],
      };
      return {
        user: mockAdminUser,
        session: {
          access_token: 'mock-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh',
          user: { id: 'mock-admin-id', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '' }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        isLoading: false,
        isAuthenticated: true,
        login: async () => {},
        logout: () => { window.location.href = '/'; },
        refreshUser: async () => {},
      };
    }

    return {
      user,
      session,
      isLoading,
      isAuthenticated: !!session && !!user,
      login,
      logout,
      refreshUser,
    };
  }, [isLoading, login, logout, refreshUser, session, user, devBypassActive]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
