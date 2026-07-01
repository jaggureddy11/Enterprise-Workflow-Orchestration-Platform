// services/auth-service/src/controllers/user.controller.ts
// User CRUD per PRD §10.2

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { getTenantSchemaName, ForbiddenError, NotFoundError, ValidationError } from '@ewap/shared';

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum(['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER']).default('MEMBER'),
  department: z.string().max(100).optional(),
  managerId: z.string().uuid().optional(),
});

const UpdateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  department: z.string().max(100).optional(),
  managerId: z.string().uuid().optional().nullable(),
});

const ChangeRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER']),
});

export class UserController {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantSlug } = (req as any).user;
      const schemaName = getTenantSchemaName(tenantSlug);

      const users = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id, email, first_name, last_name, role, department, manager_id, is_active, last_login_at, created_at
         FROM "${schemaName}".users ORDER BY created_at DESC`,
      );

      res.json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  };

  createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantSlug } = (req as any).user;
      const schemaName = getTenantSchemaName(tenantSlug);

      const input = CreateUserSchema.safeParse(req.body);
      if (!input.success) throw new ValidationError('Invalid user data', input.error.flatten() as any);

      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(input.data.password, 12);

      const [user] = await this.prisma.$queryRawUnsafe<any[]>(
        `INSERT INTO "${schemaName}".users (email, password_hash, first_name, last_name, role, department, manager_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7::uuid) RETURNING id, email, first_name, last_name, role, created_at`,
        input.data.email,
        passwordHash,
        input.data.firstName,
        input.data.lastName,
        input.data.role,
        input.data.department ?? null,
        input.data.managerId ?? null,
      );

      res.status(201).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  };

  getUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantSlug } = (req as any).user;
      const schemaName = getTenantSchemaName(tenantSlug);
      const { id } = req.params;

      const [user] = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id, email, first_name, last_name, role, department, manager_id, is_active, created_at
         FROM "${schemaName}".users WHERE id = $1::uuid`,
        id,
      );

      if (!user) throw new NotFoundError('User', id);

      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  };

  updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantSlug, sub: requesterId } = (req as any).user;
      const schemaName = getTenantSchemaName(tenantSlug);
      const { id } = req.params;

      const input = UpdateUserSchema.safeParse(req.body);
      if (!input.success) throw new ValidationError('Invalid update data', input.error.flatten() as any);

      const [updated] = await this.prisma.$queryRawUnsafe<any[]>(
        `UPDATE "${schemaName}".users
         SET first_name = COALESCE($1, first_name),
             last_name = COALESCE($2, last_name),
             department = COALESCE($3, department),
             updated_at = NOW()
         WHERE id = $4::uuid
         RETURNING id, email, first_name, last_name, role, department`,
        input.data.firstName ?? null,
        input.data.lastName ?? null,
        input.data.department ?? null,
        id,
      );

      if (!updated) throw new NotFoundError('User', id);

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  };

  deactivateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantSlug } = (req as any).user;
      const schemaName = getTenantSchemaName(tenantSlug);
      const { id } = req.params;

      await this.prisma.$executeRawUnsafe(
        `UPDATE "${schemaName}".users SET is_active = FALSE, updated_at = NOW() WHERE id = $1::uuid`,
        id,
      );

      res.json({ success: true, data: { message: 'User deactivated' } });
    } catch (error) {
      next(error);
    }
  };

  changeRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantSlug, role: requesterRole } = (req as any).user;
      if (requesterRole !== 'OWNER') throw new ForbiddenError('Only OWNER can change roles');

      const schemaName = getTenantSchemaName(tenantSlug);
      const { id } = req.params;

      const input = ChangeRoleSchema.safeParse(req.body);
      if (!input.success) throw new ValidationError('Invalid role');

      await this.prisma.$executeRawUnsafe(
        `UPDATE "${schemaName}".users SET role = $1, updated_at = NOW() WHERE id = $2::uuid`,
        input.data.role,
        id,
      );

      res.json({ success: true, data: { message: 'Role updated' } });
    } catch (error) {
      next(error);
    }
  };
}
