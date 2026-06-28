import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError, JWTPayload } from '@ewap/shared';

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      tenantId?: string;
    }
  }
}

export function verifyJWT(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!);
    
    const payload = decoded as unknown as JWTPayload;
    req.user = payload;
    req.tenantId = payload.tenantId;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token expired');
    }
    throw new UnauthorizedError('Invalid token');
  }
}
