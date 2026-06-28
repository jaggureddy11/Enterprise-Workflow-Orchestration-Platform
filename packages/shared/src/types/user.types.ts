// packages/shared/src/types/user.types.ts

export type UserRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  department?: string;
  managerId?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface JWTPayload {
  sub: string;        // userId
  tenantId: string;
  tenantSlug: string; // used for DB schema selection
  role: UserRole;
  email: string;
  jti: string;        // unique token ID (for blacklisting)
  iat: number;
  exp: number;
}

export interface Permission {
  id: string;
  name: string;    // e.g., 'workflow:create'
  resource: string;
  action: string;
  description?: string;
}

// RBAC permission matrix
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
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
