import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import type { Redis } from 'ioredis';
import type { AuthConfig } from '../config/configuration.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { REDIS_CLIENT } from '../redis/redis.constants.js';
import type { UserRole } from './user.entity.js';

/** Nội dung access token. Giữ tối thiểu — token nằm trong tay client. */
export interface AccessTokenPayload {
  /** User id. */
  sub: string;
  /** Session id, trùng `user_sessions.id`. */
  sid: string;
  role: UserRole;
  iat: number;
  exp: number;
}

const REVOKED_SESSION_KEY = (sessionId: string) => `auth:revoked:sid:${sessionId}`;
const REVOKED_USER_KEY = (userId: string) => `auth:revoked:user:${userId}`;

/**
 * Ký, xác minh và thu hồi token.
 *
 * Access token là JWT stateless để mỗi request không phải hỏi database. Cái giá của
 * stateless là thu hồi không có hiệu lực ngay, nên **Redis giữ một denylist**: thu hồi
 * phiên là ghi một key sống đúng bằng tuổi thọ access token, và guard đọc key đó.
 * Sau khoảng thời gian ấy token tự hết hạn nên key cũng tự biến mất — denylist không phình.
 */
@Injectable()
export class TokenService {
  private readonly auth: AuthConfig;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.auth = config.getOrThrow<AuthConfig>('auth');
  }

  async signAccessToken(input: {
    userId: string;
    sessionId: string;
    role: UserRole;
  }): Promise<string> {
    return this.jwt.signAsync(
      { sub: input.userId, sid: input.sessionId, role: input.role },
      { expiresIn: this.auth.accessTtlSec },
    );
  }

  /**
   * Xác minh chữ ký và hạn dùng, rồi đối chiếu hai loại thu hồi:
   * theo phiên (đăng xuất một thiết bị) và theo tài khoản (đăng xuất mọi nơi).
   */
  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    let payload: AccessTokenPayload;

    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch (cause) {
      throw new BusinessException('SESSION_EXPIRED', { cause });
    }

    const [sessionRevoked, userRevokedAt] = await Promise.all([
      this.redis.exists(REVOKED_SESSION_KEY(payload.sid)),
      this.redis.get(REVOKED_USER_KEY(payload.sub)),
    ]);

    if (sessionRevoked === 1) {
      throw new BusinessException('SESSION_REVOKED');
    }

    // Token phát trước mốc "đăng xuất mọi nơi" thì không còn giá trị.
    if (userRevokedAt !== null && payload.iat < Number(userRevokedAt)) {
      throw new BusinessException('SESSION_REVOKED');
    }

    return payload;
  }

  /**
   * Refresh token là chuỗi ngẫu nhiên, **không phải JWT**: nó chỉ cần là một bí mật không
   * đoán được, và không mang thông tin gì để client đọc.
   */
  createRefreshToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: this.hashRefreshToken(token) };
  }

  /**
   * SHA-256 là đủ ở đây (khác với mật khẩu người dùng): token đã có 256 bit entropy ngẫu
   * nhiên nên không có gì để dò từ điển, và hash phải nhanh vì nằm trên đường refresh.
   */
  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** So sánh hash theo thời gian hằng định để không rò rỉ thông tin qua thời gian phản hồi. */
  matchesHash(token: string, expectedHash: string | null): boolean {
    if (!expectedHash) return false;

    const actual = Buffer.from(this.hashRefreshToken(token), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');

    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  /** Chặn ngay các access token còn hạn của một phiên. */
  async revokeSession(sessionId: string): Promise<void> {
    await this.redis.set(
      REVOKED_SESSION_KEY(sessionId),
      '1',
      'EX',
      this.auth.accessTtlSec,
    );
  }

  async revokeSessions(sessionIds: string[]): Promise<void> {
    await Promise.all(sessionIds.map((id) => this.revokeSession(id)));
  }

  /**
   * Đăng xuất mọi nơi. Ghi mốc thời gian thay vì liệt kê từng phiên để token phát trước
   * đó đều mất hiệu lực, kể cả phiên vừa được tạo ở một tiến trình khác.
   */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.redis.set(
      REVOKED_USER_KEY(userId),
      String(Math.floor(Date.now() / 1000)),
      'EX',
      this.auth.accessTtlSec,
    );
  }
}
