import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { AppError } from './error-handler.js';
import { ERROR_CODES, JWTPayload, JWTPayloadSchema } from '@ewap/shared';

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
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        401,
        'Missing or invalid authorization header'
      );
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    
    const payload = JWTPayloadSchema.parse(decoded);
    req.user = payload;
    req.tenantId = payload.tenantId;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        401,
        'Token expired'
      );
    }
    throw new AppError(
      ERROR_CODES.UNAUTHORIZED,
      401,
      'Invalid token'
    );
  }
}
