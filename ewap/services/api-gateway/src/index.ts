// services/api-gateway/src/index.ts
// IMPORTANT: initTelemetry must be FIRST per PRD §16.1 rule 8

import { initTelemetry } from '@ewap/telemetry';
initTelemetry('api-gateway');

import express from 'express';
import Redis from 'ioredis';
import { correlationIdMiddleware, requestLoggerMiddleware } from './middleware/logger.middleware';
import { createJwtMiddleware } from './middleware/auth.middleware';
import { createRateLimiters } from './middleware/rate-limit.middleware';
import { tenantMiddleware } from './middleware/tenant.middleware';
import { createServiceProxyRouter } from './proxy/service.proxy';
import { metricsHandler } from '@ewap/telemetry';

// Validate env vars
const REQUIRED_ENV = ['JWT_ACCESS_SECRET', 'REDIS_URL'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[API Gateway] Missing required env var: ${key}`);
    process.exit(1);
  }
}

const redis = new Redis(process.env.REDIS_URL!);
const app: express.Application = express();

// Middleware chain per PRD §8.1 (in order):
// 1. correlationId
app.use(correlationIdMiddleware);
// 2. requestLogger
app.use(requestLoggerMiddleware);
// 3. rate limiter (IP tier)
const { ipLimiter, tenantLimiter, aiLimiter } = createRateLimiters(redis);
app.use(ipLimiter);
// 4. jwtVerifier
app.use(createJwtMiddleware(redis));
// 5. tenantExtractor
app.use(tenantMiddleware);
// 6. tenant rate limiter
app.use(tenantLimiter);
// 7. serviceProxy (with AI limiter passed in)
app.use(createServiceProxyRouter(aiLimiter));

// Metrics
app.get('/metrics', metricsHandler as any);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() });
});

const PORT = parseInt(process.env.PORT ?? '4000', 10);
app.listen(PORT, () => {
  console.log(`[API Gateway] Listening on port ${PORT}`);
});

export { app };
