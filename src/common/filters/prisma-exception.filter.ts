import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

// Chỉ bắt PrismaClientKnownRequestError — các Prisma error có mã P2xxx
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'DATABASE_ERROR';
    let message = 'Database error';

    switch (exception.code) {
      case 'P2002':
        // Unique constraint — insert/update trùng giá trị unique (email, username...)
        status = HttpStatus.CONFLICT;
        code = 'UNIQUE_CONSTRAINT';
        message = `Duplicate value for ${(exception.meta?.target as string[])?.join(', ')}`;
        break;
      case 'P2025':
        // Record not found — findUniqueOrThrow, update, delete trên record không tồn tại
        status = HttpStatus.NOT_FOUND;
        code = 'NOT_FOUND';
        message = 'Record not found';
        break;
      case 'P2003':
        // Foreign key constraint — insert/update với FK trỏ đến record không tồn tại
        status = HttpStatus.BAD_REQUEST;
        code = 'FOREIGN_KEY';
        message = 'Foreign key constraint failed';
        break;
    }

    res.status(status).json({
      success: false,
      error: { code, message, statusCode: status },
    });
  }
}
