import type { FunctionsError } from '@supabase/supabase-js';

type RoleBanPayload = {
  code?: string;
  message?: string;
};

export const ROLE_BAN_CODE = 'ROLE_BANNED';

export const readRoleBanPayload = async (
  error: FunctionsError | null,
): Promise<RoleBanPayload | null> => {
  if (!error || !('context' in error)) {
    return null;
  }

  const response = error.context;
  if (!response || response.status !== 403) {
    return null;
  }

  try {
    const payload = (await response.json()) as RoleBanPayload;
    if (payload?.code === ROLE_BAN_CODE) {
      return payload;
    }
  } catch (parseError) {
    console.error('Failed to parse role ban payload:', parseError);
  }

  return null;
};
