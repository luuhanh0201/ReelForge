import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { BusinessException } from '../common/exceptions/business.exception.js';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Lớp chống CSRF thứ hai.
 *
 * `SameSite=Lax` đã chặn cookie đi kèm request ghi phát từ site lạ, nhưng nó là hành vi
 * của trình duyệt — guard này kiểm tra lại ở phía máy chủ: mọi request có thân đổi dữ
 * liệu phải đến từ đúng `WEB_ORIGIN`. Request không có `Origin` (curl, server-to-server,
 * e2e test) được cho qua vì đó không phải bối cảnh trình duyệt bị lợi dụng.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowed: Set<string>;

  constructor(config: ConfigService) {
    this.allowed = new Set([config.getOrThrow<string>('webOrigin')]);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (!WRITE_METHODS.has(request.method)) return true;

    const origin = request.headers.origin;
    if (!origin) return true;

    if (!this.allowed.has(origin)) {
      throw new BusinessException('FORBIDDEN', {
        message: 'Yêu cầu đến từ nguồn không được phép',
      });
    }

    return true;
  }
}
