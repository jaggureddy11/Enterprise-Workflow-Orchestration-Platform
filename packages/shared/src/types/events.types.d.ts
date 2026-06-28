export interface BaseEvent {
    eventId: string;
    eventType: string;
    tenantId: string;
    correlationId: string;
    timestamp: string;
    version: string;
}
export interface WorkflowInstanceStartedEvent extends BaseEvent {
    eventType: 'workflow.instance.started';
    payload: {
        instanceId: string;
        workflowId: string;
        workflowVersion: number;
        triggeredBy: string;
        triggerData: Record<string, unknown>;
    };
}
export interface WorkflowInstanceCompletedEvent extends BaseEvent {
    eventType: 'workflow.instance.completed';
    payload: {
        instanceId: string;
        workflowId: string;
        durationMs: number;
    };
}
export interface WorkflowInstanceFailedEvent extends BaseEvent {
    eventType: 'workflow.instance.failed';
    payload: {
        instanceId: string;
        workflowId: string;
        reason: string;
        failedStepId?: string;
    };
}
export interface WorkflowStepStartedEvent extends BaseEvent {
    eventType: 'workflow.step.started';
    payload: {
        instanceId: string;
        stepId: string;
        stepType: string;
        stepOrder: number;
    };
}
export interface WorkflowStepCompletedEvent extends BaseEvent {
    eventType: 'workflow.step.completed';
    payload: {
        instanceId: string;
        stepId: string;
        nextStepId?: string;
        output: Record<string, unknown>;
        durationMs: number;
    };
}
export interface TaskCreateRequestedEvent extends BaseEvent {
    eventType: 'task.create.requested';
    payload: {
        instanceId: string;
        stepId: string;
        title: string;
        description: string;
        assigneeType: 'USER' | 'ROLE';
        assigneeValue: string;
        priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        slaHours: number;
        formSchema: Record<string, unknown>;
    };
}
export interface TaskCreatedEvent extends BaseEvent {
    eventType: 'task.created';
    payload: {
        taskId: string;
        instanceId: string;
        stepId: string;
        assigneeId?: string;
        assigneeRole?: string;
        dueAt: string;
    };
}
export interface TaskCompletedEvent extends BaseEvent {
    eventType: 'task.completed';
    payload: {
        taskId: string;
        instanceId: string;
        stepId: string;
        completedBy: string;
        decision: 'APPROVED' | 'REJECTED' | 'COMPLETED';
        formData: Record<string, unknown>;
    };
}
export interface TaskExpiredEvent extends BaseEvent {
    eventType: 'task.expired';
    payload: {
        taskId: string;
        instanceId: string;
        stepId: string;
        assigneeId?: string;
        dueAt: string;
    };
}
export interface NotificationSendRequestedEvent extends BaseEvent {
    eventType: 'notification.send.requested';
    payload: {
        instanceId: string;
        channel: 'EMAIL' | 'SLACK' | 'IN_APP';
        recipient: string;
        templateId: string;
        templateData: Record<string, unknown>;
        maxAttempts: number;
    };
}
export interface NotificationSentEvent extends BaseEvent {
    eventType: 'notification.sent';
    payload: {
        notificationId: string;
        instanceId: string;
        channel: string;
        recipient: string;
        attemptCount: number;
    };
}
export interface NotificationFailedEvent extends BaseEvent {
    eventType: 'notification.failed';
    payload: {
        notificationId: string;
        instanceId: string;
        error: string;
        attemptCount: number;
        nextRetryAt?: string;
    };
}
export interface NotificationFailedDlqEvent extends BaseEvent {
    eventType: 'notification.failed.dlq';
    payload: {
        notificationId: string;
        instanceId: string;
        error: string;
        totalAttempts: number;
        originalPayload: Record<string, unknown>;
    };
}
export interface AuditEventCreatedEvent extends BaseEvent {
    eventType: 'audit.event.created';
    payload: {
        actorId?: string;
        actorEmail?: string;
        resourceType: string;
        resourceId?: string;
        beforeState?: Record<string, unknown>;
        afterState?: Record<string, unknown>;
        metadata: Record<string, unknown>;
        ipAddress?: string;
    };
}
export type KafkaEvent = WorkflowInstanceStartedEvent | WorkflowInstanceCompletedEvent | WorkflowInstanceFailedEvent | WorkflowStepStartedEvent | WorkflowStepCompletedEvent | TaskCreateRequestedEvent | TaskCreatedEvent | TaskCompletedEvent | TaskExpiredEvent | NotificationSendRequestedEvent | NotificationSentEvent | NotificationFailedEvent | NotificationFailedDlqEvent | AuditEventCreatedEvent;
//# sourceMappingURL=events.types.d.ts.map