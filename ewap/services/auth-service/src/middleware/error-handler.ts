import { Request, Response, NextFunction } from 'express';
import logger from 'pino';
import { ERROR_CODES } from '@ewap/shared';

const pino = logger();

export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (error instanceof AppError) {
    pino.warn({ code: error.code, statusCode: error.statusCode }, error.message);
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  } else {
    pino.error(error);
    res.status(500).json({
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Internal server error',
      },
    });
  }
}
