import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

// @Catch() không có argument → bắt MỌI exception không lọc type
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    // default: 500 nếu không xác định được loại lỗi
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof HttpException) {
      // HttpException (và subclass như NotFoundError, ConflictError...) → đọc data từ getResponse()
      status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string') {
        // NestJS built-in throw với string, vd: throw new NotFoundException('msg')
        message = response;
        code = deriveCodeFromStatus(status);
      } else if (typeof response === 'object' && response !== null) {
        // CodedException throw với object { message, code, details }
        const r = response as Record<string, unknown>;
        message = (r.message as string) ?? message;
        code = (r.code as string) ?? deriveCodeFromStatus(status);
        details = r.details ?? r.errors;
      }
    } else if (exception instanceof Error) {
      // Lỗi không mong muốn (bug, runtime error) → ẩn message thật ở production
      message =
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : exception.message;
      this.logger.error({ err: exception, url: req.url }, 'Unhandled error');
    }

    res.status(status).json({
      success: false,
      error: {
        code,
        message,
        statusCode: status,
        ...(details ? { details } : {}),
      },
    });
  }
}

// fallback khi response là string (NestJS built-in) — map status → code string
function deriveCodeFromStatus(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'VALIDATION_ERROR';
    case 429:
      return 'TOO_MANY_REQUESTS';
    default:
      return 'ERROR';
  }
}
