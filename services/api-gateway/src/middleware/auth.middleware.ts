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

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Bearer token required' },
      });
      return;
    }

    const token = authHeader.substring(7);

    try {
      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as JWTPayload;

      // Check blacklist
      const blacklisted = await redis.get(`blacklist:token:${payload.jti}`);
      if (blacklisted) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Token has been revoked' },
        });
        return;
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
