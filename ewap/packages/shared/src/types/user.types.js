export const ROLE_PERMISSIONS = {
    OWNER: [
        'workflow:create', 'workflow:read', 'workflow:publish', 'workflow:delete',
        'instance:trigger', 'instance:cancel',
        'task:complete',
        'audit:read',
        'analytics:read',
        'user:manage',
    ],
    ADMIN: [
        'workflow:create', 'workflow:read', 'workflow:publish', 'workflow:delete',
        'instance:trigger', 'instance:cancel',
        'task:complete',
        'audit:read',
        'analytics:read',
        'user:manage',
    ],
    MANAGER: [
        'workflow:read',
        'instance:trigger', 'instance:cancel',
        'task:complete',
        'analytics:read',
    ],
    MEMBER: [
        'workflow:read',
        'instance:trigger',
        'task:complete',
    ],
    VIEWER: [
        'workflow:read',
    ],
};
//# sourceMappingURL=user.types.js.map