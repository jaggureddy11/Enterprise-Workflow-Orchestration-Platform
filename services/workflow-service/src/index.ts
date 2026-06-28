// services/workflow-service/src/index.ts
// IMPORTANT: initTelemetry FIRST per PRD §16.1 rule 8

import { initTelemetry } from '@ewap/telemetry';
initTelemetry('workflow-service');

import express from 'express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import pino from 'pino';
import jwt from 'jsonwebtoken';
import { WorkflowController } from './controllers/workflow.controller';
import { InstanceController } from './controllers/instance.controller';
import { startTaskCompletedConsumer } from './consumers/task-completed.consumer';
import { isAppError } from '@ewap/shared';
import { metricsHandler } from '@ewap/telemetry';

const REQUIRED_ENV = ['DATABASE_URL', 'REDIS_URL', 'KAFKA_BROKERS', 'JWT_ACCESS_SECRET'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) { console.error(`[Workflow] Missing env var: ${key}`); process.exit(1); }
}

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL!);
const app: express.Application = express();

app.use(express.json());

// JWT auth middleware
app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    const xUserId = req.headers['x-user-id'];
    if (xUserId) {
      // Coming through API Gateway — trust the headers
      (req as any).user = {
        sub: req.headers['x-user-id'],
        tenantId: req.headers['x-tenant-id'],
        tenantSlug: req.headers['x-tenant-slug'],
        role: req.headers['x-user-role'],
        email: req.headers['x-user-email'],
      };
      return next();
    }
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }
  try {
    (req as any).user = jwt.verify(authHeader.substring(7), process.env.JWT_ACCESS_SECRET!);
    next();
  } catch {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
  }
});

const workflowController = new WorkflowController(prisma, redis);
const instanceController = new InstanceController(prisma);

// Routes per PRD §10.3
app.get('/workflows', workflowController.listWorkflows);
app.post('/workflows', workflowController.createWorkflow);
app.get('/workflows/:id', workflowController.getWorkflow);
app.put('/workflows/:id', workflowController.updateWorkflow);
app.delete('/workflows/:id', workflowController.deleteWorkflow);
app.post('/workflows/:id/publish', workflowController.publishWorkflow);
app.post('/workflows/:id/trigger', workflowController.triggerWorkflow);

app.get('/instances', instanceController.listInstances);
app.get('/instances/:id', instanceController.getInstance);
app.post('/instances/:id/cancel', instanceController.cancelInstance);
app.get('/instances/:id/timeline', instanceController.getTimeline);

app.get('/metrics', metricsHandler as any);
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'workflow-service' }));

app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (isAppError(err)) {
    res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
    return;
  }
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
});

const PORT = parseInt(process.env.PORT ?? '4002', 10);

async function start() {
  await prisma.$connect();
  await startTaskCompletedConsumer(prisma, redis);
  app.listen(PORT, () => logger.info(`[Workflow Service] Listening on port ${PORT}`));
}

start().catch(err => { logger.error(err); process.exit(1); });

export { app };
