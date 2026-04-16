/**
 * Retry a function with exponential backoff.
 * Returns the result on success, or throws after all retries fail.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: { retries?: number; baseDelay?: number }
): Promise<T> {
  const { retries = 3, baseDelay = 1000 } = options || {};
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        console.warn(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      }
    }
  }

  throw lastError;
}
