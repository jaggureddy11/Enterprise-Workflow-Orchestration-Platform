// services/api-gateway/src/middleware/tenant.middleware.ts
// Extract tenantId from JWT and set X-Tenant-ID header per PRD §8.1

import { Request, Response, NextFunction } from 'express';

export function tenantMiddleware(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (user) {
    const metadata = user.user_metadata || user.app_metadata || {};
    const tenantId = user.tenantId || metadata.tenantId || metadata.tenant_id;
    const tenantSlug = user.tenantSlug || metadata.tenantSlug || metadata.tenant_slug;
    const role = user.role || metadata.role || 'MEMBER';

    if (tenantId) {
      req.headers['x-tenant-id'] = tenantId;
    }
    if (tenantSlug) {
      req.headers['x-tenant-slug'] = tenantSlug;
    }
    req.headers['x-user-id'] = user.sub;
    req.headers['x-user-role'] = role;
    req.headers['x-user-email'] = user.email;
  }
  next();
}
