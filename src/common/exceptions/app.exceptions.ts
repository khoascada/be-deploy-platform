// Mục đích: Đóng gói lỗi thành 1 obj chuẩn gồm Response + Status

import { HttpException, HttpStatus } from '@nestjs/common';

class CodedException extends HttpException {
  constructor(
    status: HttpStatus,
    message: string,
    code: string,
    details?: unknown,
  ) {
    // HttpException constructor nhận (res, status)
    super({ message, code, ...(details ? { details } : {}) }, status);
  }
}

export class NotFoundError extends CodedException {
  constructor(message = 'Resource not found') {
    super(HttpStatus.NOT_FOUND, message, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends CodedException {
  constructor(message = 'Unauthorized') {
    super(HttpStatus.UNAUTHORIZED, message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends CodedException {
  constructor(message = 'Forbidden') {
    super(HttpStatus.FORBIDDEN, message, 'FORBIDDEN');
  }
}

export class ValidationError extends CodedException {
  constructor(message = 'Validation failed', details?: unknown) {
    super(
      HttpStatus.UNPROCESSABLE_ENTITY,
      message,
      'VALIDATION_ERROR',
      details,
    );
  }
}

export class ConflictError extends CodedException {
  constructor(message = 'Conflict') {
    super(HttpStatus.CONFLICT, message, 'CONFLICT');
  }
}

export class BadRequestError extends CodedException {
  constructor(message = 'Bad request') {
    super(HttpStatus.BAD_REQUEST, message, 'BAD_REQUEST');
  }
}
