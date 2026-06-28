// services/workflow-service/src/controllers/workflow.controller.ts
// All workflow endpoints per PRD §10.3

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import {
  getTenantSchemaName,
  NotFoundError,
  ValidationError,
  ConflictError,
  REDIS_KEYS,
  REDIS_TTL,
} from '@ewap/shared';
import { WorkflowStateMachine } from '../engine/state-machine';

const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  triggerType: z.enum(['MANUAL', 'SCHEDULED', 'WEBHOOK', 'EVENT']),
  triggerConfig: z.record(z.unknown()).default({}),
  definition: z.object({
    steps: z.array(z.object({
      name: z.string(),
      type: z.enum(['TASK', 'NOTIFICATION', 'CONDITION', 'DELAY', 'WEBHOOK', 'AI_ACTION']),
      order: z.number().int().positive(),
      config: z.record(z.unknown()),
      isTerminal: z.boolean().optional().default(false),
    })),
  }),
});

export class WorkflowController {
  private prisma: PrismaClient;
  private redis: Redis;

  constructor(prisma: PrismaClient, redis: Redis) {
    this.prisma = prisma;
    this.redis = redis;
  }

  listWorkflows = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantSlug, tenantId } = (req as any).user;
      const schemaName = getTenantSchemaName(tenantSlug);

      const workflows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "${schemaName}".workflows ORDER BY created_at DESC LIMIT 50`,
      );

      res.json({ success: true, data: workflows });
    } catch (error) { next(error); }
  };

  createWorkflow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantSlug, sub: userId } = (req as any).user;
      const schemaName = getTenantSchemaName(tenantSlug);

      const input = CreateWorkflowSchema.safeParse(req.body);
      if (!input.success) throw new ValidationError('Invalid workflow data', input.error.flatten() as any);

      const [workflow] = await this.prisma.$queryRawUnsafe<any[]>(
        `INSERT INTO "${schemaName}".workflows (name, description, trigger_type, trigger_config, definition, created_by)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6) RETURNING *`,
        input.data.name,
        input.data.description ?? null,
        input.data.triggerType,
        JSON.stringify(input.data.triggerConfig),
        JSON.stringify(input.data.definition),
        userId,
      );

      // Create workflow_steps rows
      for (const step of input.data.definition.steps) {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO "${schemaName}".workflow_steps (workflow_id, step_order, name, step_type, config, is_terminal)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
          workflow.id,
          step.order,
          step.name,
          step.type,
          JSON.stringify(step.config),
          step.isTerminal ?? false,
        );
      }

      res.status(201).json({ success: true, data: workflow });
    } catch (error) { next(error); }
  };

  getWorkflow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantSlug, tenantId } = (req as any).user;
      const schemaName = getTenantSchemaName(tenantSlug);
      const { id } = req.params;

      // Try cache first per PRD §9.5
      const cacheKey = REDIS_KEYS.WORKFLOW_DEF(tenantId, id);
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        res.json({ success: true, data: JSON.parse(cached) });
        return;
      }

      const [workflow] = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT w.*, json_agg(s ORDER BY s.step_order) as steps
         FROM "${schemaName}".workflows w
         LEFT JOIN "${schemaName}".workflow_steps s ON s.workflow_id = w.id
         WHERE w.id = $1 GROUP BY w.id`,
        id,
      );

      if (!workflow) throw new NotFoundError('Workflow', id);

      await this.redis.set(cacheKey, JSON.stringify(workflow), 'EX', REDIS_TTL.WORKFLOW_DEF);

      res.json({ success: true, data: workflow });
    } catch (error) { next(error); }
  };

  updateWorkflow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantSlug, tenantId, sub: userId } = (req as any).user;
      const schemaName = getTenantSchemaName(tenantSlug);
      const { id } = req.params;

      const [existing] = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id, status FROM "${schemaName}".workflows WHERE id = $1`,
        id,
      );
      if (!existing) throw new NotFoundError('Workflow', id);
      if (existing.status !== 'DRAFT') throw new ConflictError('Only DRAFT workflows can be updated');

      const [updated] = await this.prisma.$queryRawUnsafe<any[]>(
        `UPDATE "${schemaName}".workflows
         SET name = COALESCE($1, name),
             description = COALESCE($2, description),
             updated_by = $3, updated_at = NOW()
         WHERE id = $4 RETURNING *`,
        req.body.name ?? null,
        req.body.description ?? null,
        userId,
        id,
      );

      // Invalidate cache
      await this.redis.del(REDIS_KEYS.WORKFLOW_DEF(tenantId, id));

      res.json({ success: true, data: updated });
    } catch (error) { next(error); }
  };

  publishWorkflow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantSlug, tenantId, sub: userId } = (req as any).user;
      const schemaName = getTenantSchemaName(tenantSlug);
      const { id } = req.params;

      const [updated] = await this.prisma.$queryRawUnsafe<any[]>(
        `UPDATE "${schemaName}".workflows SET status = 'ACTIVE', updated_by = $1, updated_at = NOW()
         WHERE id = $2 AND status = 'DRAFT' RETURNING *`,
        userId,
        id,
      );

      if (!updated) throw new ConflictError('Workflow not found or already published');

      await this.redis.del(REDIS_KEYS.WORKFLOW_DEF(tenantId, id));

      res.json({ success: true, data: updated });
    } catch (error) { next(error); }
  };

  deleteWorkflow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantSlug, tenantId } = (req as any).user;
      const schemaName = getTenantSchemaName(tenantSlug);
      const { id } = req.params;

      await this.prisma.$executeRawUnsafe(
        `UPDATE "${schemaName}".workflows SET status = 'ARCHIVED', updated_at = NOW() WHERE id = $1`,
        id,
      );

      await this.redis.del(REDIS_KEYS.WORKFLOW_DEF(tenantId, id));

      res.json({ success: true, data: { message: 'Workflow archived' } });
    } catch (error) { next(error); }
  };

  triggerWorkflow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantSlug, tenantId, sub: userId } = (req as any).user;
      const schemaName = getTenantSchemaName(tenantSlug);
      const { id } = req.params;

      const [workflow] = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "${schemaName}".workflows WHERE id = $1 AND status = 'ACTIVE'`,
        id,
      );
      if (!workflow) throw new NotFoundError('Active Workflow', id);

      // Create instance in PENDING state
      const [instance] = await this.prisma.$queryRawUnsafe<any[]>(
        `INSERT INTO "${schemaName}".workflow_instances
         (workflow_id, workflow_version, status, triggered_by, trigger_data, context)
         VALUES ($1, $2, 'PENDING', $3, $4::jsonb, $5::jsonb) RETURNING *`,
        workflow.id,
        workflow.version,
        userId,
        JSON.stringify(req.body.triggerData ?? {}),
        JSON.stringify(req.body.context ?? {}),
      );

      // Start the state machine
      const stateMachine = new WorkflowStateMachine(this.prisma, this.redis, tenantSlug, schemaName);
      await stateMachine.start(instance.id, tenantId);

      res.status(201).json({ success: true, data: { instanceId: instance.id, status: 'RUNNING' } });
    } catch (error) { next(error); }
  };
}
