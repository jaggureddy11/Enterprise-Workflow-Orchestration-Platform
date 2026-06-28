export class AppError extends Error {
    constructor(message, statusCode, code, details) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
export class NotFoundError extends AppError {
    constructor(resource, id) {
        super(id ? `${resource} with id '${id}' not found` : `${resource} not found`, 404, 'NOT_FOUND');
    }
}
export class UnauthorizedError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, 401, 'UNAUTHORIZED');
    }
}
export class ForbiddenError extends AppError {
    constructor(message = 'Insufficient permissions') {
        super(message, 403, 'FORBIDDEN');
    }
}
export class ConflictError extends AppError {
    constructor(message) {
        super(message, 409, 'CONFLICT');
    }
}
export class OptimisticLockError extends AppError {
    constructor(message) {
        super(message, 409, 'OPTIMISTIC_LOCK_ERROR');
    }
}
export class ValidationError extends AppError {
    constructor(message, details) {
        super(message, 400, 'VALIDATION_ERROR', details);
    }
}
export class RateLimitError extends AppError {
    constructor(retryAfter) {
        super(`Too many requests. Limit exceeded.`, 429, 'RATE_LIMIT_EXCEEDED', retryAfter ? { retryAfter } : undefined);
    }
}
export class InternalError extends AppError {
    constructor(message = 'Internal server error') {
        super(message, 500, 'INTERNAL_ERROR');
    }
}
export function isAppError(error) {
    return error instanceof AppError;
}
//# sourceMappingURL=error.codes.js.map