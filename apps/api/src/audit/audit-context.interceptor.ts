import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { auditContext } from './audit-context.js';

/**
 * Đưa người dùng đã xác thực vào ngữ cảnh nhật ký.
 *
 * Là interceptor chứ không phải middleware vì middleware chạy **trước** guard, lúc đó
 * `request.authUser` chưa tồn tại.
 */
@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();

    return auditContext.run(
      {
        email: request.authUser?.email ?? 'system',
        ip: request.ip ?? null,
      },
      () => next.handle(),
    );
  }
}
