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
    sub: string;
    tenantId: string;
    tenantSlug: string;
    role: UserRole;
    email: string;
    jti: string;
    iat: number;
    exp: number;
}
export interface Permission {
    id: string;
    name: string;
    resource: string;
    action: string;
    description?: string;
}
export declare const ROLE_PERMISSIONS: Record<UserRole, string[]>;
//# sourceMappingURL=user.types.d.ts.map