// services/auth-service/src/controllers/auth.controller.ts
// Auth controller per PRD §10.2

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.service.js';
import { ValidationError } from '@ewap/shared';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const RegisterTenantSchema = z.object({
  tenantName: z.string().min(2).max(255),
  tenantSlug: z.string().min(3).max(50).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
  ownerFirstName: z.string().min(1).max(100),
  ownerLastName: z.string().min(1).max(100),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().min(1),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// ─── Controller ───────────────────────────────────────────────────────────────

export class AuthController {
  private authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  registerTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = RegisterTenantSchema.safeParse(req.body);
      if (!input.success) {
        throw new ValidationError('Invalid registration data', input.error.flatten() as any);
      }

      const tokens = await this.authService.registerTenant(input.data);

      res.status(201).json({
        success: true,
        data: tokens,
        meta: { requestId: req.headers['x-correlation-id'], timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = LoginSchema.safeParse(req.body);
      if (!input.success) {
        throw new ValidationError('Invalid login data', input.error.flatten() as any);
      }

      const tokens = await this.authService.login(
        input.data.email,
        input.data.password,
        input.data.tenantSlug,
      );

      res.json({
        success: true,
        data: tokens,
        meta: { requestId: req.headers['x-correlation-id'], timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = RefreshSchema.safeParse(req.body);
      if (!input.success) {
        throw new ValidationError('refreshToken is required');
      }

      const tokens = await this.authService.refresh(input.data.refreshToken);

      res.json({
        success: true,
        data: tokens,
        meta: { requestId: req.headers['x-correlation-id'], timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        await this.authService.logout(authHeader.substring(7));
      }

      res.json({
        success: true,
        data: { message: 'Logged out successfully' },
        meta: { requestId: req.headers['x-correlation-id'], timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  };
}
