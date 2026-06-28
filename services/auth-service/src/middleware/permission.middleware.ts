// services/auth-service/src/middleware/permission.middleware.ts
// Exportable RBAC middleware for use in other services per PRD §8.2

import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError, ROLE_PERMISSIONS, UserRole } from '@ewap/shared';

/**
 * Express middleware factory that checks if the authenticated user has the required permission.
 * 
 * Usage: router.post('/workflows', requirePermission('workflow:create'), handler)
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;

    if (!user) {
      next(new UnauthorizedError());
      return;
    }

    const role = user.role as UserRole;
    const permissions = ROLE_PERMISSIONS[role] ?? [];

    if (!permissions.includes(permission)) {
      next(new ForbiddenError(`Permission '${permission}' required`));
      return;
    }

    next();
  };
}

/**
 * Middleware factory that requires one of several roles.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;

    if (!user) {
      next(new UnauthorizedError());
      return;
    }

    if (!roles.includes(user.role as UserRole)) {
      next(new ForbiddenError(`One of roles [${roles.join(', ')}] required`));
      return;
    }

    next();
  };
}
