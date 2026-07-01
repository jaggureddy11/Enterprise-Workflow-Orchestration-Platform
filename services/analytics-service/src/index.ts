// services/analytics-service/src/index.ts
import { initTelemetry } from '@ewap/telemetry';
initTelemetry('analytics-service');

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { createConsumer } from '@ewap/kafka-client';
import { KAFKA_TOPICS, KAFKA_CONSUMER_GROUPS, getTenantSchemaName } from '@ewap/shared';
import pino from 'pino';
import { isAppError } from '@ewap/shared';
import { metricsHandler, kafkaEventsProcessed } from '@ewap/telemetry';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const prisma = new PrismaClient();
const app: express.Application = express();
app.use(express.json());

// Auth middleware (trust gateway headers)
app.use((req, res, next) => {
  if (req.headers['x-user-id']) {
    (req as any).user = {
      sub: req.headers['x-user-id'],
      tenantId: req.headers['x-tenant-id'],
      tenantSlug: req.headers['x-tenant-slug'],
    };
  }
  next();
});

// ─── Analytics API ────────────────────────────────────────────────────────────

app.get('/analytics/overview', async (req, res, next) => {
  try {
    const { tenantSlug } = (req as any).user ?? {};
    if (!tenantSlug) { res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } }); return; }
    const schemaName = getTenantSchemaName(tenantSlug);

    const [overview] = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('PENDING', 'RUNNING', 'PAUSED')) as active_instances,
        COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_instances,
        COUNT(*) FILTER (WHERE status = 'FAILED') as failed_instances,
        COUNT(*) as total_instances,
        COUNT(*) FILTER (WHERE status = 'OPEN' AND due_at < NOW()) as overdue_tasks
      FROM "${schemaName}".workflow_instances wi
      CROSS JOIN (SELECT COUNT(*) FROM "${schemaName}".tasks WHERE status = 'OPEN' AND due_at < NOW()) t
    `);

    res.json({ success: true, data: overview });
  } catch (error) { next(error); }
});

app.get('/analytics/workflows/:id', async (req, res, next) => {
  try {
    const { tenantSlug } = (req as any).user ?? {};
    const schemaName = getTenantSchemaName(tenantSlug);
    const { id } = req.params;
    const period = (req.query.period as string) ?? '30d';

    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;

    const snapshots = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${schemaName}".analytics_snapshots
       WHERE workflow_id = $1::uuid AND snapshot_date >= NOW() - INTERVAL '${days} days'
       ORDER BY snapshot_date DESC`,
      id,
    );

    const [summary] = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         COUNT(*) as total_instances,
         COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_instances,
         COUNT(*) FILTER (WHERE status = 'FAILED') as failed_instances,
         AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000) as avg_duration_ms
       FROM "${schemaName}".workflow_instances
       WHERE workflow_id = $1::uuid AND created_at >= NOW() - INTERVAL '${days} days'`,
      id,
    );

    res.json({ success: true, data: { summary, dailyBreakdown: snapshots } });
  } catch (error) { next(error); }
});

app.get('/analytics/bottlenecks', async (req, res, next) => {
  try {
    const { tenantSlug } = (req as any).user ?? {};
    const schemaName = getTenantSchemaName(tenantSlug);

    const bottlenecks = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        ws.id, ws.name, ws.step_type,
        AVG(ise.duration_ms) as avg_duration_ms,
        COUNT(*) as execution_count,
        COUNT(*) FILTER (WHERE ise.status = 'COMPLETED') * 1.0 / COUNT(*) as completion_rate
      FROM "${schemaName}".instance_step_executions ise
      JOIN "${schemaName}".workflow_steps ws ON ws.id = ise.step_id
      WHERE ise.duration_ms IS NOT NULL
      GROUP BY ws.id, ws.name, ws.step_type
      ORDER BY avg_duration_ms DESC
      LIMIT 10
    `);

    res.json({ success: true, data: bottlenecks });
  } catch (error) { next(error); }
});

app.get('/metrics', metricsHandler as any);
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'analytics-service' }));

app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (isAppError(err)) {
    res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
    return;
  }
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
});

const PORT = parseInt(process.env.PORT ?? '4005', 10);

async function start() {
  await prisma.$connect();

  // Consume workflow events and update analytics_snapshots
  await createConsumer({
    groupId: KAFKA_CONSUMER_GROUPS.ANALYTICS_SERVICE,
    topics: [
      KAFKA_TOPICS.WORKFLOW_INSTANCE_COMPLETED,
      KAFKA_TOPICS.WORKFLOW_INSTANCE_FAILED,
      KAFKA_TOPICS.WORKFLOW_INSTANCE_STARTED,
    ],
    onMessage: async (event) => {
      const tenantId = event.tenantId;
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) return;

      const schemaName = getTenantSchemaName(tenant.slug);
      const today = new Date().toISOString().split('T')[0];

      if (event.eventType === 'workflow.instance.completed' || event.eventType === 'workflow.instance.failed') {
        const payload = event.payload as any;
        const isCompleted = event.eventType === 'workflow.instance.completed';

        // Upsert analytics snapshot for today
        await prisma.$executeRawUnsafe(`
          INSERT INTO "${schemaName}".analytics_snapshots (workflow_id, snapshot_date, total_instances, completed_instances, failed_instances)
          VALUES ($1::uuid, $2::date, 1, $3, $4)
          ON CONFLICT (workflow_id, snapshot_date) DO UPDATE SET
            total_instances = analytics_snapshots.total_instances + 1,
            completed_instances = analytics_snapshots.completed_instances + $3,
            failed_instances = analytics_snapshots.failed_instances + $4
        `,
          payload.workflowId,
          today,
          isCompleted ? 1 : 0,
          isCompleted ? 0 : 1,
        );
      }

      kafkaEventsProcessed.inc({ topic: event.eventType, status: 'success', service: 'analytics-service' });
    },
  });

  app.listen(PORT, () => logger.info(`[Analytics Service] Listening on port ${PORT}`));
}

start().catch(err => { logger.error(err); process.exit(1); });

export { app };
