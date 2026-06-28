// services/auth-service/src/routes/user.routes.ts

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { UserController } from '../controllers/user.controller.js';
import { requirePermission } from '../middleware/permission.middleware.js';

export function createUserRouter(prisma: PrismaClient): Router {
  const router = Router();
  const userController = new UserController(prisma);

  router.get('/', requirePermission('user:manage'), userController.listUsers);
  router.post('/', requirePermission('user:manage'), userController.createUser);
  router.get('/:id', userController.getUser);
  router.patch('/:id', userController.updateUser);
  router.delete('/:id', requirePermission('user:manage'), userController.deactivateUser);
  router.patch('/:id/role', userController.changeRole);

  return router;
}
