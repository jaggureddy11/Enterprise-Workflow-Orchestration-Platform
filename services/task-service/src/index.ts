// services/task-service/src/index.ts
import { initTelemetry } from '@ewap/telemetry';
initTelemetry('task-service');

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import pino from 'pino';
import jwt from 'jsonwebtoken';
import cron from 'node-cron';
import { TaskController } from './controllers/task.controller';
import { startTaskCreateConsumer } from './consumers/task-create.consumer';
import { TaskService } from './services/task.service';
import { isAppError } from '@ewap/shared';
import { metricsHandler } from '@ewap/telemetry';

const REQUIRED_ENV = ['DATABASE_URL', 'REDIS_URL', 'KAFKA_BROKERS'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) { console.error(`[Task Service] Missing env var: ${key}`); process.exit(1); }
}

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL!);
const app: express.Application = express();

app.use(express.json());

// Trust API Gateway headers or verify JWT directly
app.use((req, res, next) => {
  if (req.headers['x-user-id']) {
    (req as any).user = {
      sub: req.headers['x-user-id'],
      tenantId: req.headers['x-tenant-id'],
      tenantSlug: req.headers['x-tenant-slug'],
      role: req.headers['x-user-role'],
      email: req.headers['x-user-email'],
    };
    return next();
  }
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }
  try {
    const decoded = jwt.verify(authHeader.substring(7), process.env.JWT_ACCESS_SECRET!) as any;
    const metadata = decoded.user_metadata || decoded.app_metadata || {};
    (req as any).user = {
      ...decoded,
      sub: decoded.sub,
      email: decoded.email,
      tenantId: decoded.tenantId || metadata.tenantId || metadata.tenant_id,
      tenantSlug: decoded.tenantSlug || metadata.tenantSlug || metadata.tenant_slug,
      role: decoded.role || metadata.role || 'MEMBER',
    };
    next();
  } catch {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
  }
});

const taskController = new TaskController(prisma, redis);

// Routes per PRD §10.4
app.get('/tasks', taskController.listTasks);
app.get('/tasks/overdue', taskController.getOverdueTasks);
app.get('/tasks/:id', taskController.getTask);
app.post('/tasks/:id/complete', taskController.completeTask);
app.post('/tasks/:id/reject', taskController.rejectTask);
app.post('/tasks/:id/reassign', taskController.reassignTask);
app.post('/tasks/:id/comments', taskController.addComment);

app.get('/metrics', metricsHandler as any);
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'task-service' }));

app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (isAppError(err)) {
    res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
    return;
  }
  logger.error({ err });
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
});

const PORT = parseInt(process.env.PORT ?? '4003', 10);

async function start() {
  await prisma.$connect();
  await startTaskCreateConsumer(prisma);

  // SLA expiry scheduler — every 5 minutes per PRD §8.4
  const taskService = new TaskService(prisma, redis);
  cron.schedule('*/5 * * * *', async () => {
    const tenants = await prisma.tenant.findMany({ select: { slug: true, id: true } });
    for (const tenant of tenants) {
      await taskService.checkExpiredTasks(tenant.slug, tenant.id).catch(console.error);
    }
  });

  app.listen(PORT, () => logger.info(`[Task Service] Listening on port ${PORT}`));
}

start().catch(err => { logger.error(err); process.exit(1); });

export { app };
