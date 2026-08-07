import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode, useRef } from 'react';
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

  // Operation version counter to ensure LOGOUT MUST WIN and stale promises are ignored
  const authOpVersionRef = useRef<number>(1);
  // Track loaded user ID to prevent duplicate initialization fetches
  const loadedUserIdRef = useRef<string | null>(null);

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

  const loadUserProfile = useCallback((sessionUser: SupabaseUser, isMounted: boolean, setLoading: boolean, opVersion: number) => {
    if (opVersion !== authOpVersionRef.current) {
      console.log('[Auth] Skipping loadUserProfile — stale operation version:', opVersion);
      return;
    }
    fetchUserProfile(sessionUser)
      .then((profile) => {
        if (!isMounted || opVersion !== authOpVersionRef.current) return;
        if (profile) {
          setUser(profile);
        } else {
          setUser(prev => prev ?? buildFallbackUser(sessionUser));
        }
        if (setLoading) setIsLoading(false);
      })
      .catch((error) => {
        console.error('[Auth] Failed to fetch user profile:', error);
        if (!isMounted || opVersion !== authOpVersionRef.current) return;
        // Keep previous valid profile state if it exists instead of wiping permissions
        setUser(prev => prev ?? buildFallbackUser(sessionUser));
        if (setLoading) setIsLoading(false);
      });
  }, [buildFallbackUser, fetchUserProfile]);

  const syncDiscordProfile = useCallback(async (opVersion: number) => {
    try {
      if (opVersion !== authOpVersionRef.current) return;
      const { data, error } = await supabase.functions.invoke('sync-discord-profile');
      if (opVersion !== authOpVersionRef.current) return;
      if (error) { console.warn('[Auth] Profile sync failed:', error.message); return; }
      if (data?.updated) {
        console.log('[Auth] Discord profile synced:', data.username);
        setUser(prev => (prev && opVersion === authOpVersionRef.current) ? { ...prev, username: data.username, avatar_url: data.avatar_url, banner_url: data.banner_url } : prev);
      }
    } catch (e) {
      console.warn('[Auth] Profile sync error:', e);
    }
  }, []);

  useEffect(() => {
    if (!user?.id || !session) return;
    const currentOpVersion = authOpVersionRef.current;

    // Check token readiness: if token expires in less than 5 seconds, skip background sync until token refreshed
    const isExpired = session.expires_at ? (session.expires_at * 1000 <= Date.now() + 5000) : false;
    if (isExpired) {
      console.warn('[Auth] Token is near expiration. Skipping background profile sync until token is refreshed.');
      return;
    }

    console.log('[Auth] Setting up real-time profile watch for user:', user.id);
    syncDiscordProfile(currentOpVersion);

    const channel = supabase
      .channel(`profile-watch-${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, (payload) => {
        if (currentOpVersion !== authOpVersionRef.current) return;
        const p = payload.new as { is_banned: boolean; ban_reason: string | null; username: string; avatar_url: string | null; banner_url: string | null; role?: string | null };
        console.log('[Auth] Profile update received');
        setUser(prev => (prev && currentOpVersion === authOpVersionRef.current) ? {
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

    return () => {
      console.log('[Auth] Cleaning up real-time profile subscription');
      supabase.removeChannel(channel);
    };
  }, [session, syncDiscordProfile, user?.id]);

  // Tab visibility change handler to refresh session & restore profile if missing perms
  useEffect(() => {
    let lastVisibilityCheck = 0;
    const handleVisibilityChange = async () => {
      const currentOpVersion = authOpVersionRef.current;
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastVisibilityCheck < 10000) return; // Throttle 10s
        lastVisibilityCheck = now;

        if (currentOpVersion !== authOpVersionRef.current) return;

        console.log('[Auth] Tab became visible. Verifying session freshness...');
        try {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentOpVersion !== authOpVersionRef.current) return;

          if (currentSession?.user) {
            setSession(currentSession);
            setUser(prevUser => {
              if (currentOpVersion !== authOpVersionRef.current) return prevUser;
              const isFallbackOrMissing = !prevUser || (prevUser.allowed_pages.length === 0 && !prevUser.is_owner && !prevUser.is_admin);
              if (isFallbackOrMissing) {
                console.log('[Auth] Tab visible and user has fallback/missing perms. Re-fetching profile...');
                loadUserProfile(currentSession.user, true, false, currentOpVersion);
              }
              return prevUser;
            });
          }
        } catch (e) {
          console.warn('[Auth] Visibility change session check error:', e);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadUserProfile]);

  useEffect(() => {
    let isMounted = true;
    console.log('[Auth] Initializing auth context single listener');

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      const currentOpVersion = authOpVersionRef.current;
      console.log('[Auth] State change:', event, 'user:', newSession?.user?.id);
      if (!isMounted || currentOpVersion !== authOpVersionRef.current) return;

      if (event === 'SIGNED_OUT' || !newSession?.user) {
        authOpVersionRef.current += 1;
        loadedUserIdRef.current = null;
        setUser(null);
        setSession(null);
        setIsLoading(false);
        return;
      }

      setSession(newSession);

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        // Single initialization flow: avoid duplicate fetches for the same user ID
        if (loadedUserIdRef.current === newSession.user.id) {
          console.log('[Auth] Profile already loaded or loading for user:', newSession.user.id);
          setIsLoading(false);
          return;
        }
        loadedUserIdRef.current = newSession.user.id;
        setTimeout(() => {
          if (!isMounted || currentOpVersion !== authOpVersionRef.current) return;
          loadUserProfile(newSession.user, isMounted, true, currentOpVersion);
        }, 0);
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        setUser(prevUser => {
          if (currentOpVersion !== authOpVersionRef.current) return prevUser;
          const hasValidPermissions = prevUser && (prevUser.allowed_pages.length > 0 || prevUser.is_owner || prevUser.is_admin);
          if (hasValidPermissions) {
            console.log('[Auth] Token refreshed, valid profile exists. Skipping reload.');
            return prevUser;
          }
          console.log('[Auth] Token refreshed with missing/fallback permissions. Reloading profile...');
          setTimeout(() => {
            if (!isMounted || currentOpVersion !== authOpVersionRef.current) return;
            loadUserProfile(newSession.user, isMounted, false, currentOpVersion);
          }, 0);
          return prevUser;
        });
        return;
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserProfile, user]);

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
    console.log('[Auth] Logging out (LOGOUT MUST WIN)');
    authOpVersionRef.current += 1;
    loadedUserIdRef.current = null;
    setUser(null);
    setSession(null);
    setIsLoading(false);
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('[Auth] Logout error:', error);
    } finally {
      window.location.href = '/login';
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!session?.user) return;
    const currentOpVersion = authOpVersionRef.current;
    console.log('[Auth] Refreshing user profile');
    try {
      const profile = await fetchUserProfileWithTimeout(session.user);
      if (currentOpVersion === authOpVersionRef.current && profile) {
        setUser(profile);
      }
    } catch (error) {
      console.error('[Auth] Failed to refresh user profile:', error);
    }
  }, [fetchUserProfileWithTimeout, session?.user]);

  const location = useLocation();
  const devBypassActive = import.meta.env.DEV && location.pathname.startsWith('/admin') && !session?.user;

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
        allowed_pages: ['users', 'banned-roles', 'banned-name', 'tag-warn', 'contracts', 'healing-messages', 'trading-history', 'role-transfer', 'bulk-role-manage', 'reports', 'banners', 'checkin-rewards', 'campaigns', 'product-catalog', 'discord-servers', 'redeem-codes', 'non-transferable-roles', 'roles-to-delete', 'permissions'],
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
        login: async () => { },
        logout: () => { window.location.href = '/'; },
        refreshUser: async () => { },
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
