// services/workflow-service/src/engine/state-machine.ts
// Core state machine engine per PRD §8.3 and §9.1

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { publishEvent } from '@ewap/kafka-client';
import {
  KAFKA_TOPICS,
  REDIS_KEYS,
  REDIS_TTL,
  OptimisticLockError,
  ConflictError,
} from '@ewap/shared';
import type {
  InstanceStatus,
  StepType,
  WorkflowStep,
  StepResult,
} from '@ewap/shared';
import { StepExecutor } from './step-executor';
import { TransitionEvaluator } from './transition-evaluator';

// Valid state transitions per PRD §9.1
const VALID_TRANSITIONS: Record<InstanceStatus, InstanceStatus[]> = {
  PENDING:   ['RUNNING', 'CANCELLED'],
  RUNNING:   ['PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'],
  PAUSED:    ['RUNNING', 'CANCELLED'],
  COMPLETED: [],
  FAILED:    [],
  CANCELLED: [],
};

function canTransition(from: InstanceStatus, to: InstanceStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export class WorkflowStateMachine {
  private prisma: PrismaClient;
  private redis: Redis;
  private tenantSlug: string;
  private schemaName: string;
  private stepExecutor: StepExecutor;
  private transitionEvaluator: TransitionEvaluator;

  constructor(prisma: PrismaClient, redis: Redis, tenantSlug: string, schemaName: string) {
    this.prisma = prisma;
    this.redis = redis;
    this.tenantSlug = tenantSlug;
    this.schemaName = schemaName;
    this.stepExecutor = new StepExecutor(tenantSlug);
    this.transitionEvaluator = new TransitionEvaluator();
  }

  /**
   * Starts a new workflow instance. Transitions PENDING → RUNNING and executes step 1.
   */
  async start(instanceId: string, tenantId: string): Promise<void> {
    const lockKey = REDIS_KEYS.WORKFLOW_INSTANCE_LOCK(instanceId);
    const lockValue = `start-${Date.now()}`;

    // Acquire distributed lock per PRD §9.3
    const acquired = await this.redis.set(lockKey, lockValue, 'NX', 'EX', REDIS_TTL.DISTRIBUTED_LOCK);
    if (!acquired) {
      throw new ConflictError('Instance is being processed by another request');
    }

    try {
      // Update status PENDING → RUNNING with optimistic lock
      const [instance] = await this.prisma.$queryRawUnsafe<any[]>(
        `UPDATE "${this.schemaName}".workflow_instances
         SET status = 'RUNNING', started_at = NOW(), updated_at = NOW(), version = version + 1
         WHERE id = $1 AND status = 'PENDING'
         RETURNING *`,
        instanceId,
      );

      if (!instance) {
        throw new OptimisticLockError(`Instance ${instanceId} is not in PENDING state`);
      }

      // Get the first step
      const [firstStep] = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "${this.schemaName}".workflow_steps
         WHERE workflow_id = $1 ORDER BY step_order ASC LIMIT 1`,
        instance.workflow_id,
      );

      if (!firstStep) {
        await this.finalizeInstance(instanceId, 'COMPLETED');
        return;
      }

      // Emit started event
      await publishEvent(KAFKA_TOPICS.WORKFLOW_INSTANCE_STARTED, {
        eventType: 'workflow.instance.started',
        tenantId,
        correlationId: instanceId,
        payload: {
          instanceId,
          workflowId: instance.workflow_id,
          workflowVersion: instance.workflow_version,
          triggeredBy: instance.triggered_by,
          triggerData: instance.trigger_data,
        },
      });

      await this.executeStep(firstStep, instance, tenantId);
    } finally {
      await this.releaseLock(lockKey, lockValue);
    }
  }

  /**
   * Advances the state machine after a step result arrives.
   * Called by the task.completed Kafka consumer.
   */
  async advance(instanceId: string, stepResult: StepResult, tenantId: string): Promise<void> {
    const lockKey = REDIS_KEYS.WORKFLOW_INSTANCE_LOCK(instanceId);
    const lockValue = `advance-${Date.now()}`;

    const acquired = await this.redis.set(lockKey, lockValue, 'NX', 'EX', REDIS_TTL.DISTRIBUTED_LOCK);
    if (!acquired) {
      throw new ConflictError('Instance is being processed by another request');
    }

    try {
      const [instance] = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "${this.schemaName}".workflow_instances WHERE id = $1`,
        instanceId,
      );

      if (!instance || instance.status !== 'RUNNING') {
        return; // Not running, ignore
      }

      const [currentStep] = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "${this.schemaName}".workflow_steps WHERE id = $1`,
        stepResult.stepId,
      );

      if (!currentStep) return;

      // Check if this was a rejection on a TASK step
      if (stepResult.decision === 'REJECTED') {
        await this.finalizeInstance(instanceId, 'FAILED', tenantId, `Step "${currentStep.name}" was rejected`);
        return;
      }

      // If terminal step, mark completed
      if (currentStep.is_terminal) {
        await this.finalizeInstance(instanceId, 'COMPLETED', tenantId);
        return;
      }

      // Find next step
      const nextStepOrder = currentStep.step_order + 1;
      let [nextStep] = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "${this.schemaName}".workflow_steps
         WHERE workflow_id = $1 AND step_order = $2`,
        currentStep.workflow_id,
        nextStepOrder,
      );

      // Handle CONDITION step — evaluate to get the right next step
      if (currentStep.step_type === 'CONDITION') {
        const config = typeof currentStep.config === 'string'
          ? JSON.parse(currentStep.config)
          : currentStep.config;
        const trueOrder = config.trueStepOrder;
        const falseOrder = config.falseStepOrder;
        const context = typeof instance.context === 'string'
          ? JSON.parse(instance.context)
          : instance.context;
        const branchOrder = this.transitionEvaluator.evaluate(config.expression, context)
          ? trueOrder
          : falseOrder;

        [nextStep] = await this.prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM "${this.schemaName}".workflow_steps
           WHERE workflow_id = $1 AND step_order = $2`,
          currentStep.workflow_id,
          branchOrder,
        );
      }

      if (!nextStep) {
        // No more steps → completed
        await this.finalizeInstance(instanceId, 'COMPLETED', tenantId);
        return;
      }

      // Advance current step pointer with optimistic lock
      const updateResult = await this.prisma.$queryRawUnsafe<any[]>(
        `UPDATE "${this.schemaName}".workflow_instances
         SET current_step_id = $1, version = version + 1, updated_at = NOW()
         WHERE id = $2 AND status = 'RUNNING'
         RETURNING id`,
        nextStep.id,
        instanceId,
      );

      if (!updateResult.length) {
        throw new OptimisticLockError(`Instance ${instanceId} was modified concurrently`);
      }

      await this.executeStep(nextStep, instance, tenantId);
    } finally {
      await this.releaseLock(lockKey, lockValue);
    }
  }

  private async executeStep(step: any, instance: any, tenantId: string): Promise<void> {
    const context = typeof instance.context === 'string'
      ? JSON.parse(instance.context)
      : instance.context;

    await publishEvent(KAFKA_TOPICS.WORKFLOW_STEP_STARTED, {
      eventType: 'workflow.step.started',
      tenantId,
      correlationId: instance.id,
      payload: {
        instanceId: instance.id,
        stepId: step.id,
        stepType: step.step_type,
        stepOrder: step.step_order,
      },
    });

    const config = typeof step.config === 'string' ? JSON.parse(step.config) : step.config;

    await this.stepExecutor.execute({
      step,
      instance,
      config,
      context,
      tenantId,
    });
  }

  private async finalizeInstance(
    instanceId: string,
    status: 'COMPLETED' | 'FAILED',
    tenantId?: string,
    failureReason?: string,
  ): Promise<void> {
    const column = status === 'COMPLETED' ? 'completed_at' : 'failed_at';

    await this.prisma.$executeRawUnsafe(
      `UPDATE "${this.schemaName}".workflow_instances
       SET status = $1, ${column} = NOW(), failure_reason = $2,
           version = version + 1, updated_at = NOW()
       WHERE id = $3`,
      status,
      failureReason ?? null,
      instanceId,
    );

    if (tenantId) {
      const topic = status === 'COMPLETED'
        ? KAFKA_TOPICS.WORKFLOW_INSTANCE_COMPLETED
        : KAFKA_TOPICS.WORKFLOW_INSTANCE_FAILED;

      await publishEvent(topic, {
        eventType: status === 'COMPLETED' ? 'workflow.instance.completed' : 'workflow.instance.failed',
        tenantId,
        correlationId: instanceId,
        payload: {
          instanceId,
          workflowId: '',
          ...(status === 'COMPLETED' ? { durationMs: 0 } : { reason: failureReason ?? 'Unknown', failedStepId: undefined }),
        } as any,
      });
    }
  }

  // Lua compare-and-delete for atomic lock release per PRD §9.3
  private async releaseLock(key: string, value: string): Promise<void> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await (this.redis as any).eval(script, 1, key, value);
  }
}
