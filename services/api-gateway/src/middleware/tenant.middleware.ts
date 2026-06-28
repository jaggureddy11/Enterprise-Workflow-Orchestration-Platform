// services/api-gateway/src/middleware/tenant.middleware.ts
// Extract tenantId from JWT and set X-Tenant-ID header per PRD §8.1

import { Request, Response, NextFunction } from 'express';

export function tenantMiddleware(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (user?.tenantId) {
    req.headers['x-tenant-id'] = user.tenantId;
    req.headers['x-tenant-slug'] = user.tenantSlug;
    req.headers['x-user-id'] = user.sub;
    req.headers['x-user-role'] = user.role;
    req.headers['x-user-email'] = user.email;
  }
  next();
}
