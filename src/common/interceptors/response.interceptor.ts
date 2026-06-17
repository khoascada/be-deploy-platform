import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

interface SuccessResponse<T> {
  success: true;
  data: T;
}

// Wrap mọi response thành { success: true, data } — chỉ chạy khi controller return bình thường
// Khi có exception → interceptor bị bypass, AllExceptionsFilter xử lý thay
@Injectable()
export class ResponseInterceptor<T = unknown> implements NestInterceptor<
  T,
  SuccessResponse<T>
> {
  intercept(
    _ctx: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessResponse<T>> {
    return next.handle().pipe(map((data) => ({ success: true, data })));
  }
}
