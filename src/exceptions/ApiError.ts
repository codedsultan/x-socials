// ApiError.ts - Enhanced version
class ApiError extends Error {
  public statusCode: number;
  public name: string;

  public constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error types
export class UnauthorizedError extends ApiError {
  constructor(message: string = "Unauthorized access") {
    super(message, 401);
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = "Resource not found") {
    super(message, 404);
  }
}

export class ValidationError extends ApiError {
  constructor(message: string) {
    super(message, 400);
  }
}

export default ApiError;