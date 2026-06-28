// services/notification-service/src/index.ts
import { initTelemetry } from '@ewap/telemetry';
initTelemetry('notification-service');

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { createConsumer } from '@ewap/kafka-client';
import { KAFKA_TOPICS, KAFKA_CONSUMER_GROUPS, getTenantSchemaName } from '@ewap/shared';
import type { NotificationSendRequestedEvent, NotificationFailedDlqEvent } from '@ewap/shared';
import pino from 'pino';
import { sendWithRetry } from './retry/retry.handler';
import { isAppError } from '@ewap/shared';
import { metricsHandler, kafkaEventsProcessed, dlqEvents } from '@ewap/telemetry';

const REQUIRED_ENV = ['DATABASE_URL', 'KAFKA_BROKERS'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) { console.error(`[Notification] Missing env var: ${key}`); process.exit(1); }
}

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const prisma = new PrismaClient();
const app: express.Application = express();
app.use(express.json());

app.get('/metrics', metricsHandler as any);
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'notification-service' }));

const PORT = parseInt(process.env.PORT ?? '4004', 10);

async function start() {
  await prisma.$connect();

  // Main notification consumer
  await createConsumer({
    groupId: KAFKA_CONSUMER_GROUPS.NOTIFICATION_SERVICE,
    topics: [KAFKA_TOPICS.NOTIFICATION_SEND_REQUESTED, KAFKA_TOPICS.NOTIFICATION_FAILED],
    onMessage: async (event) => {
      if (event.eventType === 'notification.send.requested') {
        const notifEvent = event as NotificationSendRequestedEvent;
        const tenantId = notifEvent.tenantId;

        // Find tenant slug
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) return;

        const schemaName = getTenantSchemaName(tenant.slug);

        // Persist notification record
        const [notif] = await prisma.$queryRawUnsafe<any[]>(
          `INSERT INTO "${schemaName}".notifications
           (instance_id, channel, recipient, template_id, payload, status, max_attempts)
           VALUES ($1, $2, $3, $4, $5::jsonb, 'PENDING', $6) RETURNING *`,
          notifEvent.payload.instanceId,
          notifEvent.payload.channel,
          notifEvent.payload.recipient,
          notifEvent.payload.templateId,
          JSON.stringify(notifEvent.payload.templateData),
          notifEvent.payload.maxAttempts,
        );

        await sendWithRetry(
          {
            id: notif.id,
            instanceId: notifEvent.payload.instanceId,
            channel: notifEvent.payload.channel,
            recipient: notifEvent.payload.recipient,
            templateId: notifEvent.payload.templateId,
            payload: notifEvent.payload.templateData,
            attemptCount: 0,
            maxAttempts: notifEvent.payload.maxAttempts,
          },
          tenantId,
          tenant.slug,
          prisma,
        );

        kafkaEventsProcessed.inc({ topic: KAFKA_TOPICS.NOTIFICATION_SEND_REQUESTED, status: 'success', service: 'notification-service' });
      }

      // Retry on notification.failed (re-attempt)
      if (event.eventType === 'notification.failed') {
        const failedEvent = event as any;
        const { notificationId } = failedEvent.payload;
        const tenantId = failedEvent.tenantId;

        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) return;

        const schemaName = getTenantSchemaName(tenant.slug);
        const [notif] = await prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM "${schemaName}".notifications WHERE id = $1 AND next_retry_at <= NOW()`,
          notificationId,
        );

        if (notif) {
          await sendWithRetry(
            {
              id: notif.id,
              instanceId: notif.instance_id,
              channel: notif.channel,
              recipient: notif.recipient,
              templateId: notif.template_id,
              payload: typeof notif.payload === 'string' ? JSON.parse(notif.payload) : notif.payload,
              attemptCount: notif.attempt_count,
              maxAttempts: notif.max_attempts,
            },
            tenantId,
            tenant.slug,
            prisma,
          );
        }
      }
    },
    onError: async (error) => {
      logger.error({ error }, '[Notification] Consumer error');
    },
  });

  // DLQ consumer
  await createConsumer({
    groupId: KAFKA_CONSUMER_GROUPS.NOTIFICATION_DLQ,
    topics: [KAFKA_TOPICS.NOTIFICATION_FAILED_DLQ],
    onMessage: async (event) => {
      const dlqEvent = event as NotificationFailedDlqEvent;
      logger.error({
        notificationId: dlqEvent.payload.notificationId,
        instanceId: dlqEvent.payload.instanceId,
        error: dlqEvent.payload.error,
        totalAttempts: dlqEvent.payload.totalAttempts,
      }, '[DLQ] Notification permanently failed — manual intervention required');

      dlqEvents.inc({ topic: KAFKA_TOPICS.NOTIFICATION_SEND_REQUESTED });
      kafkaEventsProcessed.inc({ topic: KAFKA_TOPICS.NOTIFICATION_FAILED_DLQ, status: 'processed', service: 'notification-service' });
    },
  });

  app.listen(PORT, () => logger.info(`[Notification Service] Listening on port ${PORT}`));
}

start().catch(err => { logger.error(err); process.exit(1); });

export { app };
