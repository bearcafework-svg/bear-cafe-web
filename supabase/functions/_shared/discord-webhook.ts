/**
 * Shared Discord Webhook & Bot Message utility
 * - Deduplication (TTL ~15 min)
 * - Global rate limiting (10 req/min)
 * - Support for both Webhook URLs and Bot API (for Buttons/Components)
 * - Never logs full webhook URLs or tokens
 */

// ── Dedup Store ──
const dedupStore = new Map<string, number>();
const DEDUP_TTL_MS = 15 * 60 * 1000; // 15 minutes

function isDuplicate(key: string): boolean {
  cleanExpired(dedupStore, DEDUP_TTL_MS);
  return dedupStore.has(key);
}

function markSent(key: string): void {
  dedupStore.set(key, Date.now());
}

// ── Global Rate Limiter (sliding window) ──
const rateBuckets = new Map<string, number[]>();
const GLOBAL_LIMIT = 10;
const GLOBAL_WINDOW_MS = 60_000; // 1 minute

interface RateLimitCheck {
  allowed: boolean;
  retryAfterMs?: number;
}

function checkGlobalRate(bucketKey: string): RateLimitCheck {
  const now = Date.now();
  const windowStart = now - GLOBAL_WINDOW_MS;
  const timestamps = (rateBuckets.get(bucketKey) ?? []).filter(t => t > windowStart);

  if (timestamps.length >= GLOBAL_LIMIT) {
    const oldest = timestamps[0];
    const retryAfterMs = oldest + GLOBAL_WINDOW_MS - now;
    rateBuckets.set(bucketKey, timestamps);
    return { allowed: false, retryAfterMs };
  }

  timestamps.push(now);
  rateBuckets.set(bucketKey, timestamps);
  return { allowed: true };
}

export interface WebhookSendResult {
  success: boolean;
  messageId?: string;
  queued?: boolean;
  error?: string;
  errorCode?: string;
  errorCategory?: 'invalid_component_url' | 'missing_env' | 'permission_issue' | 'rate_limit' | 'network' | 'discord_api';
  retryAfterSeconds?: number;
  status?: number;
  discordErrorCode?: number;
}

interface DiscordApiErrorPayload {
  code?: number;
  message?: string;
  errors?: unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function responseSuggestsInvalidComponentUrl(errorPayload: DiscordApiErrorPayload, rawText: string): boolean {
  const haystack = `${errorPayload.message ?? ''} ${rawText}`.toLowerCase();
  return haystack.includes('components') && haystack.includes('url');
}

function classifyBotApiFailure(status: number, errorPayload: DiscordApiErrorPayload, rawText: string): Pick<WebhookSendResult, 'error' | 'errorCode' | 'errorCategory' | 'status' | 'discordErrorCode'> {
  const discordErrorCode = errorPayload.code;

  if (responseSuggestsInvalidComponentUrl(errorPayload, rawText)) {
    return {
      error: 'invalid component URL rejected by Discord',
      errorCode: 'invalid_component_url',
      errorCategory: 'invalid_component_url',
      status,
      discordErrorCode,
    };
  }

  if (status === 403 || discordErrorCode === 50001 || discordErrorCode === 50013) {
    return {
      error: 'Discord permission issue',
      errorCode: 'permission_issue',
      errorCategory: 'permission_issue',
      status,
      discordErrorCode,
    };
  }

  return {
    error: `Discord API error: ${status}`,
    errorCode: 'discord_api_error',
    errorCategory: 'discord_api',
    status,
    discordErrorCode,
  };
}

/**
 * ส่งข้อความผ่าน Discord Bot API เพื่อให้สามารถใช้ Components เช่น ปุ่ม (Buttons) ได้
 */
export async function sendDiscordBotMessage(
  channelId: string,
  payload: Record<string, unknown>,
  options: { dedupKey?: string } = {}
): Promise<WebhookSendResult> {
  // 1. ตรวจสอบการส่งซ้ำ
  if (options.dedupKey && isDuplicate(options.dedupKey)) {
    console.log(`[bot-send] Dedup hit for key=${options.dedupKey}`);
    return { success: true, error: 'duplicate_skipped' };
  }

  const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
  if (!botToken) {
    console.error('[bot-send] Missing DISCORD_BOT_TOKEN', { errorCode: 'missing_env', env: 'DISCORD_BOT_TOKEN' });
    return {
      success: false,
      error: 'bot_token_missing',
      errorCode: 'missing_env',
      errorCategory: 'missing_env',
    };
  }

  // 2. ตรวจสอบ Rate Limit
  const rateCheck = checkGlobalRate(`bot:channel:${channelId}`);
  if (!rateCheck.allowed) {
    const retryAfterSeconds = Math.ceil((rateCheck.retryAfterMs ?? 5000) / 1000);
    console.warn('[bot-send] Rate limit hit', { channelId, retryAfterSeconds, errorCode: 'rate_limit_hit' });
    return {
      success: false,
      error: 'rate_limit_hit',
      errorCode: 'rate_limit_hit',
      errorCategory: 'rate_limit',
      retryAfterSeconds,
    };
  }

  try {
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const rawText = await response.text();
      let errorPayload: DiscordApiErrorPayload = {};

      try {
        const parsed = JSON.parse(rawText) as unknown;
        if (isPlainObject(parsed)) {
          errorPayload = parsed as DiscordApiErrorPayload;
        }
      } catch {
        // ignore JSON parse failure; raw text logging below is enough
      }

      const classified = classifyBotApiFailure(response.status, errorPayload, rawText);
      console.error('[bot-send] Discord API error', {
        status: response.status,
        errorCode: classified.errorCode,
        errorCategory: classified.errorCategory,
        discordErrorCode: errorPayload.code ?? null,
        discordMessage: errorPayload.message ?? null,
        rawSnippet: rawText.slice(0, 300),
      });
      return { success: false, ...classified };
    }

    const data = await response.json();
    if (options.dedupKey) markSent(options.dedupKey);

    console.log(`[bot-send] Message sent via Bot, messageId=${data.id}`);
    return { success: true, messageId: data.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[bot-send] Network error', { errorCode: 'network_error', message });
    return {
      success: false,
      error: 'network_error',
      errorCode: 'network_error',
      errorCategory: 'network',
    };
  }
}

/**
 * ฟังก์ชันเดิมสำหรับส่งผ่าน Webhook URL (ยังคงไว้เผื่อส่วนอื่นเรียกใช้)
 */
export async function sendDiscordWebhook(
  webhookUrl: string,
  payload: Record<string, unknown>,
  options: { dedupKey?: string; rateBucketKey?: string } = {},
): Promise<WebhookSendResult> {
  const masked = maskUrl(webhookUrl);

  if (options.dedupKey && isDuplicate(options.dedupKey)) {
    return { success: true, error: 'duplicate_skipped' };
  }

  const bucketKey = options.rateBucketKey ?? masked;
  const rateCheck = checkGlobalRate(bucketKey);
  if (!rateCheck.allowed) {
    return { success: false, error: 'rate_limit_hit' };
  }

  try {
    const response = await fetch(`${webhookUrl}?wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return { success: false, error: `Discord error: ${response.status}` };
    }

    const data = await response.json();
    if (options.dedupKey) markSent(options.dedupKey);
    return { success: true, messageId: data.id };
  } catch (err) {
    console.error(`[webhook] Network error (${masked}):`, err);
    return { success: false, error: 'network_error' };
  }
}

// ── Helpers ──
function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/');
    if (parts.length >= 2) {
      const token = parts[parts.length - 1];
      return `${u.hostname}/...${token.slice(-6)}`;
    }
    return `${u.hostname}/***`;
  } catch {
    return '***masked***';
  }
}

function cleanExpired(store: Map<string, number>, ttl: number): void {
  const cutoff = Date.now() - ttl;
  for (const [key, ts] of store) {
    if (ts < cutoff) store.delete(key);
  }
}
