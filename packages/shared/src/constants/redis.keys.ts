// packages/shared/src/constants/redis.keys.ts
// Redis key patterns and TTLs per PRD §7

export const REDIS_KEYS = {
  // Auth
  REFRESH_TOKEN_BLACKLIST: (jti: string) => `blacklist:token:${jti}`,
  USER_SESSION: (userId: string) => `session:user:${userId}`,

  // Rate Limiting (via express-rate-limit + rate-limit-redis)
  RATE_LIMIT: (tenantId: string, ip: string) => `ratelimit:${tenantId}:${ip}`,

  // Distributed Locks (Redlock pattern)
  TASK_LOCK: (taskId: string) => `lock:task:${taskId}`,
  WORKFLOW_INSTANCE_LOCK: (instanceId: string) => `lock:instance:${instanceId}`,
  STEP_EXECUTION_LOCK: (instanceId: string, stepId: string) =>
    `lock:step:${instanceId}:${stepId}`,

  // Caching
  WORKFLOW_DEF: (tenantId: string, workflowId: string) =>
    `cache:tenant:${tenantId}:workflow:${workflowId}`,
  TENANT_META: (tenantId: string) => `cache:tenant:${tenantId}:meta`,
  USER_PERMISSIONS: (userId: string) => `cache:user:${userId}:permissions`,

  // Pub/Sub channels
  INSTANCE_STATUS_CHANNEL: (instanceId: string) =>
    `pubsub:instance:${instanceId}:status`,
} as const;

// TTLs (seconds)
export const REDIS_TTL = {
  WORKFLOW_DEF: 300,      // 5 minutes
  TENANT_META: 600,       // 10 minutes
  USER_PERMISSIONS: 300,  // 5 minutes
  DISTRIBUTED_LOCK: 30,   // 30 seconds max lock hold
} as const;
