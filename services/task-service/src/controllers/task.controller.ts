// services/task-service/src/controllers/task.controller.ts
// All task endpoints per PRD §10.4

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { getTenantSchemaName, NotFoundError, ValidationError } from '@ewap/shared';
import { TaskService } from '../services/task.service';

const CompleteTaskSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED', 'COMPLETED']),
  formData: z.record(z.unknown()).default({}),
  comments: z.string().optional(),
});

export class TaskController {
  private prisma: PrismaClient;
  private taskService: TaskService;

  constructor(prisma: PrismaClient, redis: Redis) {
    this.prisma = prisma;
    this.taskService = new TaskService(prisma, redis);
  }

  listTasks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantSlug, sub: userId } = (req as any).user;
      const schemaName = getTenantSchemaName(tenantSlug);
      const { assignee, status, instanceId } = req.query;

      let query = `SELECT t.*, u.email as assignee_email FROM "${schemaName}".tasks t
                   LEFT JOIN "${schemaName}".users u ON u.id = t.assignee_id WHERE 1=1`;
      const params: unknown[] = [];

      if (assignee === 'me') {
        params.push(userId);
        query += ` AND t.assignee_id = $${params.length}`;
      }
      if (status) {
        params.push(status);
        query += ` AND t.status = $${params.length}`;
      }
      if (instanceId) {
        params.push(instanceId);
        query += ` AND t.instance_id = $${params.length}`;
      }
      query += ` ORDER BY t.created_at DESC LIMIT 50`;

      const tasks = await this.prisma.$queryRawUnsafe<any[]>(query, ...params);

      res.json({ success: true, data: tasks });
    } catch (error) { next(error); }
  };

  getTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantSlug } = (req as any).user;
      const schemaName = getTenantSchemaName(tenantSlug);
      const { id } = req.params;

      const [task] = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "${schemaName}".tasks WHERE id = $1`,
        id,
      );
      if (!task) throw new NotFoundError('Task', id);

      res.json({ success: true, data: task });
    } catch (error) { next(error); }
  };

  completeTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantSlug, tenantId, sub: userId } = (req as any).user;
      const { id: taskId } = req.params;

      const input = CompleteTaskSchema.safeParse(req.body);
      if (!input.success) throw new ValidationError('Invalid completion data', input.error.flatten() as any);

      await this.taskService.completeTask(
        { taskId, userId, decision: input.data.decision, formData: input.data.formData },
        tenantId,
        tenantSlug,
      );

      res.json({ success: true, data: { message: 'Task completed' } });
    } catch (error) { next(error); }
  };

  rejectTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantSlug, tenantId, sub: userId } = (req as any).user;
      const { id: taskId } = req.params;

      await this.taskService.completeTask(
        { taskId, userId, decision: 'REJECTED', formData: { reason: req.body.reason ?? '' } },
        tenantId,
        tenantSlug,
      );

      res.json({ success: true, data: { message: 'Task rejected' } });
    } catch (error) { next(error); }
  };

  reassignTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantSlug } = (req as any).user;
      const schemaName = getTenantSchemaName(tenantSlug);
      const { id } = req.params;
      const { assigneeId } = req.body;

      await this.prisma.$executeRawUnsafe(
        `UPDATE "${schemaName}".tasks SET assignee_id = $1, updated_at = NOW() WHERE id = $2`,
        assigneeId,
        id,
      );

      res.json({ success: true, data: { message: 'Task reassigned' } });
    } catch (error) { next(error); }
  };

  addComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantSlug, sub: userId, email } = (req as any).user;
      const schemaName = getTenantSchemaName(tenantSlug);
      const { id } = req.params;
      const { content } = req.body;

      const comment = {
        id: crypto.randomUUID(),
        authorId: userId,
        authorEmail: email,
        content,
        createdAt: new Date().toISOString(),
      };

      await this.prisma.$executeRawUnsafe(
        `UPDATE "${schemaName}".tasks
         SET comments = comments || $1::jsonb, updated_at = NOW() WHERE id = $2`,
        JSON.stringify([comment]),
        id,
      );

      res.status(201).json({ success: true, data: comment });
    } catch (error) { next(error); }
  };

  getOverdueTasks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantSlug } = (req as any).user;
      const schemaName = getTenantSchemaName(tenantSlug);

      const tasks = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "${schemaName}".tasks WHERE status = 'OPEN' AND due_at < NOW() ORDER BY due_at ASC LIMIT 50`,
      );

      res.json({ success: true, data: tasks });
    } catch (error) { next(error); }
  };
}
