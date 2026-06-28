export const KAFKA_TOPICS = {
    WORKFLOW_INSTANCE_STARTED: 'workflow.instance.started',
    WORKFLOW_INSTANCE_COMPLETED: 'workflow.instance.completed',
    WORKFLOW_INSTANCE_FAILED: 'workflow.instance.failed',
    WORKFLOW_STEP_STARTED: 'workflow.step.started',
    WORKFLOW_STEP_COMPLETED: 'workflow.step.completed',
    TASK_CREATE_REQUESTED: 'task.create.requested',
    TASK_CREATED: 'task.created',
    TASK_COMPLETED: 'task.completed',
    TASK_EXPIRED: 'task.expired',
    NOTIFICATION_SEND_REQUESTED: 'notification.send.requested',
    NOTIFICATION_SENT: 'notification.sent',
    NOTIFICATION_FAILED: 'notification.failed',
    NOTIFICATION_FAILED_DLQ: 'notification.failed.dlq',
    AUDIT_EVENT_CREATED: 'audit.event.created',
};
export const KAFKA_CONSUMER_GROUPS = {
    WORKFLOW_SERVICE: 'ewap-workflow-service',
    TASK_SERVICE: 'ewap-task-service',
    NOTIFICATION_SERVICE: 'ewap-notification-service',
    NOTIFICATION_DLQ: 'ewap-notification-dlq',
    ANALYTICS_SERVICE: 'ewap-analytics-service',
    AUDIT_SERVICE: 'ewap-audit-service',
};
//# sourceMappingURL=kafka.topics.js.map