import type { FunctionsError } from '@supabase/supabase-js';

type FunctionsErrorPayload = {
  message?: string;
  error?: string;
  retryAfterSeconds?: number;
};

export const readFunctionsErrorPayload = async (
  error: FunctionsError | null,
): Promise<FunctionsErrorPayload | null> => {
  if (!error || !('context' in error)) {
    return null;
  }

  const response = error.context;
  if (!response) {
    return null;
  }

  try {
    const payload = (await response.json()) as FunctionsErrorPayload;
    if (payload && typeof payload === 'object') {
      return payload;
    }
  } catch (parseError) {
    console.error('Failed to parse functions error payload:', parseError);
  }

  return null;
};
