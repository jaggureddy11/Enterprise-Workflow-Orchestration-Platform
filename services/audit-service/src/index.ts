// services/audit-service/src/index.ts
// Audit service — INSERT-ONLY, fan-out consumer per PRD §8.7

import { initTelemetry } from '@ewap/telemetry';
initTelemetry('audit-service');

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

// Auth middleware
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

// ─── Audit API — READ ONLY ────────────────────────────────────────────────────

app.get('/audit', async (req, res, next) => {
  try {
    const { tenantSlug } = (req as any).user ?? {};
    if (!tenantSlug) { res.status(401).json({ success: false }); return; }
    const schemaName = getTenantSchemaName(tenantSlug);
    const { eventType, actorId, resourceType, resourceId, limit = '20' } = req.query;

    let query = `SELECT * FROM "${schemaName}".audit_logs WHERE 1=1`;
    const params: unknown[] = [];

    if (eventType) { params.push(eventType); query += ` AND event_type = $${params.length}`; }
    if (actorId) { params.push(actorId); query += ` AND actor_id = $${params.length}`; }
    if (resourceType) { params.push(resourceType); query += ` AND resource_type = $${params.length}`; }
    if (resourceId) { params.push(resourceId); query += ` AND resource_id = $${params.length}`; }

    query += ` ORDER BY created_at DESC LIMIT ${Math.min(parseInt(limit as string, 10), 100)}`;

    const logs = await prisma.$queryRawUnsafe<any[]>(query, ...params);

    res.json({ success: true, data: logs });
  } catch (error) { next(error); }
});

app.get('/metrics', metricsHandler as any);
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'audit-service' }));

app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (isAppError(err)) {
    res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
    return;
  }
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
});

const PORT = parseInt(process.env.PORT ?? '4007', 10);

// All Kafka topics that the audit service subscribes to per PRD §8.7
const ALL_TOPICS = Object.values(KAFKA_TOPICS);

async function recordAuditLog(event: any, schemaName: string): Promise<void> {
  const payload = event.payload ?? {};

  // INSERT ONLY — audit.service NEVER updates or deletes per PRD §16.1 rule 3
  await prisma.$executeRawUnsafe(
    `INSERT INTO "${schemaName}".audit_logs
     (event_type, actor_id, actor_email, resource_type, resource_id, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
    event.eventType,
    payload.triggeredBy ?? payload.completedBy ?? payload.actorId ?? null,
    payload.actorEmail ?? null,
    guessResourceType(event.eventType),
    payload.instanceId ?? payload.taskId ?? payload.workflowId ?? null,
    JSON.stringify({
      eventId: event.eventId,
      correlationId: event.correlationId,
      ...payload,
    }),
  );
}

function guessResourceType(eventType: string): string {
  if (eventType.startsWith('workflow.instance')) return 'workflow_instance';
  if (eventType.startsWith('workflow.step')) return 'workflow_step';
  if (eventType.startsWith('task')) return 'task';
  if (eventType.startsWith('notification')) return 'notification';
  return 'system';
}

async function start() {
  await prisma.$connect();

  // Fan-out consumer: subscribes to ALL topics per PRD §8.7
  await createConsumer({
    groupId: KAFKA_CONSUMER_GROUPS.AUDIT_SERVICE,
    topics: ALL_TOPICS,
    onMessage: async (event) => {
      try {
        const tenantId = event.tenantId;
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) return;

        const schemaName = getTenantSchemaName(tenant.slug);
        await recordAuditLog(event, schemaName);

        kafkaEventsProcessed.inc({ topic: event.eventType, status: 'success', service: 'audit-service' });
      } catch (error) {
        logger.error({ error }, '[Audit] Failed to record audit log');
      }
    },
  });

  app.listen(PORT, () => logger.info(`[Audit Service] Listening on port ${PORT}`));
}

start().catch(err => { logger.error(err); process.exit(1); });

export { app };
