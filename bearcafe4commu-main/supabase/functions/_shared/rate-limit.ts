const limiterStore = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;
  const attempts = (limiterStore.get(key) || []).filter((timestamp) => timestamp > windowStart);

  if (attempts.length >= limit) {
    const oldest = attempts[0];
    const retryAfterSeconds = Math.ceil((oldest + windowMs - now) / 1000);
    limiterStore.set(key, attempts);
    return { allowed: false, retryAfterSeconds };
  }

  attempts.push(now);
  limiterStore.set(key, attempts);
  return { allowed: true };
}

export function getClientIp(req: Request): string {
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown';
  return req.headers.get('x-real-ip') ?? 'unknown';
}
