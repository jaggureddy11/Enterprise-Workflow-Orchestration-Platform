// services/api-gateway/src/proxy/service.proxy.ts
// HTTP proxy routing to downstream services per PRD §8.1

import { Request, Response, NextFunction, Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const SERVICE_URLS = {
  auth: process.env.AUTH_SERVICE_URL ?? 'http://localhost:4001',
  workflow: process.env.WORKFLOW_SERVICE_URL ?? 'http://localhost:4002',
  task: process.env.TASK_SERVICE_URL ?? 'http://localhost:4003',
  notification: process.env.NOTIFICATION_SERVICE_URL ?? 'http://localhost:4004',
  analytics: process.env.ANALYTICS_SERVICE_URL ?? 'http://localhost:4005',
  ai: process.env.AI_SERVICE_URL ?? 'http://localhost:4006',
  audit: process.env.AUDIT_SERVICE_URL ?? 'http://localhost:4007',
};

function createProxy(target: string, pathRewrite?: Record<string, string>) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite,
    on: {
      error: (err: Error, req, res) => {
        console.error(`[Gateway] Proxy error to ${target}:`, err.message);
        const response = res as any;
        if (response && !response.headersSent && typeof response.status === 'function') {
          response.status(502).json({
            success: false,
            error: { code: 'BAD_GATEWAY', message: 'Upstream service unavailable' },
          });
        } else if (response && !response.headersSent && typeof response.writeHead === 'function') {
          response.writeHead(502, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({
            success: false,
            error: { code: 'BAD_GATEWAY', message: 'Upstream service unavailable' },
          }));
        }
      },
    },
  });
}

export function createServiceProxyRouter(aiLimiter: any): Router {
  const router = Router();

  // /api/auth/* → auth-service:4001
  router.use('/api/auth', createProxy(SERVICE_URLS.auth, { '^/api/auth': '/auth' }));

  // /api/users/* → auth-service:4001
  router.use('/api/users', createProxy(SERVICE_URLS.auth, { '^/api/users': '/users' }));

  // /api/workflows/* → workflow-service:4002
  router.use('/api/workflows', createProxy(SERVICE_URLS.workflow, { '^/api/workflows': '/workflows' }));

  // /api/instances/* → workflow-service:4002
  router.use('/api/instances', createProxy(SERVICE_URLS.workflow, { '^/api/instances': '/instances' }));

  // /api/tasks/* → task-service:4003
  router.use('/api/tasks', createProxy(SERVICE_URLS.task, { '^/api/tasks': '/tasks' }));

  // /api/notifications/* → notification-service:4004
  router.use('/api/notifications', createProxy(SERVICE_URLS.notification, { '^/api/notifications': '/notifications' }));

  // /api/analytics/* → analytics-service:4005
  router.use('/api/analytics', createProxy(SERVICE_URLS.analytics, { '^/api/analytics': '/analytics' }));

  // /api/ai/* → ai-service:4006 (with AI-specific rate limiter)
  router.use('/api/ai', aiLimiter, createProxy(SERVICE_URLS.ai, { '^/api/ai': '/ai' }));

  // /api/audit/* → audit-service:4007
  router.use('/api/audit', createProxy(SERVICE_URLS.audit, { '^/api/audit': '/audit' }));

  return router;
}
