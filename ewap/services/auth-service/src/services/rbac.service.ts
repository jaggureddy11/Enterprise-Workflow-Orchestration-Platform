// services/auth-service/src/services/rbac.service.ts
// RBAC permission checking per PRD §8.2

import { ROLE_PERMISSIONS, UserRole } from '@ewap/shared';
import Redis from 'ioredis';
import { REDIS_KEYS, REDIS_TTL } from '@ewap/shared';

export class RbacService {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Checks if a role has a specific permission.
   */
  hasPermission(role: UserRole, permission: string): boolean {
    const permissions = ROLE_PERMISSIONS[role];
    return permissions.includes(permission);
  }

  /**
   * Gets all permissions for a role, with Redis caching.
   */
  async getPermissions(userId: string, role: UserRole): Promise<string[]> {
    const cacheKey = REDIS_KEYS.USER_PERMISSIONS(userId);
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as string[];

    const permissions = ROLE_PERMISSIONS[role] ?? [];
    await this.redis.set(cacheKey, JSON.stringify(permissions), 'EX', REDIS_TTL.USER_PERMISSIONS);

    return permissions;
  }

  /**
   * Invalidates the permissions cache for a user.
   * Call this when a user's role changes.
   */
  async invalidatePermissionsCache(userId: string): Promise<void> {
    await this.redis.del(REDIS_KEYS.USER_PERMISSIONS(userId));
  }
}
