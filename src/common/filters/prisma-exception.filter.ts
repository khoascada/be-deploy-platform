import { COMMON_ERROR_CODE } from '@/common/constants';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = COMMON_ERROR_CODE.DATABASE_ERROR;
    let message = 'Database error';

    switch (exception.code) {
      case 'P2002':
        status = HttpStatus.CONFLICT;
        code = COMMON_ERROR_CODE.CONFLICT;
        message = `Duplicate value`;
        break;
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        code = COMMON_ERROR_CODE.NOT_FOUND;
        message = 'Record not found';
        break;
      case 'P2003':
        status = HttpStatus.BAD_REQUEST;
        code = COMMON_ERROR_CODE.BAD_REQUEST;
        message = 'Foreign key constraint failed';
        break;
    }

    res.status(status).json({
      success: false,
      error: { code, message, statusCode: status },
    });
  }
}
