export type StepType = 'TASK' | 'NOTIFICATION' | 'CONDITION' | 'DELAY' | 'WEBHOOK' | 'AI_ACTION';
export type TriggerType = 'MANUAL' | 'SCHEDULED' | 'WEBHOOK' | 'EVENT';
export type WorkflowStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type InstanceStatus = 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type StepExecutionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
export interface TaskStepConfig {
    assigneeType: 'USER' | 'ROLE';
    assignee: string;
    slaHours: number;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    formSchema: {
        fields: Array<{
            name: string;
            type: 'text' | 'textarea' | 'radio' | 'checkbox' | 'select' | 'number';
            options?: string[];
            required: boolean;
            label?: string;
        }>;
    };
}
export interface NotificationStepConfig {
    channel: 'EMAIL' | 'SLACK' | 'IN_APP';
    template: string;
    recipients?: string[];
    webhook?: string;
    isTerminal?: boolean;
    nextStepOrder?: number;
}
export interface ConditionStepConfig {
    expression: string;
    trueStepOrder: number;
    falseStepOrder: number;
}
export interface DelayStepConfig {
    durationHours: number;
}
export interface WebhookStepConfig {
    url: string;
    method: 'GET' | 'POST' | 'PUT';
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
}
export type StepConfig = TaskStepConfig | NotificationStepConfig | ConditionStepConfig | DelayStepConfig | WebhookStepConfig;
export interface WorkflowStep {
    id: string;
    workflowId: string;
    stepOrder: number;
    name: string;
    stepType: StepType;
    config: StepConfig;
    isTerminal: boolean;
    createdAt: Date;
}
export interface WorkflowDefinition {
    steps: Array<{
        id: string;
        name: string;
        type: StepType;
        order: number;
        config: StepConfig;
        isTerminal?: boolean;
    }>;
}
export interface Workflow {
    id: string;
    name: string;
    description?: string;
    status: WorkflowStatus;
    version: number;
    triggerType: TriggerType;
    triggerConfig: Record<string, unknown>;
    definition: WorkflowDefinition;
    createdBy: string;
    updatedBy?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface WorkflowInstance {
    id: string;
    workflowId: string;
    workflowVersion: number;
    status: InstanceStatus;
    currentStepId?: string;
    context: Record<string, unknown>;
    triggeredBy?: string;
    triggerData: Record<string, unknown>;
    startedAt?: Date;
    completedAt?: Date;
    failedAt?: Date;
    failureReason?: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface InstanceStepExecution {
    id: string;
    instanceId: string;
    stepId: string;
    status: StepExecutionStatus;
    startedAt?: Date;
    completedAt?: Date;
    durationMs?: number;
    output: Record<string, unknown>;
    error?: string;
    attemptCount: number;
    createdAt: Date;
}
export interface StepResult {
    stepId: string;
    decision?: 'APPROVED' | 'REJECTED' | 'COMPLETED';
    formData?: Record<string, unknown>;
    output?: Record<string, unknown>;
}
//# sourceMappingURL=workflow.types.d.ts.map