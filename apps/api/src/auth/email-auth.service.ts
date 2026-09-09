import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import type { Redis } from 'ioredis';
import { IsNull, LessThan, Repository } from 'typeorm';
import { AuditLogService } from '../audit/audit-log.service.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { CreditsService } from '../credits/credits.service.js';
import type { AuthConfig } from '../config/configuration.js';
import { AccountMailService } from '../mail/account-mail.service.js';
import { REDIS_CLIENT } from '../redis/redis.constants.js';
import { AuthService, type IssuedSession, type SessionContext } from './auth.service.js';
import { normalizeEmail } from './email.util.js';
import { PasswordService } from './password.service.js';
import { User } from './user.entity.js';
import { UserToken, type UserTokenType } from './user-token.entity.js';

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  acceptedTerms: boolean;
}

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

/** Chống dò mật khẩu: quá số lần này trong một giờ thì khoá tạm theo email + IP. */
const LOGIN_ATTEMPT_LIMIT = 10;
const LOGIN_ATTEMPT_WINDOW_SEC = 60 * 60;

/** Chặn spam mail: mỗi email chỉ nhận một lần gửi trong khoảng này. */
const MAIL_COOLDOWN_SEC = 60;

@Injectable()
export class EmailAuthService {
  private readonly logger = new Logger(EmailAuthService.name);
  private readonly auth: AuthConfig;

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(UserToken)
    private readonly tokens: Repository<UserToken>,
    private readonly passwords: PasswordService,
    private readonly sessions: AuthService,
    private readonly mail: AccountMailService,
    private readonly audit: AuditLogService,
    private readonly credits: CreditsService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    config: ConfigService,
  ) {
    this.auth = config.getOrThrow<AuthConfig>('auth');
  }

  /**
   * Đăng ký tài khoản mới.
   *
   * Tài khoản được tạo ở trạng thái **chưa xác minh** và không mở phiên đăng nhập ngay:
   * theo lựa chọn của dự án, phải bấm link trong mail rồi mới đăng nhập được.
   */
  async register(input: RegisterInput, context: SessionContext): Promise<void> {
    if (input.acceptedTerms !== true) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Bạn cần đồng ý với điều khoản sử dụng',
      });
    }

    const email = normalizeEmail(input.email);
    const name = input.name?.trim() ?? '';

    if (name.length < 2 || name.length > 120) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Tên hiển thị cần từ 2 đến 120 ký tự',
      });
    }

    this.passwords.assertStrongEnough(input.password);

    const existing = await this.users.findOne({ where: { email } });

    if (existing) {
      // Email đã có tài khoản Google nhưng chưa có mật khẩu: nói thẳng đường vào đúng,
      // thay vì để người dùng loay hoay với thông báo "email đã tồn tại".
      if (existing.googleSub && !existing.passwordHash) {
        throw new BusinessException('EMAIL_ALREADY_REGISTERED', {
          message:
            'Email này đã đăng nhập bằng Google. Hãy dùng nút "Đăng nhập bằng Google", hoặc chọn "Quên mật khẩu" để đặt mật khẩu riêng.',
        });
      }

      throw new BusinessException('EMAIL_ALREADY_REGISTERED');
    }

    const user = new User();
    user.email = email;
    user.emailVerified = false;
    user.name = name;
    user.avatarUrl = null;
    user.googleSub = null;
    user.passwordHash = await this.passwords.hash(input.password);
    user.role = this.auth.bootstrapAdminEmails.includes(email) ? 'admin' : 'user';
    // Chưa tặng credit lúc này: theo FR-A3, credit dùng thử chỉ về sau khi xác minh email.
    // Tài khoản chưa xác minh cũng chưa đăng nhập được nên không có gì để tiêu.
    user.credits = 0;

    const saved = await this.users.save(user);

    await this.audit.record({
      action: 'auth.register',
      target: saved.email,
      level: 'info',
      actor: saved.email,
      ip: context.ip,
      metadata: { provider: 'password' },
    });

    await this.sendVerification(saved);
  }

  /**
   * Đăng nhập bằng email và mật khẩu.
   *
   * Mọi nhánh sai — email không tồn tại, sai mật khẩu, tài khoản chỉ có Google — đều trả
   * về **cùng một thông báo**. Phân biệt chúng là tặng kẻ tấn công công cụ dò xem địa chỉ
   * nào đã đăng ký.
   */
  async login(
    rawEmail: string,
    password: string,
    context: SessionContext,
  ): Promise<IssuedSession> {
    const email = normalizeEmail(rawEmail);
    await this.assertNotRateLimited(email, context.ip);

    const user = await this.users.findOne({ where: { email } });
    const matches = await this.passwords.verify(password, user?.passwordHash ?? null);

    if (!user || !matches) {
      await this.countFailedAttempt(email, context.ip);
      await this.audit.record({
        action: 'auth.login',
        target: email,
        level: 'warning',
        success: false,
        actor: email,
        ip: context.ip,
        metadata: { provider: 'password', reason: 'invalid_credentials' },
      });

      throw new BusinessException('INVALID_CREDENTIALS');
    }

    if (user.status === 'suspended') {
      throw new BusinessException('ACCOUNT_SUSPENDED');
    }

    // Chặn ở đây chứ không phải lúc đăng ký: tài khoản vẫn tồn tại, chỉ chưa mở khoá.
    if (!user.emailVerified) {
      await this.sendVerification(user);
      throw new BusinessException('EMAIL_NOT_VERIFIED');
    }

    await this.clearFailedAttempts(email, context.ip);

    return this.sessions.openSessionFor(user, context, 'password');
  }

  /** Xác minh email bằng token trong link. Xác minh xong là đăng nhập được ngay. */
  async verifyEmail(rawToken: string): Promise<void> {
    const token = await this.consumeToken(rawToken, 'email_verification');
    const user = await this.users.findOne({ where: { id: token.userId } });

    if (!user) {
      throw new BusinessException('INVALID_TOKEN');
    }

    if (!user.emailVerified) {
      user.emailVerified = true;
      await this.users.save(user);
      await this.credits.grantSignupBonus(user.id);
    }

    await this.audit.record({
      action: 'auth.email_verified',
      target: user.email,
      level: 'info',
      actor: user.email,
    });
  }

  /**
   * Gửi lại mail xác minh hoặc mail đặt lại mật khẩu.
   *
   * Luôn kết thúc êm dù email có tồn tại hay không — phản hồi khác nhau sẽ biến endpoint
   * này thành công cụ kiểm tra xem địa chỉ nào đã đăng ký.
   */
  async requestEmailVerification(rawEmail: string): Promise<void> {
    const email = normalizeEmail(rawEmail);
    const user = await this.users.findOne({ where: { email } });

    if (user && !user.emailVerified) {
      await this.sendVerification(user);
    }
  }

  async requestPasswordReset(
    rawEmail: string,
    context: SessionContext,
  ): Promise<void> {
    const email = normalizeEmail(rawEmail);
    const user = await this.users.findOne({ where: { email } });

    if (!user || !(await this.withinCooldown(`reset:${email}`))) return;

    const token = await this.issueToken(user, 'password_reset', PASSWORD_RESET_TTL_MS);

    await this.mail.sendPasswordReset(user, token);
    await this.audit.record({
      action: 'auth.password_reset_requested',
      target: user.email,
      level: 'warning',
      actor: user.email,
      ip: context.ip,
    });
  }

  /**
   * Đặt lại mật khẩu bằng token trong mail.
   *
   * Kèm hai việc bắt buộc: **thu hồi toàn bộ phiên đang mở** (nếu tài khoản đang bị chiếm
   * thì kẻ kia phải bị đẩy ra) và **xác minh luôn email** (chủ tài khoản vừa chứng minh
   * họ đọc được hộp thư đó).
   */
  async resetPassword(
    rawToken: string,
    newPassword: string,
    context: SessionContext,
  ): Promise<void> {
    this.passwords.assertStrongEnough(newPassword);

    const token = await this.consumeToken(rawToken, 'password_reset');
    const user = await this.users.findOne({ where: { id: token.userId } });

    if (!user) {
      throw new BusinessException('INVALID_TOKEN');
    }

    user.passwordHash = await this.passwords.hash(newPassword);
    user.emailVerified = true;
    await this.users.save(user);

    await this.sessions.logoutAll(user.id, user.email, context.ip);
    await this.audit.record({
      action: 'auth.password_reset',
      target: user.email,
      level: 'warning',
      actor: user.email,
      ip: context.ip,
    });
  }

  private async sendVerification(user: User): Promise<void> {
    if (!(await this.withinCooldown(`verify:${user.email}`))) return;

    const token = await this.issueToken(
      user,
      'email_verification',
      VERIFICATION_TTL_MS,
    );

    await this.mail.sendEmailVerification(user, token);
  }

  /**
   * Sinh token mới và **huỷ mọi token cùng loại còn hiệu lực** của người dùng đó: link cũ
   * trong hộp thư phải chết ngay khi link mới được gửi.
   */
  private async issueToken(
    user: User,
    type: UserTokenType,
    ttlMs: number,
  ): Promise<string> {
    await this.tokens.update(
      { userId: user.id, type, usedAt: IsNull() },
      { usedAt: new Date() },
    );

    const raw = randomBytes(32).toString('base64url');

    const token = new UserToken();
    token.userId = user.id;
    token.type = type;
    token.tokenHash = this.hashToken(raw);
    token.expiresAt = new Date(Date.now() + ttlMs);
    token.usedAt = null;
    await this.tokens.save(token);

    void this.pruneExpiredTokens();

    return raw;
  }

  private async consumeToken(
    raw: string,
    type: UserTokenType,
  ): Promise<UserToken> {
    if (typeof raw !== 'string' || raw.trim() === '') {
      throw new BusinessException('INVALID_TOKEN');
    }

    const token = await this.tokens.findOne({
      where: { tokenHash: this.hashToken(raw.trim()), type },
    });

    if (!token || token.usedAt !== null) {
      throw new BusinessException('INVALID_TOKEN');
    }

    if (token.expiresAt.getTime() <= Date.now()) {
      throw new BusinessException('TOKEN_EXPIRED');
    }

    token.usedAt = new Date();
    await this.tokens.save(token);

    return token;
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /** Khoá tạm theo cặp email + IP: chặn dò một tài khoản mà không khoá cả nhà mạng. */
  private attemptKey(email: string, ip: string | null): string {
    return `auth:login:${email}:${ip ?? 'unknown'}`;
  }

  private async assertNotRateLimited(
    email: string,
    ip: string | null,
  ): Promise<void> {
    const attempts = Number(await this.redis.get(this.attemptKey(email, ip)));

    if (attempts >= LOGIN_ATTEMPT_LIMIT) {
      throw new BusinessException('TOO_MANY_REQUESTS', {
        message: 'Bạn đã thử sai quá nhiều lần, vui lòng đợi ít phút rồi thử lại',
      });
    }
  }

  private async countFailedAttempt(email: string, ip: string | null): Promise<void> {
    const key = this.attemptKey(email, ip);
    const attempts = await this.redis.incr(key);

    if (attempts === 1) {
      await this.redis.expire(key, LOGIN_ATTEMPT_WINDOW_SEC);
    }
  }

  private async clearFailedAttempts(email: string, ip: string | null): Promise<void> {
    await this.redis.del(this.attemptKey(email, ip));
  }

  /** `true` nếu được phép gửi; đồng thời đặt luôn mốc chặn cho lần sau. */
  private async withinCooldown(key: string): Promise<boolean> {
    const created = await this.redis.set(
      `auth:mail:${key}`,
      '1',
      'EX',
      MAIL_COOLDOWN_SEC,
      'NX',
    );

    return created === 'OK';
  }

  /** Token hết hạn không còn giá trị gì; dọn định kỳ để bảng không phình vô hạn. */
  private async pruneExpiredTokens(): Promise<void> {
    try {
      await this.tokens.delete({
        expiresAt: LessThan(new Date(Date.now() - 7 * 86_400_000)),
      });
    } catch (error) {
      this.logger.warn(
        `Không dọn được token hết hạn: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
