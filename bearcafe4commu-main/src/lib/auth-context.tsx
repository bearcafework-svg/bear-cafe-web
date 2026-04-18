import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';

interface User {
  id: string;
  username: string;
  discord_username: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  discord_id: string;
  is_admin: boolean;
  is_owner: boolean; // Changed from is_moderator
  is_banned: boolean;
  ban_reason: string | null;
  allowed_pages: string[]; // from custom permissions
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

const PROFILE_FETCH_TIMEOUT_MS = 15000; // เพิ่มจาก 8s เป็น 15s รองรับ Supabase cold start

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const buildFallbackUser = (sessionUser: SupabaseUser): User => {
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
  };

  const fetchUserProfile = async (sessionUser: SupabaseUser): Promise<User | null> => {
    console.log('[Auth] Fetching profile for user:', sessionUser.id);

    // profile + roles parallel (ไม่ใช้ join เพื่อหลีกเลี่ยง PGRST200)
    const [profileResult, rolesResult, permIdsResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, username, discord_username, avatar_url, banner_url, discord_id, is_banned, ban_reason')
        .eq('id', sessionUser.id)
        .maybeSingle(),
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', sessionUser.id),
      // ดึงแค่ permission_id ก่อน ไม่ join — ป้องกัน PGRST200 เมื่อ FK หาย
      supabase
        .from('user_custom_permissions')
        .select('permission_id')
        .eq('user_id', sessionUser.id),
    ]);

    if (profileResult.error) {
      console.error('[Auth] Profile fetch error:', profileResult.error);
      throw profileResult.error;
    }

    const profile = profileResult.data;
    if (!profile) {
      console.warn('[Auth] Profile not found for user:', sessionUser.id);
      return null;
    }

    // Roles
    const roleSet = new Set((rolesResult.data ?? []).map((r: any) => r.role));
    const is_owner = roleSet.has('moderator');
    const is_admin = roleSet.has('admin');

    // Permissions — ดึง allowed_pages จาก custom_permissions แยก
    const allPages = new Set<string>();
    const permIds = (permIdsResult.data ?? []).map((r: any) => r.permission_id).filter(Boolean);
    if (permIds.length > 0) {
      const { data: cpData } = await supabase
        .from('custom_permissions')
        .select('allowed_pages')
        .in('id', permIds);
      (cpData ?? []).forEach((cp: any) => {
        if (Array.isArray(cp.allowed_pages)) {
          cp.allowed_pages.forEach((p: string) => allPages.add(p));
        }
      });
    }

    console.log('[Auth] Profile loaded:', profile.username);

    return {
      id: profile.id,
      username: profile.username,
      discord_username: (profile as any).discord_username || null,
      avatar_url: profile.avatar_url,
      banner_url: profile.banner_url,
      discord_id: profile.discord_id,
      is_admin,
      is_owner,
      is_banned: profile.is_banned || false,
      ban_reason: profile.ban_reason,
      allowed_pages: Array.from(allPages),
    };
  };

  const fetchUserProfileWithTimeout = async (sessionUser: SupabaseUser): Promise<User> => {
    const timeoutPromise = new Promise<null>((resolve) => {
      window.setTimeout(() => resolve(null), PROFILE_FETCH_TIMEOUT_MS);
    });

    const profile = await Promise.race([
      fetchUserProfile(sessionUser),
      timeoutPromise,
    ]);

    if (!profile) {
      console.warn('[Auth] Profile fetch timed out — using fallback WITHOUT resetting roles');
      // ถ้า user มี role อยู่แล้ว (เช่น refresh หน้า) ให้คงไว้ ไม่ reset เป็น false
      return buildFallbackUser(sessionUser);
    }

    return profile;
  };

  const loadUserProfile = (sessionUser: SupabaseUser, isMounted: boolean, setLoading: boolean) => {
    fetchUserProfile(sessionUser)
      .then((profile) => {
        if (!isMounted) return;
        if (profile) {
          setUser(profile);
        } else {
          // profile ไม่มีใน DB — ใช้ fallback แต่ไม่ reset role
          setUser(prev => prev ?? buildFallbackUser(sessionUser));
        }
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('[Auth] Failed to fetch user profile:', error);
        if (!isMounted) return;
        // error — คง user เดิมไว้ถ้ามี ไม่ reset role
        setUser(prev => prev ?? buildFallbackUser(sessionUser));
        if (setLoading) setIsLoading(false);
      });
  };

  // Sync Discord profile on load (auto-update avatar/username without re-login)
  const syncDiscordProfile = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('sync-discord-profile');
      if (error) {
        console.warn('[Auth] Profile sync failed:', error.message);
        return;
      }
      if (data?.updated) {
        console.log('[Auth] Discord profile synced:', data.username);
        setUser(prev => prev ? {
          ...prev,
          username: data.username,
          avatar_url: data.avatar_url,
          banner_url: data.banner_url,
        } : null);
      }
    } catch (e) {
      console.warn('[Auth] Profile sync error:', e);
    }
  };

  // Subscribe to profile changes for real-time ban detection + profile updates
  useEffect(() => {
    if (!user?.id) return;

    console.log('[Auth] Setting up real-time profile watch for user:', user.id);

    // Sync Discord profile once on mount
    syncDiscordProfile();

    const channel = supabase
      .channel(`profile-watch-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const p = payload.new as {
            is_banned: boolean;
            ban_reason: string | null;
            username: string;
            avatar_url: string | null;
            banner_url: string | null;
          };
          console.log('[Auth] Profile update received');

          setUser(prev => prev ? {
            ...prev,
            is_banned: p.is_banned,
            ban_reason: p.ban_reason,
            username: p.username,
            avatar_url: p.avatar_url,
            banner_url: p.banner_url,
          } : null);
        }
      )
      .subscribe((status) => {
        console.log('[Auth] Realtime subscription status:', status);
      });

    return () => {
      console.log('[Auth] Cleaning up real-time profile subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    let isMounted = true;
    // ใช้ ref ป้องกัน loadUserProfile ซ้ำจาก onAuthStateChange + getSession
    let profileLoaded = false;

    console.log('[Auth] Initializing auth context');

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log('[Auth] State change:', event, 'user:', newSession?.user?.id);

        if (!isMounted) return;

        setSession(newSession);

        if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
          setIsLoading(false);
          profileLoaded = false;
          return;
        }

        if (newSession?.user) {
          // TOKEN_REFRESHED: session ยังอยู่ ไม่ต้อง reload profile ใหม่
          // จะ reload เฉพาะ SIGNED_IN (login ใหม่) หรือยังไม่เคยโหลด
          if (event === 'TOKEN_REFRESHED' && profileLoaded) {
            console.log('[Auth] Token refreshed, skipping profile reload');
            return;
          }

          // INITIAL_SESSION จะถูก handle โดย getSession() ด้านล่างแทน
          // เพื่อป้องกัน double load
          if (event === 'INITIAL_SESSION') {
            return;
          }

          profileLoaded = true;
          setTimeout(() => {
            if (!isMounted) return;
            loadUserProfile(newSession.user, isMounted, true);
          }, 0);
        } else {
          setUser(null);
          setIsLoading(false);
          profileLoaded = false;
        }
      }
    );

    // getSession เป็น single source of truth สำหรับ initial load
    supabase.auth.getSession().then(({ data: { session: existingSession }, error }) => {
      console.log('[Auth] Initial session check:', existingSession?.user?.id, 'error:', error?.message);

      if (!isMounted) return;

      if (error) {
        console.error('[Auth] Session error:', error);
        setIsLoading(false);
        return;
      }

      setSession(existingSession);

      if (existingSession?.user) {
        profileLoaded = true;
        loadUserProfile(existingSession.user, isMounted, true);
      } else {
        console.log('[Auth] No existing session, user not logged in');
        setIsLoading(false);
      }
    }).catch((error) => {
      console.error('[Auth] Init error:', error);
      if (isMounted) setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Check if running inside an iframe
  const isInIframe = () => {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  };

  const login = async (turnstileToken: string) => {
    // Only prevent if already redirecting
    if (isRedirecting) {
      console.log('[Auth] Login already in progress');
      return;
    }
    
    console.log('[Auth] Starting login flow');
    setIsRedirecting(true);
    
    try {
      const response = await supabase.functions.invoke('discord-auth', {
        body: { turnstileToken, redirectUrl: `${window.location.origin}/auth/callback` },
      });

      console.log('[Auth] Discord auth response:', response.data ? 'success' : 'failed');

      if (response.error) {
        console.error('[Auth] Discord auth error:', response.error);
        setIsRedirecting(false);
        throw new Error(response.error.message);
      }

      if (response.data?.authUrl) {
        if (isInIframe()) {
          // Open in new window if inside iframe (Discord blocks OAuth in iframes)
          console.log('[Auth] Opening Discord auth in new window (iframe detected)');
          window.open(response.data.authUrl, '_blank', 'noopener,noreferrer');
          setIsRedirecting(false);
        } else {
          console.log('[Auth] Redirecting to Discord auth');
          window.location.href = response.data.authUrl;
        }
      } else {
        console.error('[Auth] Failed to get OAuth URL:', response);
        setIsRedirecting(false);
        throw new Error('Failed to get OAuth URL');
      }
    } catch (error) {
      console.error('[Auth] Login error:', error);
      setIsRedirecting(false);
      throw error;
    }
  };

  const logout = async () => {
    console.log('[Auth] Logging out');
    try {
      setUser(null);
      setSession(null);
      await supabase.auth.signOut();
      // Redirect to login page
      window.location.href = '/login';
    } catch (error) {
      console.error('[Auth] Logout error:', error);
      // Force redirect even on error
      window.location.href = '/login';
    }
  };

  const refreshUser = async () => {
    if (!session?.user) return;
    
    console.log('[Auth] Refreshing user profile');
    try {
      const profile = await fetchUserProfileWithTimeout(session.user);
      setUser(profile);
    } catch (error) {
      console.error('[Auth] Failed to refresh user profile:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated: !!session && !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
