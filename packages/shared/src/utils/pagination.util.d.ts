export interface PaginatedRequest {
    cursor?: string;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        nextCursor: string | null;
        hasNextPage: boolean;
        limit: number;
        total?: number;
    };
}
export declare function encodeCursor(value: string): string;
export declare function decodeCursor(cursor: string): string;
export declare function buildCursorQuery(cursor?: string): {
    createdAt?: {
        lt: Date;
    };
};
export declare function buildPaginatedResponse<T extends {
    createdAt: Date;
}>(items: T[], limit: number): PaginatedResponse<T>;
export declare function parseLimit(limit?: number | string): number;
//# sourceMappingURL=pagination.util.d.ts.map