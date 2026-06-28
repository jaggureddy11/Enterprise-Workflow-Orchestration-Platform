// packages/shared/src/constants/kafka.topics.ts
// All Kafka topic names per PRD §6.2

export const KAFKA_TOPICS = {
  // Workflow events
  WORKFLOW_INSTANCE_STARTED: 'workflow.instance.started',
  WORKFLOW_INSTANCE_COMPLETED: 'workflow.instance.completed',
  WORKFLOW_INSTANCE_FAILED: 'workflow.instance.failed',
  WORKFLOW_STEP_STARTED: 'workflow.step.started',
  WORKFLOW_STEP_COMPLETED: 'workflow.step.completed',

  // Task events
  TASK_CREATE_REQUESTED: 'task.create.requested',
  TASK_CREATED: 'task.created',
  TASK_COMPLETED: 'task.completed',
  TASK_EXPIRED: 'task.expired',

  // Notification events
  NOTIFICATION_SEND_REQUESTED: 'notification.send.requested',
  NOTIFICATION_SENT: 'notification.sent',
  NOTIFICATION_FAILED: 'notification.failed',
  NOTIFICATION_FAILED_DLQ: 'notification.failed.dlq',

  // Audit
  AUDIT_EVENT_CREATED: 'audit.event.created',
} as const;

export type KafkaTopic = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];

// Consumer group IDs per service
export const KAFKA_CONSUMER_GROUPS = {
  WORKFLOW_SERVICE: 'ewap-workflow-service',
  TASK_SERVICE: 'ewap-task-service',
  NOTIFICATION_SERVICE: 'ewap-notification-service',
  NOTIFICATION_DLQ: 'ewap-notification-dlq',
  ANALYTICS_SERVICE: 'ewap-analytics-service',
  AUDIT_SERVICE: 'ewap-audit-service',
} as const;
