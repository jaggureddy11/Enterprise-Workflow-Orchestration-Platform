export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export interface Task {
    id: string;
    instanceId: string;
    stepId: string;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    assigneeId?: string;
    assigneeRole?: string;
    dueAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
    completedBy?: string;
    formData: Record<string, unknown>;
    comments: TaskComment[];
    version: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface TaskComment {
    id: string;
    authorId: string;
    authorEmail: string;
    content: string;
    createdAt: string;
}
export interface CompleteTaskInput {
    taskId: string;
    userId: string;
    decision: 'APPROVED' | 'REJECTED' | 'COMPLETED';
    formData: Record<string, unknown>;
    comments?: string;
}
export interface TaskFilter {
    assigneeId?: string;
    status?: TaskStatus | TaskStatus[];
    instanceId?: string;
    priority?: TaskPriority;
    overdue?: boolean;
}
//# sourceMappingURL=task.types.d.ts.map