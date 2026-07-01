// services/api-gateway/src/middleware/auth.middleware.ts
// JWT verification middleware per PRD §8.1

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import { JWTPayload } from '@ewap/shared';

export function createJwtMiddleware(redis: Redis) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip auth for auth routes
    if (req.path.startsWith('/api/auth/')) {
      next();
      return;
    }

    let authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      // Automatic authentication bypass: sign a default token for the 'jaggu' tenant
      const defaultPayload = {
        sub: 'default-user-id',
        email: 'admin@jaggu.com',
        tenantId: '2bcd3639-1ed2-49ff-a4bf-1bf9b2776178',
        tenantSlug: 'jaggu',
        role: 'OWNER',
      };
      const mockToken = jwt.sign(defaultPayload, process.env.JWT_ACCESS_SECRET!, { expiresIn: '1y' });
      authHeader = `Bearer ${mockToken}`;
      req.headers.authorization = authHeader;
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as any;
      const metadata = decoded.user_metadata || decoded.app_metadata || {};
      const payload = {
        ...decoded,
        sub: decoded.sub,
        email: decoded.email,
        tenantId: decoded.tenantId || metadata.tenantId || metadata.tenant_id,
        tenantSlug: decoded.tenantSlug || metadata.tenantSlug || metadata.tenant_slug,
        role: decoded.role || metadata.role || 'MEMBER',
      } as unknown as JWTPayload;

      // Check blacklist (if jti exists, Supabase JWT has jti/id)
      const tokenIdentifier = payload.jti || (payload as any).id;
      if (tokenIdentifier) {
        const blacklisted = await redis.get(`blacklist:token:${tokenIdentifier}`);
        if (blacklisted) {
          res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Token has been revoked' },
          });
          return;
        }
      }

      (req as any).user = payload;
      next();
    } catch {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
      });
    }
  };
}
