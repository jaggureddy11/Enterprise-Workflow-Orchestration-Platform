// services/task-service/src/consumers/task-create.consumer.ts
// Consumes task.create.requested events and creates tasks per PRD §8.4

import { createConsumer } from '@ewap/kafka-client';
import { publishEvent } from '@ewap/kafka-client';
import { KAFKA_TOPICS, KAFKA_CONSUMER_GROUPS, getTenantSchemaName } from '@ewap/shared';
import type { TaskCreateRequestedEvent } from '@ewap/shared';
import { PrismaClient } from '@prisma/client';
import { kafkaEventsProcessed } from '@ewap/telemetry';

export async function startTaskCreateConsumer(prisma: PrismaClient): Promise<void> {
  await createConsumer({
    groupId: KAFKA_CONSUMER_GROUPS.TASK_SERVICE,
    topics: [KAFKA_TOPICS.TASK_CREATE_REQUESTED],
    onMessage: async (event) => {
      if (event.eventType !== 'task.create.requested') return;

      const taskEvent = event as TaskCreateRequestedEvent;
      const { instanceId, stepId, title, description, assigneeType, assigneeValue, priority, slaHours, formSchema } = taskEvent.payload;
      const tenantId = taskEvent.tenantId;

      // Determine schema — find tenant by id
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) {
        console.warn(`[TaskConsumer] Tenant not found: ${tenantId}`);
        return;
      }
      const schemaName = getTenantSchemaName(tenant.slug);

      // Calculate due date
      const dueAt = new Date(Date.now() + slaHours * 3600 * 1000);

      // Resolve assignee
      let assigneeId: string | null = null;
      let assigneeRole: string | null = null;

      if (assigneeType === 'USER') {
        assigneeId = assigneeValue;
      } else {
        assigneeRole = assigneeValue;
        // Find first available user with that role
        const [user] = await prisma.$queryRawUnsafe<any[]>(
          `SELECT id FROM "${schemaName}".users WHERE role = $1 AND is_active = true LIMIT 1`,
          assigneeValue,
        );
        if (user) assigneeId = user.id;
      }

      // Create task
      const [task] = await prisma.$queryRawUnsafe<any[]>(
        `INSERT INTO "${schemaName}".tasks
         (instance_id, step_id, title, description, status, priority, assignee_id, assignee_role, due_at)
         VALUES ($1, $2, $3, $4, 'OPEN', $5, $6, $7, $8) RETURNING *`,
        instanceId,
        stepId,
        title,
        description,
        priority,
        assigneeId,
        assigneeRole,
        dueAt,
      );

      // Emit task.created
      await publishEvent<any>(KAFKA_TOPICS.TASK_CREATED, {
        eventType: 'task.created',
        tenantId,
        correlationId: instanceId,
        payload: {
          taskId: task.id,
          instanceId,
          stepId,
          assigneeId: assigneeId ?? undefined,
          assigneeRole: assigneeRole ?? undefined,
          dueAt: dueAt.toISOString(),
        },
      });

      // Emit notification for assignee
      if (assigneeId) {
        const [user] = await prisma.$queryRawUnsafe<any[]>(
          `SELECT email FROM "${schemaName}".users WHERE id = $1`,
          assigneeId,
        );
        if (user) {
          await publishEvent<any>(KAFKA_TOPICS.NOTIFICATION_SEND_REQUESTED, {
            eventType: 'notification.send.requested',
            tenantId,
            correlationId: instanceId,
            payload: {
              instanceId,
              channel: 'EMAIL',
              recipient: user.email,
              templateId: 'task-assigned',
              templateData: { taskId: task.id, title, dueAt: dueAt.toISOString() },
              maxAttempts: 3,
            },
          });
        }
      }

      kafkaEventsProcessed.inc({ topic: KAFKA_TOPICS.TASK_CREATE_REQUESTED, status: 'success', service: 'task-service' });
    },
    onError: async (error, payload) => {
      console.error(`[TaskCreateConsumer] Error:`, error);
      kafkaEventsProcessed.inc({ topic: payload.topic, status: 'error', service: 'task-service' });
    },
  });

  console.log('[Task Service] Task create consumer started');
}
