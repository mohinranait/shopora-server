/**
 * Custom Operational Application Error
 * Allows passing HTTP status code and clean error messages
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 400, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Capture stack trace excluding constructor call from it
    Error.captureStackTrace(this, this.constructor);
  }
}
