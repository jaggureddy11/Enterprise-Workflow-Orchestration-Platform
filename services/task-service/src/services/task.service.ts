// services/task-service/src/services/task.service.ts
// Task completion with distributed lock + optimistic locking per PRD §8.4

import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { publishEvent } from '@ewap/kafka-client';
import {
  KAFKA_TOPICS,
  getTenantSchemaName,
  ConflictError,
  OptimisticLockError,
  NotFoundError,
} from '@ewap/shared';
import type { CompleteTaskInput, TaskCompletedEvent, TaskExpiredEvent } from '@ewap/shared';
import { TaskLock } from '../locks/task.lock';
import { kafkaEventsProcessed } from '@ewap/telemetry';

export class TaskService {
  private prisma: PrismaClient;
  private redis: Redis;
  private taskLock: TaskLock;

  constructor(prisma: PrismaClient, redis: Redis) {
    this.prisma = prisma;
    this.redis = redis;
    this.taskLock = new TaskLock(redis);
  }

  async completeTask(input: CompleteTaskInput, tenantId: string, tenantSlug: string): Promise<void> {
    const { taskId, userId, decision, formData } = input;
    const schemaName = getTenantSchemaName(tenantSlug);

    // Acquire distributed lock per PRD §8.4
    const lockValue = await this.taskLock.acquire(taskId, userId);
    if (!lockValue) {
      throw new ConflictError('Task is being processed by another request');
    }

    try {
      // Get current task with version
      const [task] = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id, status, version, instance_id, step_id FROM "${schemaName}".tasks WHERE id = $1::uuid`,
        taskId,
      );

      if (!task) throw new NotFoundError('Task', taskId);
      if (task.status !== 'OPEN' && task.status !== 'IN_PROGRESS') {
        throw new ConflictError(`Task is already ${task.status}`);
      }

      const currentVersion = task.version;

      // Optimistic lock update per PRD §9.2
      const result = await this.prisma.$queryRawUnsafe<any[]>(
        `UPDATE "${schemaName}".tasks
         SET status = $1, completed_by = $2::uuid, completed_at = NOW(),
             form_data = $3::jsonb, version = version + 1, updated_at = NOW()
         WHERE id = $4::uuid AND status IN ('OPEN', 'IN_PROGRESS') AND version = $5
         RETURNING id`,
        decision === 'REJECTED' ? 'REJECTED' : 'COMPLETED',
        userId,
        JSON.stringify(formData),
        taskId,
        currentVersion,
      );

      if (!result.length) {
        throw new OptimisticLockError('Task state changed concurrently, please retry');
      }

      // Emit task.completed event per PRD §6.2
      await publishEvent<TaskCompletedEvent>(KAFKA_TOPICS.TASK_COMPLETED, {
        eventType: 'task.completed',
        tenantId,
        correlationId: task.instance_id,
        payload: {
          taskId,
          instanceId: task.instance_id,
          stepId: task.step_id,
          completedBy: userId,
          decision,
          formData,
        },
      });

      kafkaEventsProcessed.inc({ topic: KAFKA_TOPICS.TASK_COMPLETED, status: 'produced', service: 'task-service' });
    } finally {
      // Always release lock in finally block per PRD §9.3
      await this.taskLock.release(taskId, lockValue);
    }
  }

  async rejectTask(taskId: string, userId: string, reason: string, tenantId: string, tenantSlug: string): Promise<void> {
    await this.completeTask(
      { taskId, userId, decision: 'REJECTED', formData: { reason } },
      tenantId,
      tenantSlug,
    );
  }

  /**
   * SLA expiry scheduler — runs every 5 minutes via setInterval per PRD §8.4
   */
  async checkExpiredTasks(tenantSlug: string, tenantId: string): Promise<void> {
    const schemaName = getTenantSchemaName(tenantSlug);

    const expiredTasks = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, instance_id, step_id, assignee_id FROM "${schemaName}".tasks
       WHERE status = 'OPEN' AND due_at < NOW() LIMIT 100`,
    );

    for (const task of expiredTasks) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "${schemaName}".tasks SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1::uuid`,
        task.id,
      );

      await publishEvent<TaskExpiredEvent>(KAFKA_TOPICS.TASK_EXPIRED, {
        eventType: 'task.expired',
        tenantId,
        correlationId: task.instance_id,
        payload: {
          taskId: task.id,
          instanceId: task.instance_id,
          stepId: task.step_id,
          assigneeId: task.assignee_id,
          dueAt: new Date().toISOString(),
        },
      });
    }
  }
}
