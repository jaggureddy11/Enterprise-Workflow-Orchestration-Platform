// packages/telemetry/src/metrics.ts
// Prometheus metrics per PRD §12.1

import { register, Histogram, Counter, Gauge, collectDefaultMetrics } from 'prom-client';

// Collect default Node.js metrics
collectDefaultMetrics({ register });

// ─── HTTP Metrics ─────────────────────────────────────────────────────────────

/**
 * HTTP request duration histogram per service, route, method, and status code.
 */
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'route', 'status_code', 'service'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500],
});

// ─── Kafka Metrics ────────────────────────────────────────────────────────────

/**
 * Counter for Kafka events processed per topic and status.
 */
export const kafkaEventsProcessed = new Counter({
  name: 'kafka_events_processed_total',
  help: 'Total Kafka events consumed',
  labelNames: ['topic', 'status', 'service'],
});

// ─── Workflow Metrics ─────────────────────────────────────────────────────────

/**
 * Gauge for currently active workflow instances.
 */
export const activeInstances = new Gauge({
  name: 'workflow_instances_active',
  help: 'Number of currently running workflow instances',
  labelNames: ['workflow_id', 'tenant_id'],
});

/**
 * Histogram for individual workflow step execution duration.
 */
export const stepExecutionDuration = new Histogram({
  name: 'workflow_step_duration_ms',
  help: 'Time to execute a single workflow step',
  labelNames: ['step_type', 'tenant_id'],
  buckets: [100, 500, 1000, 5000, 10000, 30000, 60000],
});

// ─── Notification Metrics ─────────────────────────────────────────────────────

/**
 * Counter for notification delivery outcomes.
 */
export const notificationOutcomes = new Counter({
  name: 'notifications_total',
  help: 'Total notification delivery attempts',
  labelNames: ['channel', 'status'],
});

// ─── DLQ Metrics ─────────────────────────────────────────────────────────────

/**
 * Counter for events reaching the Dead Letter Queue.
 */
export const dlqEvents = new Counter({
  name: 'dlq_events_total',
  help: 'Total events reaching Dead Letter Queue',
  labelNames: ['topic'],
});

// ─── Registry ─────────────────────────────────────────────────────────────────

export { register };

/**
 * Express route handler that exposes Prometheus metrics at /metrics
 */
export function metricsHandler(req: unknown, res: { set: (h: string, v: string) => void; end: (d: string) => void }) {
  register.metrics().then(metrics => {
    (res as any).set('Content-Type', register.contentType);
    (res as any).end(metrics);
  });
}
