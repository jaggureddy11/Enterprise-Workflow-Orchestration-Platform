export const DEFAULT_RETRY_CONFIG = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
};
export function calculateBackoffDelay(attemptCount, config = DEFAULT_RETRY_CONFIG) {
    return Math.min(config.baseDelayMs * Math.pow(2, attemptCount), config.maxDelayMs);
}
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
export async function withRetry(fn, config = DEFAULT_RETRY_CONFIG, onRetry) {
    let lastError;
    for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < config.maxAttempts - 1) {
                const delay = calculateBackoffDelay(attempt, config);
                onRetry?.(attempt + 1, lastError);
                await sleep(delay);
            }
        }
    }
    throw lastError;
}
//# sourceMappingURL=retry.util.js.map