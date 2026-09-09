import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import type { AuthConfig } from '../config/configuration.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { AuditLogService } from '../audit/audit-log.service.js';
import { SecurityMailService } from '../mail/security-mail.service.js';
import { describeDevice, deviceKey, parseDevice } from './device-parser.js';
import { TokenService } from './token.service.js';
import { User, type UserRole } from './user.entity.js';
import {
  UserSession,
  type SessionRevokedReason,
} from './user-session.entity.js';
import type { GoogleProfile } from './google-oauth.service.js';

/** Thông tin thiết bị lấy từ request, đi kèm mọi thao tác tạo/xoay phiên. */
export interface SessionContext {
  userAgent: string | null;
  ip: string | null;
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  refreshTtlSec: number;
  sessionId: string;
  user: User;
}

/** Hồ sơ trả về cho client. Không bao giờ kèm hash, token hay dữ liệu nội bộ. */
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: UserRole;
  plan: User['plan'];
  credits: number;
  status: User['status'];
}

export const toUserProfile = (user: User): UserProfile => ({
  id: user.id,
  email: user.email,
  name: user.name,
  avatarUrl: user.avatarUrl,
  role: user.role,
  plan: user.plan,
  credits: user.credits,
  status: user.status,
});

/**
 * Credits tặng khi đăng nhập Google lần đầu.
 * Phải khớp `AUTH_CONFIG.googleBonusCredits` ở web và số credits của gói Free trong bảng giá.
 */
const GOOGLE_SIGNUP_CREDITS = 10;

/** Thời gian giữ phiên đã hết hạn, tính bằng ngày. Xem `pruneExpiredSessions()`. */
const SESSION_RETENTION_DAYS = 90;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly auth: AuthConfig;

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(UserSession)
    private readonly sessions: Repository<UserSession>,
    private readonly tokens: TokenService,
    private readonly audit: AuditLogService,
    private readonly securityMail: SecurityMailService,
    config: ConfigService,
  ) {
    this.auth = config.getOrThrow<AuthConfig>('auth');
  }

  /**
   * Đăng nhập bằng hồ sơ Google đã xác minh: tìm hoặc tạo tài khoản, rồi mở một phiên mới.
   */
  async signInWithGoogle(
    profile: GoogleProfile,
    context: SessionContext,
  ): Promise<IssuedSession> {
    const user = await this.upsertGoogleUser(profile);

    if (user.status === 'suspended') {
      await this.audit.record({
        action: 'auth.login',
        target: user.email,
        level: 'warning',
        success: false,
        actor: user.email,
        ip: context.ip,
        metadata: { reason: 'account_suspended' },
      });

      throw new BusinessException('ACCOUNT_SUSPENDED');
    }

    const issued = await this.openSession(user, context);

    user.lastLoginAt = new Date();
    await this.users.save(user);

    await this.audit.record({
      action: 'auth.login',
      target: user.email,
      level: 'info',
      actor: user.email,
      ip: context.ip,
      metadata: { provider: 'google', sessionId: issued.sessionId },
    });

    return issued;
  }

  /**
   * Đối chiếu bằng `google_sub` chứ không phải email: người dùng đổi được email trên tài
   * khoản Google, và một email đã bỏ có thể được cấp lại cho người khác.
   *
   * Tài khoản cũ tạo từ trước (chưa có `google_sub`) được nhận diện qua email rồi gắn
   * `google_sub` vào — không tạo trùng.
   */
  private async upsertGoogleUser(profile: GoogleProfile): Promise<User> {
    const email = profile.email.toLowerCase();

    const existing =
      (await this.users.findOne({ where: { googleSub: profile.sub } })) ??
      (await this.users.findOne({ where: { email } }));

    if (existing) {
      existing.googleSub = profile.sub;
      existing.email = email;
      existing.emailVerified = profile.emailVerified;
      existing.name = profile.name || existing.name;
      existing.avatarUrl = profile.avatarUrl ?? existing.avatarUrl;

      return this.users.save(existing);
    }

    const user = new User();
    user.email = email;
    user.emailVerified = profile.emailVerified;
    user.name = profile.name || email.split('@')[0]!;
    user.avatarUrl = profile.avatarUrl;
    user.googleSub = profile.sub;
    // Danh sách bootstrap là cách duy nhất để có admin đầu tiên — không seed cứng tài
    // khoản nào vào database.
    user.role = this.auth.bootstrapAdminEmails.includes(email)
      ? 'admin'
      : 'user';
    user.credits = GOOGLE_SIGNUP_CREDITS;

    return this.users.save(user);
  }

  /** Tuổi thọ refresh token phụ thuộc vai: tài khoản nội bộ sống ngắn hơn khách. */
  private refreshTtlFor(role: UserRole): number {
    return role === 'user'
      ? this.auth.refreshTtlSec
      : this.auth.adminRefreshTtlSec;
  }

  private async openSession(
    user: User,
    context: SessionContext,
  ): Promise<IssuedSession> {
    const device = parseDevice(context.userAgent);
    const newDevice = await this.isNewDevice(user.id, device);

    await this.enforceSessionLimit(user.id);

    const refreshTtlSec = this.refreshTtlFor(user.role);
    const { token, hash } = this.tokens.createRefreshToken();
    const now = new Date();

    // Khởi tạo tường minh cả các cột nullable: đối tượng trong bộ nhớ phải khớp với dòng
    // sẽ nằm trong database, nếu không thì `session.revokedAt` là `undefined` ở lần lưu
    // đầu và mọi so sánh với `null` sau đó đều sai một cách âm thầm.
    const session = new UserSession();
    session.userId = user.id;
    session.refreshTokenHash = hash;
    session.previousTokenHash = null;
    session.rotatedAt = null;
    session.revokedAt = null;
    session.revokedReason = null;
    session.expiresAt = new Date(now.getTime() + refreshTtlSec * 1000);
    session.lastUsedAt = now;
    session.userAgent = context.userAgent?.slice(0, 400) ?? null;
    session.browser = device.browser;
    session.os = device.os;
    session.deviceType = device.deviceType;
    session.isNewDevice = newDevice;
    session.ip = context.ip;
    session.lastIp = context.ip;

    const saved = await this.sessions.save(session);

    if (newDevice) {
      await this.audit.record({
        action: 'auth.new_device',
        target: user.email,
        level: 'warning',
        actor: user.email,
        ip: context.ip,
        metadata: {
          sessionId: saved.id,
          device: describeDevice(device),
          deviceType: device.deviceType,
        },
      });

      // Không chờ mail gửi xong: đăng nhập không được phụ thuộc vào máy chủ mail.
      void this.securityMail.notify(
        { kind: 'new_device' },
        {
          email: user.email,
          name: user.name,
          device: describeDevice(device),
          ip: context.ip,
          at: now,
        },
      );
    }

    return {
      accessToken: await this.tokens.signAccessToken({
        userId: user.id,
        sessionId: saved.id,
        role: user.role,
      }),
      refreshToken: token,
      refreshTtlSec,
      sessionId: saved.id,
      user,
    };
  }

  /**
   * Thiết bị đã từng đăng nhập vào tài khoản này chưa?
   *
   * Đối chiếu **trình duyệt + hệ điều hành**, cố ý bỏ qua IP (xem `device-parser.ts`).
   * Xét cả phiên đã thu hồi: đăng xuất rồi đăng nhập lại trên chính máy cũ không phải là
   * thiết bị lạ. **Lần đăng nhập đầu tiên của tài khoản không tính là thiết bị mới** —
   * gửi cảnh báo "có thiết bị lạ" ngay khi người ta vừa tạo tài khoản là vô nghĩa.
   */
  private async isNewDevice(
    userId: string,
    device: ReturnType<typeof parseDevice>,
  ): Promise<boolean> {
    const previous = await this.sessions.find({
      where: { userId },
      select: { id: true, browser: true, os: true },
    });

    if (previous.length === 0) return false;

    const key = deviceKey(device);

    return !previous.some(
      (session) =>
        deviceKey({
          browser: session.browser,
          os: session.os,
          deviceType: 'unknown',
        }) === key,
    );
  }

  /** Vượt trần thì thu hồi phiên cũ nhất, để một tài khoản bị chia sẻ không phình vô hạn. */
  private async enforceSessionLimit(userId: string): Promise<void> {
    const active = await this.sessions.find({
      where: { userId, revokedAt: IsNull() },
      order: { lastUsedAt: 'DESC' },
    });

    const excess = active.slice(this.auth.maxSessionsPerUser - 1);
    if (excess.length === 0) return;

    await this.revokeSessions(excess, 'max_sessions');
  }

  /**
   * Xoay refresh token.
   *
   * Ba nhánh cần phân biệt rạch ròi:
   * 1. Token khớp bản hiện hành → xoay bình thường.
   * 2. Token khớp bản **vừa bị xoay** và còn trong cửa sổ ân hạn → hai tab cùng refresh,
   *    trả lại token hiện hành thay vì giết phiên.
   * 3. Token khớp bản đã xoay nhưng quá hạn ân hạn → gần như chắc chắn bị đánh cắp:
   *    thu hồi cả phiên và ghi audit mức `critical`.
   */
  async refresh(
    refreshToken: string,
    context: SessionContext,
  ): Promise<IssuedSession> {
    const hash = this.tokens.hashRefreshToken(refreshToken);

    const session =
      (await this.sessions.findOne({ where: { refreshTokenHash: hash } })) ??
      (await this.sessions.findOne({ where: { previousTokenHash: hash } }));

    if (!session) {
      throw new BusinessException('SESSION_EXPIRED');
    }

    const user = await this.users.findOne({ where: { id: session.userId } });
    if (!user) {
      throw new BusinessException('SESSION_EXPIRED');
    }

    if (session.revokedAt) {
      throw new BusinessException('SESSION_REVOKED');
    }

    const now = new Date();

    if (session.expiresAt.getTime() <= now.getTime()) {
      await this.revokeSessions([session], 'logout');
      throw new BusinessException('SESSION_EXPIRED');
    }

    // Nhánh 3: token cũ dùng lại ngoài cửa sổ ân hạn.
    if (this.tokens.matchesHash(refreshToken, session.previousTokenHash)) {
      const graceEnd =
        (session.rotatedAt?.getTime() ?? 0) + this.auth.rotationGraceSec * 1000;

      if (now.getTime() > graceEnd) {
        await this.revokeSessions([session], 'reuse_detected');
        await this.audit.record({
          action: 'auth.refresh_reuse_detected',
          target: user.email,
          level: 'critical',
          success: false,
          actor: user.email,
          ip: context.ip,
          metadata: {
            sessionId: session.id,
            device: describeDevice({
              browser: session.browser,
              os: session.os,
              deviceType: session.deviceType,
            }),
            sessionIp: session.ip,
            attemptIp: context.ip,
          },
        });

        void this.securityMail.notify(
          { kind: 'token_reuse' },
          {
            email: user.email,
            name: user.name,
            device: describeDevice({
              browser: session.browser,
              os: session.os,
              deviceType: session.deviceType,
            }),
            ip: context.ip,
            at: now,
          },
        );

        throw new BusinessException('SESSION_REVOKED', {
          message:
            'Phát hiện phiên đăng nhập bị dùng lại bất thường, vui lòng đăng nhập lại',
        });
      }
    }

    if (user.status === 'suspended') {
      await this.revokeSessions([session], 'account_suspended');
      throw new BusinessException('ACCOUNT_SUSPENDED');
    }

    // Phiên nội bộ để lâu không thao tác thì đóng lại, không chờ hết hạn refresh token.
    if (
      user.role !== 'user' &&
      now.getTime() - session.lastUsedAt.getTime() >
        this.auth.adminIdleTimeoutSec * 1000
    ) {
      await this.revokeSessions([session], 'idle_timeout');
      throw new BusinessException('SESSION_EXPIRED', {
        message: 'Phiên quản trị đã hết hạn do không thao tác, vui lòng đăng nhập lại',
      });
    }

    const refreshTtlSec = this.refreshTtlFor(user.role);
    const rotated = this.tokens.createRefreshToken();

    session.previousTokenHash = session.refreshTokenHash;
    session.refreshTokenHash = rotated.hash;
    session.rotatedAt = now;
    session.lastUsedAt = now;
    session.expiresAt = new Date(now.getTime() + refreshTtlSec * 1000);
    // `ip` giữ nguyên IP lúc mở phiên; đổi mạng giữa chừng chỉ ghi vào `lastIp` để so
    // sánh được hai giá trị khi điều tra.
    session.lastIp = context.ip ?? session.lastIp;
    await this.sessions.save(session);

    return {
      accessToken: await this.tokens.signAccessToken({
        userId: user.id,
        sessionId: session.id,
        role: user.role,
      }),
      refreshToken: rotated.token,
      refreshTtlSec,
      sessionId: session.id,
      user,
    };
  }

  /** Ghi dấu thu hồi vào database **và** denylist Redis để access token mất hiệu lực ngay. */
  private async revokeSessions(
    sessions: UserSession[],
    reason: SessionRevokedReason,
  ): Promise<void> {
    if (sessions.length === 0) return;

    const now = new Date();
    for (const session of sessions) {
      session.revokedAt = now;
      session.revokedReason = reason;
    }

    await this.sessions.save(sessions);
    await this.tokens.revokeSessions(sessions.map((session) => session.id));
  }

  async logout(sessionId: string, actorEmail: string, ip: string | null): Promise<void> {
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session || session.revokedAt) return;

    await this.revokeSessions([session], 'logout');
    await this.audit.record({
      action: 'auth.logout',
      target: actorEmail,
      level: 'info',
      actor: actorEmail,
      ip,
      metadata: { sessionId },
    });
  }

  async logoutAll(
    userId: string,
    actorEmail: string,
    ip: string | null,
  ): Promise<number> {
    const active = await this.sessions.find({
      where: { userId, revokedAt: IsNull() },
    });

    await this.revokeSessions(active, 'logout_all');
    await this.tokens.revokeAllForUser(userId);
    await this.audit.record({
      action: 'auth.logout_all',
      target: actorEmail,
      level: 'warning',
      actor: actorEmail,
      ip,
      metadata: { revoked: active.length },
    });

    await this.notifySecurity(userId, { kind: 'logout_all', sessions: active.length }, ip);

    return active.length;
  }

  /**
   * Thu hồi một phiên cụ thể. `requesterId` là chốt chặn: user thường chỉ đóng được thiết
   * bị của chính mình, admin truyền `null` để đóng phiên của người khác.
   */
  async revokeSession(input: {
    sessionId: string;
    requesterId: string | null;
    actorEmail: string;
    ip: string | null;
    reason: SessionRevokedReason;
  }): Promise<void> {
    const session = await this.sessions.findOne({
      where: { id: input.sessionId },
    });

    if (
      !session ||
      (input.requesterId !== null && session.userId !== input.requesterId)
    ) {
      throw new BusinessException('NOT_FOUND', {
        message: 'Không tìm thấy phiên đăng nhập này',
      });
    }

    if (session.revokedAt) return;

    await this.revokeSessions([session], input.reason);
    await this.audit.record({
      action:
        input.reason === 'admin_revoke'
          ? 'auth.session_revoked_by_admin'
          : 'auth.session_revoked',
      target: session.userId,
      level: 'warning',
      actor: input.actorEmail,
      ip: input.ip,
      metadata: { sessionId: session.id },
    });
  }

  async listSessions(userId: string): Promise<UserSession[]> {
    return this.sessions.find({
      where: { userId, revokedAt: IsNull() },
      order: { lastUsedAt: 'DESC' },
    });
  }

  async findUserById(userId: string): Promise<User | null> {
    return this.users.findOne({ where: { id: userId } });
  }

  /**
   * Gửi cảnh báo bảo mật tới chủ tài khoản.
   *
   * Chỉ cần userId nên dùng được cả từ luồng quản trị, nơi người thao tác là admin chứ
   * không phải chủ tài khoản. Mail đi nền: sự cố mail không được chặn nghiệp vụ.
   */
  async notifySecurity(
    userId: string,
    alert: Parameters<SecurityMailService['notify']>[0],
    ip: string | null,
  ): Promise<void> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) return;

    const latest = await this.sessions.findOne({
      where: { userId },
      order: { lastUsedAt: 'DESC' },
    });

    void this.securityMail.notify(alert, {
      email: user.email,
      name: user.name,
      device: latest
        ? describeDevice({
            browser: latest.browser,
            os: latest.os,
            deviceType: latest.deviceType,
          })
        : 'Không rõ thiết bị',
      ip,
      at: new Date(),
    });
  }

  /**
   * Dọn phiên đã hết hạn từ lâu.
   *
   * Giữ 90 ngày: đủ dài để điều tra một vụ xâm nhập bị phát hiện muộn, đủ ngắn để bảng
   * này không thành kho IP tích tuỳ vô thời hạn. Bảng chỉ phình theo số lần đăng nhập nên
   * không cần lịch chạy nền — gọi kèm lúc đăng nhập là đủ.
   */
  async pruneExpiredSessions(): Promise<void> {
    const cutoff = new Date(Date.now() - SESSION_RETENTION_DAYS * 86_400_000);

    try {
      await this.sessions.delete({ expiresAt: LessThan(cutoff) });
    } catch (error) {
      this.logger.warn(
        `Không dọn được phiên hết hạn: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
