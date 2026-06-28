// services/api-gateway/src/middleware/rate-limit.middleware.ts
// Two-tier rate limiting per PRD §9.6

import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';

export function createRateLimiters(redis: Redis) {
  // Tenant-tier: 1000 requests/minute per tenant
  const tenantLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
    max: 1000,
    keyGenerator: (req) => {
      const user = (req as any).user;
      return user?.tenantId ?? req.ip ?? 'unknown';
    },
    store: new RedisStore({
      sendCommand: (...args: string[]) => (redis as any).call(...args),
    }),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Limit: 1000/minute per tenant.',
        retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10) / 1000),
      });
    },
    skip: (req) => req.path.startsWith('/api/auth/'),
  });

  // IP-tier: 100 requests/minute per IP
  const ipLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '100', 10),
    keyGenerator: (req) => req.ip ?? 'unknown',
    store: new RedisStore({
      sendCommand: (...args: string[]) => (redis as any).call(...args),
    }),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Limit: 100/minute per IP.',
        retryAfter: 60,
      });
    },
  });

  // AI endpoint-specific: 20 requests/minute per user
  const aiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
    max: parseInt(process.env.AI_RATE_LIMIT_MAX ?? '20', 10),
    keyGenerator: (req) => {
      const user = (req as any).user;
      return user?.sub ?? req.ip ?? 'unknown';
    },
    store: new RedisStore({
      sendCommand: (...args: string[]) => (redis as any).call(...args),
    }),
    handler: (req, res) => {
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'AI endpoint limit: 20 requests/minute per user.',
        retryAfter: 60,
      });
    },
  });

  return { tenantLimiter, ipLimiter, aiLimiter };
}
