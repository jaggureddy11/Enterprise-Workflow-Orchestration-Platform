export interface RetryConfig {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
}
export declare const DEFAULT_RETRY_CONFIG: RetryConfig;
export declare function calculateBackoffDelay(attemptCount: number, config?: RetryConfig): number;
export declare function sleep(ms: number): Promise<void>;
export declare function withRetry<T>(fn: () => Promise<T>, config?: RetryConfig, onRetry?: (attempt: number, error: Error) => void): Promise<T>;
//# sourceMappingURL=retry.util.d.ts.map