// services/workflow-service/src/controllers/instance.controller.ts
// Instance management endpoints per PRD §10.3

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { getTenantSchemaName, NotFoundError } from '@ewap/shared';

export class InstanceController {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  listInstances = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantSlug } = (req as any).user;
      const schemaName = getTenantSchemaName(tenantSlug);
      const { status, workflowId } = req.query;

      let query = `SELECT * FROM "${schemaName}".workflow_instances WHERE 1=1`;
      const params: unknown[] = [];

      if (status) {
        params.push(status);
        query += ` AND status = $${params.length}`;
      }
      if (workflowId) {
        params.push(workflowId);
        query += ` AND workflow_id = $${params.length}`;
      }
      query += ` ORDER BY created_at DESC LIMIT 50`;

      const instances = await this.prisma.$queryRawUnsafe<any[]>(query, ...params);

      res.json({ success: true, data: instances });
    } catch (error) { next(error); }
  };

  getInstance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantSlug } = (req as any).user;
      const schemaName = getTenantSchemaName(tenantSlug);
      const { id } = req.params;

      const [instance] = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "${schemaName}".workflow_instances WHERE id = $1`,
        id,
      );
      if (!instance) throw new NotFoundError('WorkflowInstance', id);

      res.json({ success: true, data: instance });
    } catch (error) { next(error); }
  };

  cancelInstance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantSlug } = (req as any).user;
      const schemaName = getTenantSchemaName(tenantSlug);
      const { id } = req.params;

      await this.prisma.$executeRawUnsafe(
        `UPDATE "${schemaName}".workflow_instances
         SET status = 'CANCELLED', updated_at = NOW()
         WHERE id = $1 AND status IN ('PENDING', 'RUNNING', 'PAUSED')`,
        id,
      );

      res.json({ success: true, data: { message: 'Instance cancelled' } });
    } catch (error) { next(error); }
  };

  getTimeline = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantSlug } = (req as any).user;
      const schemaName = getTenantSchemaName(tenantSlug);
      const { id } = req.params;

      const executions = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT ise.*, ws.name as step_name, ws.step_type, ws.step_order
         FROM "${schemaName}".instance_step_executions ise
         JOIN "${schemaName}".workflow_steps ws ON ws.id = ise.step_id
         WHERE ise.instance_id = $1
         ORDER BY ws.step_order ASC`,
        id,
      );

      res.json({ success: true, data: executions });
    } catch (error) { next(error); }
  };
}
