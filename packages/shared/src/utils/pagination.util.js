export function encodeCursor(value) {
    return Buffer.from(value).toString('base64');
}
export function decodeCursor(cursor) {
    return Buffer.from(cursor, 'base64').toString('utf-8');
}
export function buildCursorQuery(cursor) {
    if (!cursor)
        return {};
    const decoded = decodeCursor(cursor);
    return { createdAt: { lt: new Date(decoded) } };
}
export function buildPaginatedResponse(items, limit) {
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
export function parseLimit(limit) {
    const parsed = typeof limit === 'string' ? parseInt(limit, 10) : (limit ?? 20);
    return Math.min(Math.max(parsed, 1), 100);
}
//# sourceMappingURL=pagination.util.js.map