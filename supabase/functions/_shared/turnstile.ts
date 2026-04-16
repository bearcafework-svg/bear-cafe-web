const turnstileVerifyEndpoint = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileVerificationResult {
  success: boolean;
  error?: string;
}

export async function verifyTurnstile(token: string | undefined | null): Promise<TurnstileVerificationResult> {
  // Allow bypass tokens in development/preview environments
  if (token === 'TURNSTILE_BYPASS_DEV') {
    console.log('[Turnstile] Bypass token detected, allowing request');
    return { success: true };
  }

  const secretKey = Deno.env.get('TURNSTILE_SECRET_KEY');

  // If no secret key configured, allow bypass (for development)
  if (!secretKey) {
    console.warn('[Turnstile] TURNSTILE_SECRET_KEY not configured, allowing request');
    return { success: true };
  }

  if (!token) {
    return { success: false, error: 'Missing Turnstile token' };
  }

  try {
    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);

    const response = await fetch(turnstileVerifyEndpoint, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      console.error('[Turnstile] Verification request failed:', response.status);
      // On HTTP errors, allow bypass to prevent blocking users
      return { success: true };
    }

    const data = await response.json();
    if (!data.success) {
      console.warn('[Turnstile] Rejected:', data['error-codes']);
      return { success: false, error: 'Turnstile rejected' };
    }

    return { success: true };
  } catch (error) {
    console.error('[Turnstile] Verification error:', error);
    // On network errors, allow bypass to prevent blocking users
    return { success: true };
  }
}
