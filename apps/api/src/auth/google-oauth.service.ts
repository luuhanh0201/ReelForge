import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import type { AuthConfig } from '../config/configuration.js';
import { BusinessException } from '../common/exceptions/business.exception.js';

export interface GoogleProfile {
  /** Định danh ổn định của tài khoản Google. */
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatarUrl: string | null;
}

/**
 * `postmessage` là redirect_uri quy ước của Google cho luồng popup: web nhận `code` qua
 * `google.accounts.oauth2.initCodeClient` rồi gửi về backend đổi lấy token.
 */
const POPUP_REDIRECT_URI = 'postmessage';

/**
 * Đổi authorization code lấy hồ sơ Google.
 *
 * Giống cách xử lý credential Google TTS: **lỗi nguyên bản của Google không bao giờ ra tới
 * client**, chỉ map sang error code ổn định, chi tiết nằm trong log server.
 */
@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);
  private readonly auth: AuthConfig;

  constructor(config: ConfigService) {
    this.auth = config.getOrThrow<AuthConfig>('auth');
  }

  private createClient(): OAuth2Client {
    const { clientId, clientSecret } = this.auth.google;

    if (!clientId || !clientSecret) {
      throw new BusinessException('GOOGLE_OAUTH_NOT_CONFIGURED', {
        details: {
          reason:
            'Thiếu GOOGLE_CLIENT_ID hoặc GOOGLE_CLIENT_SECRET trong apps/api/.env',
        },
      });
    }

    return new OAuth2Client(clientId, clientSecret, POPUP_REDIRECT_URI);
  }

  async exchangeCode(code: string): Promise<GoogleProfile> {
    const client = this.createClient();

    let idToken: string | null | undefined;

    try {
      const { tokens } = await client.getToken(code);
      idToken = tokens.id_token;
    } catch (cause) {
      this.logger.error(
        `Đổi authorization code thất bại: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
      throw new BusinessException('GOOGLE_AUTH_FAILED', { cause });
    }

    if (!idToken) {
      throw new BusinessException('GOOGLE_AUTH_FAILED', {
        message: 'Google không trả về id_token',
      });
    }

    return this.verifyIdToken(idToken, client);
  }

  /**
   * Xác minh chữ ký và `aud` của id_token. Bỏ qua bước này mà tin thẳng nội dung token là
   * lỗ hổng kinh điển — bất kỳ ai cũng tự ký được một JWT nói mình là chủ email bất kỳ.
   */
  private async verifyIdToken(
    idToken: string,
    client: OAuth2Client,
  ): Promise<GoogleProfile> {
    let payload;

    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: this.auth.google.clientId!,
      });
      payload = ticket.getPayload();
    } catch (cause) {
      this.logger.error(
        `id_token không hợp lệ: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
      throw new BusinessException('GOOGLE_AUTH_FAILED', { cause });
    }

    if (!payload?.sub || !payload.email) {
      throw new BusinessException('GOOGLE_AUTH_FAILED', {
        message: 'Hồ sơ Google thiếu thông tin bắt buộc',
      });
    }

    // Email chưa xác minh thì không được dùng làm định danh: người khác có thể đã đăng ký
    // tài khoản Google bằng địa chỉ không thuộc về họ.
    if (payload.email_verified !== true) {
      throw new BusinessException('GOOGLE_AUTH_FAILED', {
        message: 'Email Google này chưa được xác minh',
      });
    }

    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: true,
      name: payload.name ?? '',
      avatarUrl: payload.picture ?? null,
    };
  }
}
