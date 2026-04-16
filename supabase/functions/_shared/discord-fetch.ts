/**
 * Shared utility for Discord API calls with automatic 429 rate-limit retry.
 * Use this instead of raw `fetch()` for all Discord API requests.
 */

export interface DiscordFetchOptions extends RequestInit {
  /** Max retries on 429 (default: 3) */
  maxRetries?: number;
}

export async function discordFetch(
  url: string,
  options: DiscordFetchOptions = {}
): Promise<Response> {
  const { maxRetries = 3, ...fetchOptions } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, fetchOptions);

    if (response.status === 429) {
      if (attempt >= maxRetries) {
        console.error(`[discordFetch] Rate limited after ${maxRetries} retries: ${url}`);
        return response;
      }

      const body = await response.json().catch(() => ({}));
      const retryAfterMs = ((body as Record<string, number>).retry_after ?? 1) * 1000;
      console.warn(
        `[discordFetch] 429 rate limited, retry ${attempt + 1}/${maxRetries} after ${retryAfterMs}ms`
      );
      await new Promise((r) => setTimeout(r, retryAfterMs));
      continue;
    }

    return response;
  }

  // Should never reach here, but TypeScript needs it
  throw new Error("[discordFetch] Unexpected: exceeded retry loop");
}
