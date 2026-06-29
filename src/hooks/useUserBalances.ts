import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_POINTS_CAP, resolveMaxCap } from '@/lib/points-cap';

export interface UserBalances {
  points: number;
  maxCap: number;
  ticketPoint: number;
  ticketPiecePoint: number;
}

const DEFAULT_BALANCES: UserBalances = {
  points: 0,
  maxCap: DEFAULT_POINTS_CAP,
  ticketPoint: 0,
  ticketPiecePoint: 0,
};

type PointsApiResponse = {
  ok?: boolean;
  points?: number | string;
  maxCap?: number | string;
};

export function userBalancesQueryKey(discordId: string) {
  return ['user-balances', discordId] as const;
}

async function syncPointsFromApi(
  discordId: string,
): Promise<{ points: number; maxCap: number } | null> {
  const pointsApiUrl = import.meta.env.VITE_POINTS_API_URL;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const baseUrl =
    pointsApiUrl ||
    (supabaseUrl ? `${supabaseUrl}/functions/v1/bdfd-api` : null);

  if (!baseUrl) return null;

  try {
    const headers: Record<string, string> = {};
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (anonKey) headers.apikey = anonKey;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    const res = await fetch(
      `${baseUrl}?action=get&userId=${encodeURIComponent(discordId)}&t=${Date.now()}`,
      { headers },
    );
    const data = (await res.json()) as PointsApiResponse;
    if (!data?.ok) return null;

    const points =
      typeof data.points === 'number' ? data.points : Number(data.points);
    const maxCap =
      typeof data.maxCap === 'number' ? data.maxCap : Number(data.maxCap);

    if (!Number.isFinite(points) || !Number.isFinite(maxCap)) return null;
    return { points, maxCap };
  } catch {
    return null;
  }
}

export async function fetchUserBalances(discordId: string): Promise<UserBalances> {
  const synced = await syncPointsFromApi(discordId);

  const { data } = await supabase
    .from('user_points')
    .select('points, max_cap, ticket_point, ticket_piece_point')
    .eq('discord_id', discordId)
    .maybeSingle();

  const points = synced?.points ?? data?.points ?? 0;
  const storedCap = synced?.maxCap ?? data?.max_cap;

  return {
    points,
    maxCap: resolveMaxCap(storedCap, points),
    ticketPoint: data?.ticket_point ?? 0,
    ticketPiecePoint: data?.ticket_piece_point ?? 0,
  };
}

/** Shared cache — all useUserBalances subscribers update together. */
export function useUserBalances(discordId: string | null | undefined) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: userBalancesQueryKey(discordId ?? ''),
    queryFn: () => fetchUserBalances(discordId!),
    enabled: Boolean(discordId),
    placeholderData: DEFAULT_BALANCES,
    refetchInterval: discordId ? 30_000 : false,
  });

  const balances = data ?? DEFAULT_BALANCES;

  return {
    ...balances,
    loading: isLoading,
    refetch,
  };
}

/** Call after check-in, redeem, or any action that changes balances. */
export function useInvalidateUserBalances() {
  const queryClient = useQueryClient();

  return useCallback(
    (discordId: string | null | undefined) => {
      if (!discordId) return;
      void queryClient.invalidateQueries({ queryKey: userBalancesQueryKey(discordId) });
    },
    [queryClient],
  );
}
