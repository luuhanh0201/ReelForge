import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { AuthConfig } from '../config/configuration.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import {
  AuthService,
  toUserProfile,
  type IssuedSession,
  type SessionContext,
  type UserProfile,
} from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import type { AuthenticatedUser } from './authenticated-user.type.js';
import { describeDevice, type DeviceType } from './device-parser.js';
import { GoogleOAuthService } from './google-oauth.service.js';
import { Public } from './public.decorator.js';
import {
  clearSessionCookies,
  REFRESH_COOKIE,
  setSessionCookies,
} from './session-cookie.js';
import type { UserSession } from './user-session.entity.js';

/** Một thiết bị hiện trên trang quản lý phiên. */
export interface SessionView {
  id: string;
  userAgent: string | null;
  /** Đã bóc sẵn ở máy chủ — giao diện không phải tự đọc User-Agent nữa. */
  browser: string | null;
  os: string | null;
  deviceType: DeviceType;
  deviceLabel: string;
  isNewDevice: boolean;
  ip: string | null;
  /** IP của lần refresh gần nhất; khác `ip` nghĩa là phiên đã đổi mạng giữa chừng. */
  lastIp: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  /** Chính là phiên đang gọi request này. */
  current: boolean;
}

const sessionContext = (request: Request): SessionContext => ({
  userAgent: request.headers['user-agent'] ?? null,
  ip: request.ip ?? null,
});

export const toSessionView = (
  session: UserSession,
  currentSessionId: string | null,
): SessionView => {
  const device = {
    browser: session.browser,
    os: session.os,
    deviceType: session.deviceType,
  };

  return {
    id: session.id,
    userAgent: session.userAgent,
    ...device,
    deviceLabel: describeDevice(device),
    isNewDevice: session.isNewDevice,
    ip: session.ip,
    lastIp: session.lastIp,
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    expiresAt: session.expiresAt,
    current: session.id === currentSessionId,
  };
};

@Controller('auth')
export class AuthController {
  private readonly auth: AuthConfig;

  constructor(
    private readonly authService: AuthService,
    private readonly google: GoogleOAuthService,
    config: ConfigService,
  ) {
    this.auth = config.getOrThrow<AuthConfig>('auth');
  }

  /**
   * Đổi authorization code của Google lấy phiên đăng nhập.
   * Token đi ra bằng cookie `HttpOnly` — thân phản hồi **không bao giờ chứa token**.
   */
  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  async signInWithGoogle(
    @Body('code') code: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: UserProfile }> {
    if (typeof code !== 'string' || code.trim() === '') {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Thiếu authorization code của Google',
      });
    }

    const profile = await this.google.exchangeCode(code.trim());
    const issued = await this.authService.signInWithGoogle(
      profile,
      sessionContext(request),
    );

    this.applySession(response, issued);
    void this.authService.pruneExpiredSessions();

    return { user: toUserProfile(issued.user) };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: UserProfile }> {
    const token = (request.cookies as Record<string, string> | undefined)?.[
      REFRESH_COOKIE
    ];

    if (!token) {
      throw new BusinessException('SESSION_EXPIRED');
    }

    try {
      const issued = await this.authService.refresh(
        token,
        sessionContext(request),
      );
      this.applySession(response, issued);

      return { user: toUserProfile(issued.user) };
    } catch (error) {
      // Refresh hỏng thì cookie hiện tại chắc chắn vô dụng — dọn luôn để trình duyệt
      // không lặp lại vòng 401 → refresh → 401.
      clearSessionCookies(response, this.auth);
      throw error;
    }
  }

  @Get('me')
  async me(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ user: UserProfile; sessionId: string }> {
    const found = await this.authService.findUserById(user.id);
    if (!found) {
      throw new BusinessException('SESSION_REVOKED');
    }

    return { user: toUserProfile(found), sessionId: user.sessionId };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(user.sessionId, user.email, request.ip ?? null);
    clearSessionCookies(response, this.auth);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ revoked: number }> {
    const revoked = await this.authService.logoutAll(
      user.id,
      user.email,
      request.ip ?? null,
    );
    clearSessionCookies(response, this.auth);

    return { revoked };
  }

  /** Danh sách thiết bị đang đăng nhập của chính mình. */
  @Get('sessions')
  async sessions(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ items: SessionView[] }> {
    const items = await this.authService.listSessions(user.id);

    return {
      items: items.map((session) => toSessionView(session, user.sessionId)),
    };
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.revokeSession({
      sessionId: id,
      requesterId: user.id,
      actorEmail: user.email,
      ip: request.ip ?? null,
      reason: 'logout',
    });

    // Tự đóng chính thiết bị đang dùng thì xoá cookie luôn cho khỏi treo trạng thái.
    if (id === user.sessionId) {
      clearSessionCookies(response, this.auth);
    }
  }

  private applySession(response: Response, issued: IssuedSession): void {
    setSessionCookies(response, this.auth, {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      refreshTtlSec: issued.refreshTtlSec,
    });
  }
}
