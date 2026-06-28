// services/auth-service/src/index.ts
// IMPORTANT: initTelemetry must be the FIRST call per PRD §16.1 rule 8

import { initTelemetry } from '@ewap/telemetry';
initTelemetry('auth-service');

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import pino from 'pino';
import jwt from 'jsonwebtoken';
import { createAuthRouter } from './routes/auth.routes.js';
import { createUserRouter } from './routes/user.routes.js';
import { isAppError } from '@ewap/shared';
import { metricsHandler } from '@ewap/telemetry';

// Validate required env vars at startup per PRD §16.1 rule 10
const REQUIRED_ENV = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[Auth Service] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL!);

const app: express.Application = express();

app.use(express.json());

// Correlation ID passthrough
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] as string ?? `auth-${Date.now()}`;
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
});

// JWT auth middleware (for /users routes)
app.use('/users', (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }

  try {
    const payload = jwt.verify(authHeader.substring(7), process.env.JWT_ACCESS_SECRET!);
    (req as any).user = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
  }
});

// Routes
app.use('/auth', createAuthRouter(prisma, redis));
app.use('/users', createUserRouter(prisma));

// Metrics endpoint
app.get('/metrics', metricsHandler as any);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'auth-service', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (isAppError(err)) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  });
});

const PORT = parseInt(process.env.PORT ?? '4001', 10);

async function start() {
  await prisma.$connect();
  logger.info('[Auth Service] Database connected');

  app.listen(PORT, () => {
    logger.info(`[Auth Service] Listening on port ${PORT}`);
  });
}

start().catch(err => {
  logger.error(err, '[Auth Service] Failed to start');
  process.exit(1);
});

export { app };
