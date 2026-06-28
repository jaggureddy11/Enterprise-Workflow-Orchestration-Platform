// packages/shared/src/utils/pagination.util.ts
// Cursor-based pagination per PRD §9.7

export interface PaginatedRequest {
  cursor?: string;    // last item's createdAt ISO string (base64 encoded)
  limit?: number;     // default 20, max 100
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

/**
 * Encodes a cursor value (createdAt ISO string) to base64.
 */
export function encodeCursor(value: string): string {
  return Buffer.from(value).toString('base64');
}

/**
 * Decodes a base64 cursor back to the original value.
 */
export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64').toString('utf-8');
}

/**
 * Builds a Prisma cursor-based query clause.
 */
export function buildCursorQuery(cursor?: string): { createdAt?: { lt: Date } } {
  if (!cursor) return {};
  const decoded = decodeCursor(cursor);
  return { createdAt: { lt: new Date(decoded) } };
}

/**
 * Builds a paginated response from a list of items.
 * Items should be fetched with limit + 1 to determine if there's a next page.
 */
export function buildPaginatedResponse<T extends { createdAt: Date }>(
  items: T[],
  limit: number,
): PaginatedResponse<T> {
  const hasNextPage = items.length > limit;
  const data = hasNextPage ? items.slice(0, limit) : items;
  const lastItem = data[data.length - 1];
  const nextCursor = hasNextPage && lastItem
    ? encodeCursor(lastItem.createdAt.toISOString())
    : null;

  return {
    data,
    pagination: {
      nextCursor,
      hasNextPage,
      limit,
    },
  };
}

export function parseLimit(limit?: number | string): number {
  const parsed = typeof limit === 'string' ? parseInt(limit, 10) : (limit ?? 20);
  return Math.min(Math.max(parsed, 1), 100);
}
