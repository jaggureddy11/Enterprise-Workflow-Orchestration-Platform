// services/workflow-service/src/consumers/task-completed.consumer.ts
// Consumes task.completed events and advances the state machine per PRD §8.3

import { createConsumer } from '@ewap/kafka-client';
import { KAFKA_TOPICS, KAFKA_CONSUMER_GROUPS, getTenantSchemaName } from '@ewap/shared';
import type { TaskCompletedEvent } from '@ewap/shared';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { WorkflowStateMachine } from '../engine/state-machine';
import { kafkaEventsProcessed } from '@ewap/telemetry';

const SERVICE_NAME = 'workflow-service';

export async function startTaskCompletedConsumer(prisma: PrismaClient, redis: Redis): Promise<void> {
  await createConsumer({
    groupId: KAFKA_CONSUMER_GROUPS.WORKFLOW_SERVICE,
    topics: [KAFKA_TOPICS.TASK_COMPLETED, KAFKA_TOPICS.WORKFLOW_STEP_COMPLETED],
    onMessage: async (event) => {
      if (event.eventType === 'task.completed') {
        const taskEvent = event as TaskCompletedEvent;
        const { instanceId, stepId, decision, formData } = taskEvent.payload;
        const tenantId = taskEvent.tenantId;

        // We need the tenantSlug to determine schema — look up from the instance
        // For simplicity, tenant info flows via correlationId context
        const tenantSlug = await getTenantSlugForInstance(prisma, instanceId);
        if (!tenantSlug) {
          console.warn(`[TaskConsumer] Could not find tenant for instance ${instanceId}`);
          return;
        }

        const schemaName = getTenantSchemaName(tenantSlug);
        const stateMachine = new WorkflowStateMachine(prisma, redis, tenantSlug, schemaName);

        await stateMachine.advance(
          instanceId,
          { stepId, decision, formData },
          tenantId,
        );

        kafkaEventsProcessed.inc({ topic: KAFKA_TOPICS.TASK_COMPLETED, status: 'success', service: SERVICE_NAME });
      }

      if (event.eventType === 'workflow.step.completed') {
        // Step completed from NOTIFICATION/CONDITION/DELAY steps — also advance SM
        const stepEvent = event as any;
        const { instanceId, stepId, output } = stepEvent.payload;
        const tenantId = stepEvent.tenantId;

        const tenantSlug = await getTenantSlugForInstance(prisma, instanceId);
        if (!tenantSlug) return;

        const schemaName = getTenantSchemaName(tenantSlug);
        const stateMachine = new WorkflowStateMachine(prisma, redis, tenantSlug, schemaName);

        await stateMachine.advance(
          instanceId,
          { stepId, decision: 'COMPLETED', output },
          tenantId,
        );

        kafkaEventsProcessed.inc({ topic: KAFKA_TOPICS.WORKFLOW_STEP_COMPLETED, status: 'success', service: SERVICE_NAME });
      }
    },
    onError: async (error, payload) => {
      console.error(`[TaskConsumer] Error:`, error);
      kafkaEventsProcessed.inc({ topic: payload.topic, status: 'error', service: SERVICE_NAME });
    },
  });

  console.log('[Workflow Service] Task completed consumer started');
}

async function getTenantSlugForInstance(prisma: PrismaClient, instanceId: string): Promise<string | null> {
  // Search all tenant schemas — this is a simplified lookup
  // In production, store tenant_id on the instance and look up from public.tenants
  const tenants = await prisma.tenant.findMany({ select: { slug: true } });

  for (const tenant of tenants) {
    const schemaName = getTenantSchemaName(tenant.slug);
    try {
      const [inst] = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM "${schemaName}".workflow_instances WHERE id = $1 LIMIT 1`,
        instanceId,
      );
      if (inst) return tenant.slug;
    } catch {
      // Schema might not have the table yet
    }
  }

  return null;
}
