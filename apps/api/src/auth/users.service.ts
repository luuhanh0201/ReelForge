import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, IsNull, Repository } from 'typeorm';
import { AuditLogService } from '../audit/audit-log.service.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { CreditsService } from '../credits/credits.service.js';
import { AuthService } from './auth.service.js';
import { TokenService } from './token.service.js';
import {
  USER_ROLES,
  User,
  type UserPlan,
  type UserRole,
  type UserStatus,
} from './user.entity.js';
import { UserSession } from './user-session.entity.js';

/** Một dòng trong bảng quản trị người dùng. */
/** Cách tài khoản đăng nhập được — suy từ dữ liệu thật, không lưu thành cột riêng. */
export type AuthProvider = 'google' | 'password' | 'both' | 'none';

export interface AdminUserView {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  plan: UserPlan;
  credits: number;
  /**
   * Chưa xác minh thì **không đăng nhập bằng mật khẩu được** — admin cần thấy ngay để
   * biết vì sao một tài khoản mới đăng ký mà chưa bao giờ vào được.
   */
  emailVerified: boolean;
  provider: AuthProvider;
  /** Số thiết bị đang đăng nhập — cột này là lý do trang users cần biết về phiên. */
  activeSessions: number;
  lastLoginAt: Date | null;
  createdAt: Date;
}

/** Vài con số đủ rẻ để tính bằng COUNT, dùng cho huy hiệu trên sidebar. */
export interface AdminUserStats {
  total: number;
  unverified: number;
  suspended: number;
}

export interface UpdateUserInput {
  role?: UserRole;
  status?: UserStatus;
  credits?: number;
}

/**
 * `google_sub` và `password_hash` cho biết tài khoản vào được bằng đường nào.
 * `none` là trường hợp bất thường (tạo tay trong database) nên vẫn phải hiện ra.
 */
const resolveProvider = (user: User): AuthProvider => {
  if (user.googleSub && user.passwordHash) return 'both';
  if (user.googleSub) return 'google';
  if (user.passwordHash) return 'password';

  return 'none';
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(UserSession)
    private readonly sessions: Repository<UserSession>,
    private readonly auth: AuthService,
    private readonly credits: CreditsService,
    private readonly tokens: TokenService,
    private readonly audit: AuditLogService,
  ) {}

  async list(search?: string): Promise<AdminUserView[]> {
    const term = search?.trim();
    const where = term
      ? [{ email: ILike(`%${term}%`) }, { name: ILike(`%${term}%`) }]
      : undefined;

    const users = await this.users.find({
      where,
      order: { createdAt: 'DESC' },
      take: 200,
    });

    if (users.length === 0) return [];

    // Đếm phiên một lần cho cả trang thay vì mỗi dòng một truy vấn.
    const counts = await this.sessions
      .createQueryBuilder('session')
      .select('session.user_id', 'userId')
      .addSelect('COUNT(*)', 'count')
      .where('session.revoked_at IS NULL')
      .andWhere('session.expires_at > now()')
      .groupBy('session.user_id')
      .getRawMany<{ userId: string; count: string }>();

    const byUser = new Map(counts.map((row) => [row.userId, Number(row.count)]));

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
      plan: user.plan,
      credits: user.credits,
      emailVerified: user.emailVerified,
      provider: resolveProvider(user),
      activeSessions: byUser.get(user.id) ?? 0,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    }));
  }

  /** Đếm bằng COUNT thay vì tải hết bản ghi rồi đếm trong bộ nhớ. */
  async stats(): Promise<AdminUserStats> {
    const [total, unverified, suspended] = await Promise.all([
      this.users.count(),
      this.users.count({ where: { emailVerified: false } }),
      this.users.count({ where: { status: 'suspended' } }),
    ]);

    return { total, unverified, suspended };
  }

  /**
   * Đổi vai, khoá/mở tài khoản hoặc chỉnh credits.
   *
   * Hạ quyền và khoá tài khoản có hiệu lực ngay ở request kế tiếp vì `JwtAuthGuard` đọc
   * vai từ database; riêng khoá tài khoản còn **thu hồi luôn mọi phiên** để người đang
   * đăng nhập bị đẩy ra chứ không dùng tiếp được tới lúc access token hết hạn.
   */
  async update(
    id: string,
    input: UpdateUserInput,
    actor: { id: string; email: string },
    ip: string | null,
  ): Promise<AdminUserView> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) {
      throw new BusinessException('NOT_FOUND', {
        message: 'Không tìm thấy người dùng',
      });
    }

    if (input.role !== undefined) {
      if (!USER_ROLES.includes(input.role)) {
        throw new BusinessException('VALIDATION_FAILED', {
          message: 'Vai trò không hợp lệ',
        });
      }

      // Tự hạ quyền chính mình sẽ khoá cửa ngay sau lưng — chặn thẳng.
      if (user.id === actor.id && input.role !== 'admin') {
        throw new BusinessException('BAD_REQUEST', {
          message: 'Không thể tự hạ quyền tài khoản đang đăng nhập',
        });
      }

      user.role = input.role;
    }

    if (input.status !== undefined) {
      if (user.id === actor.id && input.status === 'suspended') {
        throw new BusinessException('BAD_REQUEST', {
          message: 'Không thể tự khoá tài khoản đang đăng nhập',
        });
      }

      user.status = input.status;
    }

    if (input.credits !== undefined && !Number.isInteger(input.credits)) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Credits phải là số nguyên không âm',
      });
    }

    const saved = await this.users.save(user);

    // Số dư không được gán thẳng: admin nhập số dư *mong muốn*, hệ thống ghi phần chênh
    // lệch thành một dòng trong sổ cái để sau này còn truy được ai đã sửa và sửa bao nhiêu.
    if (input.credits !== undefined && input.credits !== saved.credits) {
      const delta = input.credits - saved.credits;
      const { balance } = await this.credits.apply({
        userId: saved.id,
        amount: delta,
        type: delta > 0 ? 'admin_grant' : 'admin_deduct',
        note: `${actor.email} chỉnh số dư về ${input.credits}`,
        ip,
      });

      saved.credits = balance;
    }

    if (input.status === 'suspended') {
      await this.auth.logoutAll(saved.id, actor.email, ip);
      await this.auth.notifySecurity(saved.id, { kind: 'account_suspended' }, ip);
    }

    await this.audit.record({
      action: 'admin.user_updated',
      target: saved.email,
      level: input.status === 'suspended' ? 'warning' : 'info',
      actor: actor.email,
      ip,
      metadata: { ...input },
    });

    const [view] = await this.list(saved.email);
    return view!;
  }

  async listSessions(userId: string): Promise<UserSession[]> {
    return this.sessions.find({
      where: { userId, revokedAt: IsNull() },
      order: { lastUsedAt: 'DESC' },
    });
  }

  /** Admin đóng toàn bộ thiết bị của một người dùng. */
  async revokeAllSessions(
    userId: string,
    actorEmail: string,
    ip: string | null,
  ): Promise<number> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new BusinessException('NOT_FOUND', {
        message: 'Không tìm thấy người dùng',
      });
    }

    const active = await this.listSessions(userId);
    const now = new Date();

    for (const session of active) {
      session.revokedAt = now;
      session.revokedReason = 'admin_revoke';
    }

    await this.sessions.save(active);
    await this.tokens.revokeSessions(active.map((session) => session.id));
    await this.tokens.revokeAllForUser(userId);

    await this.audit.record({
      action: 'admin.sessions_revoked',
      target: user.email,
      level: 'warning',
      actor: actorEmail,
      ip,
      metadata: { revoked: active.length },
    });

    // Chủ tài khoản phải biết phiên của mình bị người khác đóng, kể cả khi đó là admin.
    await this.auth.notifySecurity(
      userId,
      { kind: 'admin_revoke', sessions: active.length },
      ip,
    );

    return active.length;
  }
}
