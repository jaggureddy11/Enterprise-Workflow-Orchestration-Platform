export const REDIS_KEYS = {
    REFRESH_TOKEN_BLACKLIST: (jti) => `blacklist:token:${jti}`,
    USER_SESSION: (userId) => `session:user:${userId}`,
    RATE_LIMIT: (tenantId, ip) => `ratelimit:${tenantId}:${ip}`,
    TASK_LOCK: (taskId) => `lock:task:${taskId}`,
    WORKFLOW_INSTANCE_LOCK: (instanceId) => `lock:instance:${instanceId}`,
    STEP_EXECUTION_LOCK: (instanceId, stepId) => `lock:step:${instanceId}:${stepId}`,
    WORKFLOW_DEF: (tenantId, workflowId) => `cache:tenant:${tenantId}:workflow:${workflowId}`,
    TENANT_META: (tenantId) => `cache:tenant:${tenantId}:meta`,
    USER_PERMISSIONS: (userId) => `cache:user:${userId}:permissions`,
    INSTANCE_STATUS_CHANNEL: (instanceId) => `pubsub:instance:${instanceId}:status`,
};
export const REDIS_TTL = {
    WORKFLOW_DEF: 300,
    TENANT_META: 600,
    USER_PERMISSIONS: 300,
    DISTRIBUTED_LOCK: 30,
};
//# sourceMappingURL=redis.keys.js.map