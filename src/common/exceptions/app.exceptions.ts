import { COMMON_ERROR_CODE } from '@/common/constants';
import type { ErrorCode } from '@/common/constants';
import { HttpException, HttpStatus } from '@nestjs/common';

export class CodedException extends HttpException {
  constructor(
    status: HttpStatus,
    message: string,
    code: ErrorCode,
    details?: unknown,
  ) {
    super({ message, code, ...(details ? { details } : {}) }, status);
  }
}

export class NotFoundError extends CodedException {
  constructor(
    message = 'Resource not found',
    code: ErrorCode = COMMON_ERROR_CODE.NOT_FOUND,
  ) {
    super(HttpStatus.NOT_FOUND, message, code);
  }
}

export class UnauthorizedError extends CodedException {
  constructor(
    message = 'Unauthorized',
    code: ErrorCode = COMMON_ERROR_CODE.UNAUTHORIZED,
  ) {
    super(HttpStatus.UNAUTHORIZED, message, code);
  }
}

export class ForbiddenError extends CodedException {
  constructor(message = 'Forbidden', code: ErrorCode = COMMON_ERROR_CODE.FORBIDDEN) {
    super(HttpStatus.FORBIDDEN, message, code);
  }
}

export class ValidationError extends CodedException {
  constructor(
    message = 'Validation failed',
    details?: unknown,
    code: ErrorCode = COMMON_ERROR_CODE.VALIDATION_ERROR,
  ) {
    super(HttpStatus.UNPROCESSABLE_ENTITY, message, code, details);
  }
}

export class ConflictError extends CodedException {
  constructor(message = 'Conflict', code: ErrorCode = COMMON_ERROR_CODE.CONFLICT) {
    super(HttpStatus.CONFLICT, message, code);
  }
}

export class BadRequestError extends CodedException {
  constructor(message = 'Bad request', code: ErrorCode = COMMON_ERROR_CODE.BAD_REQUEST) {
    super(HttpStatus.BAD_REQUEST, message, code);
  }
}
