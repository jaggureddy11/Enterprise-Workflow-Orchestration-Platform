// services/notification-service/src/retry/retry.handler.ts
// Exponential backoff retry with DLQ promotion per PRD §8.5

import { publishEvent } from '@ewap/kafka-client';
import { KAFKA_TOPICS, calculateBackoffDelay, getTenantSchemaName } from '@ewap/shared';
import type { NotificationSentEvent, NotificationFailedDlqEvent, NotificationFailedEvent } from '@ewap/shared';
import { PrismaClient } from '@prisma/client';
import { sendEmail } from '../channels/email.channel';
import { sendSlack } from '../channels/slack.channel';
import { dlqEvents, notificationOutcomes } from '@ewap/telemetry';

export async function sendWithRetry(
  notification: {
    id: string;
    instanceId?: string;
    channel: string;
    recipient: string;
    templateId: string;
    payload: Record<string, unknown>;
    attemptCount: number;
    maxAttempts: number;
  },
  tenantId: string,
  tenantSlug: string,
  prisma: PrismaClient,
): Promise<void> {
  const schemaName = getTenantSchemaName(tenantSlug);

  try {
    // Dispatch to correct channel
    if (notification.channel === 'EMAIL') {
      await sendEmail({
        recipient: notification.recipient,
        templateId: notification.templateId,
        templateData: notification.payload,
      });
    } else if (notification.channel === 'SLACK') {
      await sendSlack({
        recipient: notification.recipient,
        templateId: notification.templateId,
        templateData: notification.payload,
      });
    }

    // Mark SENT
    await prisma.$executeRawUnsafe(
      `UPDATE "${schemaName}".notifications SET status = 'SENT', sent_at = NOW() WHERE id = $1`,
      notification.id,
    );

    notificationOutcomes.inc({ channel: notification.channel, status: 'sent' });

    await publishEvent<NotificationSentEvent>(KAFKA_TOPICS.NOTIFICATION_SENT, {
      eventType: 'notification.sent',
      tenantId,
      correlationId: notification.instanceId ?? '',
      payload: {
        notificationId: notification.id,
        instanceId: notification.instanceId ?? '',
        channel: notification.channel,
        recipient: notification.recipient,
        attemptCount: notification.attemptCount + 1,
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const nextAttempt = notification.attemptCount + 1;

    notificationOutcomes.inc({ channel: notification.channel, status: 'failed' });

    if (nextAttempt >= notification.maxAttempts) {
      // Move to DLQ
      await prisma.$executeRawUnsafe(
        `UPDATE "${schemaName}".notifications
         SET status = 'DEAD_LETTERED', error = $1, attempt_count = $2 WHERE id = $3`,
        err.message,
        nextAttempt,
        notification.id,
      );

      await publishEvent<NotificationFailedDlqEvent>(KAFKA_TOPICS.NOTIFICATION_FAILED_DLQ, {
        eventType: 'notification.failed.dlq',
        tenantId,
        correlationId: notification.instanceId ?? '',
        payload: {
          notificationId: notification.id,
          instanceId: notification.instanceId ?? '',
          error: err.message,
          totalAttempts: nextAttempt,
          originalPayload: notification.payload,
        },
      });

      dlqEvents.inc({ topic: KAFKA_TOPICS.NOTIFICATION_SEND_REQUESTED });
    } else {
      // Schedule retry
      const delay = calculateBackoffDelay(notification.attemptCount);
      const nextRetryAt = new Date(Date.now() + delay);

      await prisma.$executeRawUnsafe(
        `UPDATE "${schemaName}".notifications
         SET status = 'PENDING', attempt_count = $1, next_retry_at = $2, error = $3 WHERE id = $4`,
        nextAttempt,
        nextRetryAt,
        err.message,
        notification.id,
      );

      await publishEvent<NotificationFailedEvent>(KAFKA_TOPICS.NOTIFICATION_FAILED, {
        eventType: 'notification.failed',
        tenantId,
        correlationId: notification.instanceId ?? '',
        payload: {
          notificationId: notification.id,
          instanceId: notification.instanceId ?? '',
          error: err.message,
          attemptCount: nextAttempt,
          nextRetryAt: nextRetryAt.toISOString(),
        },
      });
    }
  }
}
