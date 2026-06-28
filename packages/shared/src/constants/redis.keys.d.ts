export declare const REDIS_KEYS: {
    readonly REFRESH_TOKEN_BLACKLIST: (jti: string) => string;
    readonly USER_SESSION: (userId: string) => string;
    readonly RATE_LIMIT: (tenantId: string, ip: string) => string;
    readonly TASK_LOCK: (taskId: string) => string;
    readonly WORKFLOW_INSTANCE_LOCK: (instanceId: string) => string;
    readonly STEP_EXECUTION_LOCK: (instanceId: string, stepId: string) => string;
    readonly WORKFLOW_DEF: (tenantId: string, workflowId: string) => string;
    readonly TENANT_META: (tenantId: string) => string;
    readonly USER_PERMISSIONS: (userId: string) => string;
    readonly INSTANCE_STATUS_CHANNEL: (instanceId: string) => string;
};
export declare const REDIS_TTL: {
    readonly WORKFLOW_DEF: 300;
    readonly TENANT_META: 600;
    readonly USER_PERMISSIONS: 300;
    readonly DISTRIBUTED_LOCK: 30;
};
//# sourceMappingURL=redis.keys.d.ts.map