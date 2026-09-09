import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { ROLES_KEY } from './roles.decorator.js';
import { STAFF_ROLES, type UserRole } from './user.entity.js';

/**
 * Phân quyền theo vai, chạy sau `JwtAuthGuard`.
 *
 * Ngoài `@Roles(...)` khai báo tường minh, guard còn tự chặn: **mọi route bắt đầu bằng
 * `admin/` đều yêu cầu vai nội bộ**, kể cả khi ai đó thêm controller mới mà quên gắn
 * decorator. Đây là lớp lưới an toàn cho đúng chỗ đã từng mở toang.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.authUser;

    if (!user) {
      throw new BusinessException('UNAUTHORIZED');
    }

    const declared = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const required = declared ?? (isAdminRoute(request) ? STAFF_ROLES : null);
    if (!required || required.length === 0) return true;

    if (!required.includes(user.role)) {
      throw new BusinessException('FORBIDDEN');
    }

    return true;
  }
}

/** `request.path` không có prefix nào ở app này nên so khớp thẳng đoạn đầu. */
const isAdminRoute = (request: Request): boolean => {
  const path = request.path.startsWith('/') ? request.path.slice(1) : request.path;
  return path === 'admin' || path.startsWith('admin/');
};
