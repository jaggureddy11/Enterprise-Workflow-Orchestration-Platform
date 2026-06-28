// services/auth-service/src/routes/auth.routes.ts

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';

export function createAuthRouter(prisma: PrismaClient, redis: Redis): Router {
  const router = Router();
  const authService = new AuthService(prisma, redis);
  const authController = new AuthController(authService);

  router.post('/register-tenant', authController.registerTenant);
  router.post('/login', authController.login);
  router.post('/refresh', authController.refresh);
  router.post('/logout', authController.logout);

  return router;
}
