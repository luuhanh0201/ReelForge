import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { ACCESS_COOKIE } from './session-cookie.js';
import { TokenService } from './token.service.js';
import { User } from './user.entity.js';

/**
 * Chốt chặn xác thực, đăng ký toàn cục ở `AppModule`.
 *
 * Đọc access token từ cookie `rf_at`; header `Authorization: Bearer` vẫn được chấp nhận
 * để gọi bằng curl và viết e2e test cho tiện.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = extractToken(request);

    if (!token) {
      throw new BusinessException('UNAUTHORIZED');
    }

    const payload = await this.tokens.verifyAccessToken(token);

    // Vai và trạng thái đọc từ database chứ không lấy trong token: hạ quyền hoặc khoá tài
    // khoản phải có hiệu lực ngay, không chờ access token cũ hết hạn.
    const user = await this.users.findOne({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, status: true },
    });

    if (!user) {
      throw new BusinessException('SESSION_REVOKED');
    }

    if (user.status === 'suspended') {
      throw new BusinessException('ACCOUNT_SUSPENDED');
    }

    request.authUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      sessionId: payload.sid,
    };

    return true;
  }
}

const extractToken = (request: Request): string | undefined => {
  const cookieToken = (request.cookies as Record<string, string> | undefined)?.[
    ACCESS_COOKIE
  ];
  if (cookieToken) return cookieToken;

  const header = request.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
};
