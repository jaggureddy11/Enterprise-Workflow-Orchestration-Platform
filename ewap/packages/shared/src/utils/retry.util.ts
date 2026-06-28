// packages/shared/src/utils/retry.util.ts
// Exponential backoff retry utility

export interface RetryConfig {
  maxAttempts: number;  // default 3
  baseDelayMs: number;  // default 1000
  maxDelayMs: number;   // default 30000
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

/**
 * Calculates the delay for a given attempt using exponential backoff.
 * Attempt 0 → baseDelayMs, Attempt 1 → 2*base, Attempt 2 → 4*base, etc.
 * Capped at maxDelayMs.
 */
export function calculateBackoffDelay(
  attemptCount: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): number {
  return Math.min(
    config.baseDelayMs * Math.pow(2, attemptCount),
    config.maxDelayMs,
  );
}

/**
 * Sleeps for the given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retries an async function with exponential backoff.
 * Throws the last error if all attempts fail.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onRetry?: (attempt: number, error: Error) => void,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < config.maxAttempts - 1) {
        const delay = calculateBackoffDelay(attempt, config);
        onRetry?.(attempt + 1, lastError);
        await sleep(delay);
      }
    }
  }

  throw lastError!;
}
