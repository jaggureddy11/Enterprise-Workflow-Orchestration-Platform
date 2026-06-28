export declare const KAFKA_TOPICS: {
    readonly WORKFLOW_INSTANCE_STARTED: "workflow.instance.started";
    readonly WORKFLOW_INSTANCE_COMPLETED: "workflow.instance.completed";
    readonly WORKFLOW_INSTANCE_FAILED: "workflow.instance.failed";
    readonly WORKFLOW_STEP_STARTED: "workflow.step.started";
    readonly WORKFLOW_STEP_COMPLETED: "workflow.step.completed";
    readonly TASK_CREATE_REQUESTED: "task.create.requested";
    readonly TASK_CREATED: "task.created";
    readonly TASK_COMPLETED: "task.completed";
    readonly TASK_EXPIRED: "task.expired";
    readonly NOTIFICATION_SEND_REQUESTED: "notification.send.requested";
    readonly NOTIFICATION_SENT: "notification.sent";
    readonly NOTIFICATION_FAILED: "notification.failed";
    readonly NOTIFICATION_FAILED_DLQ: "notification.failed.dlq";
    readonly AUDIT_EVENT_CREATED: "audit.event.created";
};
export type KafkaTopic = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];
export declare const KAFKA_CONSUMER_GROUPS: {
    readonly WORKFLOW_SERVICE: "ewap-workflow-service";
    readonly TASK_SERVICE: "ewap-task-service";
    readonly NOTIFICATION_SERVICE: "ewap-notification-service";
    readonly NOTIFICATION_DLQ: "ewap-notification-dlq";
    readonly ANALYTICS_SERVICE: "ewap-analytics-service";
    readonly AUDIT_SERVICE: "ewap-audit-service";
};
//# sourceMappingURL=kafka.topics.d.ts.map