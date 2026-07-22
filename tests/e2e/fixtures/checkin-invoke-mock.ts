/**
 * Shared `supabase.functions.invoke` mock router for fixture-e2e / INT Arrange.
 *
 * Usage (later FE2E / INT — do not mock QueryClient):
 *
 * ```ts
 * vi.mock('@/integrations/supabase/client', () => ({
 *   supabase: {
 *     functions: { invoke: (...args: unknown[]) => router.invoke(...args as [string, InvokeOptions?]) },
 *     auth: { getSession: async () => ({ data: { session: authSessionPresent.session } }) },
 *     from: vi.fn(), // guest public tables — wire separately with guestPublic* fixtures
 *   },
 * }));
 * ```
 *
 * Or pass `router.invoke` into a partial mock factory. Spy via `countCalls(fn)`.
 */
import type { CheckinActionPayload, CheckinStatusOkPayload } from './checkin-flow-optimization';

/** Auth-edge function names that guest browse must not invoke (FE2E-3 boundary). */
export const AUTH_EDGE_FUNCTIONS = [
  'get-checkin-status',
  'perform-checkin',
  'perform-makeup-checkin',
] as const;

export type AuthEdgeFunction = (typeof AUTH_EDGE_FUNCTIONS)[number];

export type InvokeOptions = {
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
};

export type InvokeSuccess = { data: unknown; error: null };
export type InvokeFailure = { data: null; error: Error };
export type InvokeResult = InvokeSuccess | InvokeFailure;

export type CheckinInvokeHandlers = {
  getCheckinStatus?: (
    options?: InvokeOptions,
  ) => CheckinStatusOkPayload | CheckinActionFailLike | unknown;
  performCheckin?: (
    options?: InvokeOptions,
  ) => CheckinActionPayload | unknown;
  performMakeupCheckin?: (
    options?: InvokeOptions,
  ) => CheckinActionPayload | unknown;
  /** Fallback for other function names (e.g. get-role-info). */
  other?: (fn: string, options?: InvokeOptions) => unknown;
};

type CheckinActionFailLike = { ok: false; error: string };

export type CheckinInvokeCall = {
  fn: string;
  options?: InvokeOptions;
};

export type CheckinInvokeRouter = {
  invoke: (fn: string, options?: InvokeOptions) => Promise<InvokeResult>;
  calls: CheckinInvokeCall[];
  countCalls: (fn: string) => number;
  countAuthEdgeCalls: () => number;
  reset: () => void;
  setHandlers: (handlers: CheckinInvokeHandlers) => void;
};

function toInvokeResult(payload: unknown): InvokeResult {
  if (
    payload !== null &&
    typeof payload === 'object' &&
    'ok' in payload &&
    (payload as { ok: unknown }).ok === false
  ) {
    const error =
      'error' in payload && typeof (payload as { error: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : 'action_failed';
    return { data: payload, error: null };
  }
  return { data: payload, error: null };
}

/**
 * Creates an invoke implementation that routes by edge function name and
 * records calls for FE2E spies (0 status after happy claim; ≥1 on MVP flags).
 */
export function createCheckinInvokeRouter(
  initialHandlers: CheckinInvokeHandlers = {},
): CheckinInvokeRouter {
  let handlers: CheckinInvokeHandlers = { ...initialHandlers };
  const calls: CheckinInvokeCall[] = [];

  const invoke = async (
    fn: string,
    options?: InvokeOptions,
  ): Promise<InvokeResult> => {
    calls.push({ fn, options });

    try {
      switch (fn) {
        case 'get-checkin-status': {
          if (!handlers.getCheckinStatus) {
            return {
              data: null,
              error: new Error('unmocked:get-checkin-status'),
            };
          }
          return toInvokeResult(handlers.getCheckinStatus(options));
        }
        case 'perform-checkin': {
          if (!handlers.performCheckin) {
            return {
              data: null,
              error: new Error('unmocked:perform-checkin'),
            };
          }
          return toInvokeResult(handlers.performCheckin(options));
        }
        case 'perform-makeup-checkin': {
          if (!handlers.performMakeupCheckin) {
            return {
              data: null,
              error: new Error('unmocked:perform-makeup-checkin'),
            };
          }
          return toInvokeResult(handlers.performMakeupCheckin(options));
        }
        default: {
          if (handlers.other) {
            return toInvokeResult(handlers.other(fn, options));
          }
          return {
            data: null,
            error: new Error(`unmocked:${fn}`),
          };
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'invoke_failed';
      return { data: null, error: new Error(message) };
    }
  };

  return {
    invoke,
    calls,
    countCalls: (fn: string) => calls.filter((c) => c.fn === fn).length,
    countAuthEdgeCalls: () =>
      calls.filter((c) =>
        (AUTH_EDGE_FUNCTIONS as readonly string[]).includes(c.fn),
      ).length,
    reset: () => {
      calls.length = 0;
    },
    setHandlers: (next) => {
      handlers = { ...next };
    },
  };
}

/**
 * Preset router for FE2E-1 happy claim: status seed + claim ok (control / no MVP).
 * Callers swap `performCheckin` to MVP A/B for FE2E-2.
 */
export function createFe2eHappyPathInvokeRouter(args: {
  statusOk: CheckinStatusOkPayload;
  claimOk: CheckinActionPayload;
  makeupOk?: CheckinActionPayload;
}): CheckinInvokeRouter {
  return createCheckinInvokeRouter({
    getCheckinStatus: () => args.statusOk,
    performCheckin: () => args.claimOk,
    performMakeupCheckin: () =>
      args.makeupOk ?? { ok: false, error: 'unmocked:perform-makeup-checkin' },
  });
}
