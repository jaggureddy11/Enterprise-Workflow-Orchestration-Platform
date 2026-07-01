// services/workflow-service/src/engine/step-executor.ts
// Dispatches Kafka events per step type per PRD §8.3

import { publishEvent } from '@ewap/kafka-client';
import { KAFKA_TOPICS } from '@ewap/shared';
import { v4 as uuidv4 } from 'uuid';

interface ExecuteParams {
  step: {
    id: string;
    step_type: string;
    step_order: number;
    name: string;
    is_terminal: boolean;
  };
  instance: {
    id: string;
    workflow_id: string;
    triggered_by: string;
    context: Record<string, unknown>;
  };
  config: Record<string, unknown>;
  context: Record<string, unknown>;
  tenantId: string;
}

export class StepExecutor {
  private tenantSlug: string;

  constructor(tenantSlug: string) {
    this.tenantSlug = tenantSlug;
  }

  async execute(params: ExecuteParams): Promise<void> {
    const { step, instance, config, context, tenantId } = params;

    switch (step.step_type) {
      case 'TASK':
        await this.executeTaskStep(step, instance, config, context, tenantId);
        break;

      case 'NOTIFICATION':
        await this.executeNotificationStep(step, instance, config, context, tenantId);
        break;

      case 'CONDITION':
        // CONDITION steps are evaluated inline by the state machine, not dispatched
        // Emit step completed immediately so the SM can advance
        await publishEvent<any>(KAFKA_TOPICS.WORKFLOW_STEP_COMPLETED, {
          eventType: 'workflow.step.completed',
          tenantId,
          correlationId: instance.id,
          payload: {
            instanceId: instance.id,
            stepId: step.id,
            output: {},
            durationMs: 0,
          },
        });
        break;

      case 'DELAY':
        await this.executeDelayStep(step, instance, config, tenantId);
        break;

      case 'WEBHOOK':
        await this.executeWebhookStep(step, instance, config, tenantId);
        break;

      default:
        console.warn(`[StepExecutor] Unknown step type: ${step.step_type}`);
    }
  }

  private async executeTaskStep(
    step: any, instance: any, config: any, context: Record<string, unknown>, tenantId: string,
  ): Promise<void> {
    // Resolve context variables in assignee field
    let assignee = (config.assigneeValue ?? config.assignee ?? '') as string;
    if (assignee.startsWith('{{') && assignee.endsWith('}}')) {
      const path = assignee.slice(2, -2).trim(); // e.g. "context.employee.managerId"
      const parts = path.split('.').slice(1); // remove "context" prefix
      assignee = parts.reduce((obj: any, key) => obj?.[key], context) as string ?? assignee;
    }

    await publishEvent<any>(KAFKA_TOPICS.TASK_CREATE_REQUESTED, {
      eventType: 'task.create.requested',
      tenantId,
      correlationId: instance.id,
      payload: {
        instanceId: instance.id,
        stepId: step.id,
        title: step.name,
        description: `Task for step: ${step.name}`,
        assigneeType: config.assigneeType as 'USER' | 'ROLE',
        assigneeValue: assignee,
        priority: (config.priority as string) ?? 'MEDIUM',
        slaHours: (config.slaHours as number) ?? 24,
        formSchema: (config.formSchema as Record<string, unknown>) ?? { fields: [] },
      },
    });
  }

  private async executeNotificationStep(
    step: any, instance: any, config: any, context: Record<string, unknown>, tenantId: string,
  ): Promise<void> {
    const recipient = config.webhook ?? config.recipient ?? '';

    await publishEvent<any>(KAFKA_TOPICS.NOTIFICATION_SEND_REQUESTED, {
      eventType: 'notification.send.requested',
      tenantId,
      correlationId: instance.id,
      payload: {
        instanceId: instance.id,
        channel: config.channel as 'EMAIL' | 'SLACK' | 'IN_APP',
        recipient,
        templateId: config.template as string,
        templateData: context,
        maxAttempts: 3,
      },
    });

    // Notification steps auto-complete; emit step completed
    if (config.isTerminal) {
      // Let state machine handle finalization via task.completed
    }

    await publishEvent<any>(KAFKA_TOPICS.WORKFLOW_STEP_COMPLETED, {
      eventType: 'workflow.step.completed',
      tenantId,
      correlationId: instance.id,
      payload: {
        instanceId: instance.id,
        stepId: step.id,
        output: { notificationDispatched: true },
        durationMs: 0,
      },
    });
  }

  private async executeDelayStep(
    step: any, instance: any, config: any, tenantId: string,
  ): Promise<void> {
    const durationMs = ((config.durationHours as number) ?? 1) * 3600 * 1000;

    // For dev/staging: use setTimeout
    // For production: use Kafka delayed message or Redis scheduled job
    setTimeout(async () => {
      await publishEvent<any>(KAFKA_TOPICS.WORKFLOW_STEP_COMPLETED, {
        eventType: 'workflow.step.completed',
        tenantId,
        correlationId: instance.id,
        payload: {
          instanceId: instance.id,
          stepId: step.id,
          output: { delayCompleted: true },
          durationMs,
        },
      });
    }, Math.min(durationMs, 2147483647)); // setTimeout max
  }

  private async executeWebhookStep(
    step: any, instance: any, config: any, tenantId: string,
  ): Promise<void> {
    try {
      const response = await fetch(config.url as string, {
        method: (config.method as string) ?? 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.headers as Record<string, string> ?? {}),
        },
        body: JSON.stringify(config.body ?? {}),
      });

      await publishEvent<any>(KAFKA_TOPICS.WORKFLOW_STEP_COMPLETED, {
        eventType: 'workflow.step.completed',
        tenantId,
        correlationId: instance.id,
        payload: {
          instanceId: instance.id,
          stepId: step.id,
          output: { statusCode: response.status, ok: response.ok },
          durationMs: 0,
        },
      });
    } catch (error) {
      console.error(`[StepExecutor] Webhook step failed:`, error);
      throw error;
    }
  }
}
