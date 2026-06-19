import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { COMMON_ERROR_CODE } from '@/common/constants';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = COMMON_ERROR_CODE.INTERNAL_ERROR;
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string') {
        message = response;
        code = deriveCodeFromStatus(status);
      } else if (typeof response === 'object' && response !== null) {
        const r = response as Record<string, unknown>;
        message = (r.message as string) ?? message;
        code = (r.code as string) ?? deriveCodeFromStatus(status);
        details = r.details ?? r.errors;
      }
    } else if (exception instanceof Error) {
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

function deriveCodeFromStatus(status: number): string {
  switch (status) {
    case 400:
      return COMMON_ERROR_CODE.BAD_REQUEST;
    case 401:
      return COMMON_ERROR_CODE.UNAUTHORIZED;
    case 403:
      return COMMON_ERROR_CODE.FORBIDDEN;
    case 404:
      return COMMON_ERROR_CODE.NOT_FOUND;
    case 409:
      return COMMON_ERROR_CODE.CONFLICT;
    case 422:
      return COMMON_ERROR_CODE.VALIDATION_ERROR;
    case 429:
      return COMMON_ERROR_CODE.TOO_MANY_REQUESTS;
    default:
      return COMMON_ERROR_CODE.INTERNAL_ERROR;
  }
}
