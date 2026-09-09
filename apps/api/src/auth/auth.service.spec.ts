import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Redis } from 'ioredis';
import type { Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditLogService } from '../audit/audit-log.service.js';
import {
  SIGNUP_BONUS_CREDITS,
  type CreditsService,
} from '../credits/credits.service.js';
import type { SecurityMailService } from '../mail/security-mail.service.js';
import type { AuthConfig } from '../config/configuration.js';
import { AuthService, type SessionContext } from './auth.service.js';
import { TokenService } from './token.service.js';
import { User } from './user.entity.js';
import { UserSession } from './user-session.entity.js';

const AUTH: AuthConfig = {
  jwtSecret: 'khoa-test-du-dai-de-ky-hs256',
  accessTtlSec: 900,
  refreshTtlSec: 2_592_000,
  adminRefreshTtlSec: 604_800,
  adminIdleTimeoutSec: 1_800,
  rotationGraceSec: 30,
  maxSessionsPerUser: 3,
  cookieSecure: false,
  google: {},
  bootstrapAdminEmails: ['sep@reelforge.vn'],
};

const CHROME_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const CONTEXT: SessionContext = { userAgent: CHROME_WINDOWS, ip: '127.0.0.1' };
const OTHER_DEVICE: SessionContext = { userAgent: SAFARI_IPHONE, ip: '203.0.113.9' };

/**
 * Repository giả chạy trên mảng trong bộ nhớ.
 *
 * Chỉ hiện thực đúng phần `AuthService` dùng tới — mục tiêu của bộ test này là luật xoay
 * token, không phải TypeORM.
 */
const fakeRepository = <T extends { id?: string }>(rows: T[]) => {
  let counter = 0;

  const matches = (row: T, where: Record<string, unknown>): boolean =>
    Object.entries(where).every(([key, value]) => {
      const actual = (row as Record<string, unknown>)[key];
      // IsNull() của TypeORM là object; ở đây quy ước chỉ dùng cho revokedAt.
      if (value !== null && typeof value === 'object') return actual === null;
      return actual === value;
    });

  return {
    rows,
    save: vi.fn(async (input: T | T[]) => {
      const list = Array.isArray(input) ? input : [input];
      for (const row of list) {
        if (!row.id) {
          row.id = `row-${++counter}`;
          rows.push(row);
        } else if (!rows.includes(row)) {
          rows.push(row);
        }
      }
      return input;
    }),
    findOne: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      return rows.find((row) => matches(row, where)) ?? null;
    }),
    find: vi.fn(async (options?: { where?: Record<string, unknown> }) => {
      if (!options?.where) return [...rows];
      return rows.filter((row) => matches(row, options.where!));
    }),
    delete: vi.fn(async () => ({ affected: 0 })),
  } as unknown as Repository<T> & { rows: T[] };
};

const fakeRedis = () => {
  const store = new Map<string, string>();

  return {
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    },
    exists: async (key: string) => (store.has(key) ? 1 : 0),
  } as unknown as Redis;
};

const build = () => {
  const users = fakeRepository<User>([]);
  const sessions = fakeRepository<UserSession>([]);
  const audit = { record: vi.fn(async () => {}) } as unknown as AuditLogService;
  const securityMail = {
    notify: vi.fn(async () => {}),
  } as unknown as SecurityMailService;

  // Sổ cái credit có bộ test riêng chạy trên database thật; ở đây chỉ cần biết nó được
  // gọi đúng một lần cho mỗi tài khoản mới.
  const credits = {
    grantSignupBonus: vi.fn(async () => ({
      balance: SIGNUP_BONUS_CREDITS,
      applied: true,
    })),
  } as unknown as CreditsService;

  const tokens = new TokenService(
    new JwtService({
      secret: AUTH.jwtSecret,
      signOptions: { algorithm: 'HS256' },
    }),
    { getOrThrow: () => AUTH } as unknown as ConfigService,
    fakeRedis(),
  );

  const service = new AuthService(
    users,
    sessions,
    tokens,
    audit,
    credits,
    securityMail,
    { getOrThrow: () => AUTH } as unknown as ConfigService,
  );

  return { service, users, sessions, audit, tokens, securityMail, credits };
};

const googleProfile = (email = 'creator@gmail.com') => ({
  sub: `google-${email}`,
  email,
  emailVerified: true,
  name: 'Người Sáng Tạo',
  avatarUrl: null,
});

describe('AuthService — đăng nhập Google', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('tạo tài khoản mới với vai user và credits khởi tạo', async () => {
    const issued = await harness.service.signInWithGoogle(
      googleProfile(),
      CONTEXT,
    );

    expect(issued.user.role).toBe('user');
    expect(issued.user.credits).toBe(10);
    expect(issued.refreshTtlSec).toBe(AUTH.refreshTtlSec);
    expect(harness.users.rows).toHaveLength(1);
  });

  it('email trong danh sách bootstrap được cấp vai admin và hạn phiên ngắn hơn', async () => {
    const issued = await harness.service.signInWithGoogle(
      googleProfile('sep@reelforge.vn'),
      CONTEXT,
    );

    expect(issued.user.role).toBe('admin');
    expect(issued.refreshTtlSec).toBe(AUTH.adminRefreshTtlSec);
  });

  it('đăng nhập lại bằng cùng tài khoản Google không tạo user trùng', async () => {
    await harness.service.signInWithGoogle(googleProfile(), CONTEXT);
    await harness.service.signInWithGoogle(googleProfile(), CONTEXT);

    expect(harness.users.rows).toHaveLength(1);
    expect(harness.sessions.rows).toHaveLength(2);
    // Credit dùng thử chỉ được xin cấp ở lần tạo tài khoản, không phải mỗi lần đăng nhập.
    expect(harness.credits.grantSignupBonus).toHaveBeenCalledTimes(1);
  });

  it('tài khoản bị khoá thì không mở được phiên mới', async () => {
    await harness.service.signInWithGoogle(googleProfile(), CONTEXT);
    harness.users.rows[0]!.status = 'suspended';

    await expect(
      harness.service.signInWithGoogle(googleProfile(), CONTEXT),
    ).rejects.toMatchObject({ code: 'ACCOUNT_SUSPENDED' });
  });

  it('vượt trần số phiên thì thu hồi phiên cũ nhất', async () => {
    for (let index = 0; index < AUTH.maxSessionsPerUser + 1; index += 1) {
      await harness.service.signInWithGoogle(googleProfile(), CONTEXT);
    }

    const active = harness.sessions.rows.filter(
      (session) => session.revokedAt === null,
    );

    expect(active).toHaveLength(AUTH.maxSessionsPerUser);
    expect(
      harness.sessions.rows.some(
        (session) => session.revokedReason === 'max_sessions',
      ),
    ).toBe(true);
  });
});

describe('AuthService — nhận diện thiết bị', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('lưu trình duyệt, hệ điều hành, loại thiết bị và IP của phiên', async () => {
    await harness.service.signInWithGoogle(googleProfile(), CONTEXT);

    const session = harness.sessions.rows[0]!;
    expect(session.browser).toBe('Chrome');
    expect(session.os).toBe('Windows');
    expect(session.deviceType).toBe('desktop');
    expect(session.ip).toBe('127.0.0.1');
    expect(session.lastIp).toBe('127.0.0.1');
    expect(session.userAgent).toBe(CHROME_WINDOWS);
  });

  it('lần đăng nhập đầu tiên không bị coi là thiết bị lạ', async () => {
    await harness.service.signInWithGoogle(googleProfile(), CONTEXT);

    expect(harness.sessions.rows[0]!.isNewDevice).toBe(false);
    expect(harness.securityMail.notify).not.toHaveBeenCalled();
  });

  it('đăng nhập lại trên cùng thiết bị không sinh cảnh báo', async () => {
    await harness.service.signInWithGoogle(googleProfile(), CONTEXT);
    await harness.service.signInWithGoogle(googleProfile(), {
      // Cùng trình duyệt và hệ điều hành nhưng IP khác — đổi wifi sang 4G chẳng hạn.
      userAgent: CHROME_WINDOWS,
      ip: '203.0.113.77',
    });

    expect(harness.sessions.rows[1]!.isNewDevice).toBe(false);
    expect(harness.securityMail.notify).not.toHaveBeenCalled();
  });

  it('thiết bị lạ được đánh dấu, ghi nhật ký và gửi cảnh báo', async () => {
    await harness.service.signInWithGoogle(googleProfile(), CONTEXT);
    await harness.service.signInWithGoogle(googleProfile(), OTHER_DEVICE);

    const session = harness.sessions.rows[1]!;
    expect(session.isNewDevice).toBe(true);
    expect(session.browser).toBe('Safari');
    expect(session.os).toBe('iOS');

    expect(harness.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.new_device', level: 'warning' }),
    );
    expect(harness.securityMail.notify).toHaveBeenCalledWith(
      { kind: 'new_device' },
      expect.objectContaining({ device: 'Safari trên iOS', ip: '203.0.113.9' }),
    );
  });

  it('quay lại thiết bị đã từng dùng nhưng đã đăng xuất thì không cảnh báo nữa', async () => {
    const first = await harness.service.signInWithGoogle(googleProfile(), CONTEXT);
    await harness.service.logout(first.sessionId, 'creator@gmail.com', null);
    await harness.service.signInWithGoogle(googleProfile(), CONTEXT);

    expect(harness.sessions.rows[1]!.isNewDevice).toBe(false);
  });

  it('refresh ghi IP mới vào lastIp nhưng giữ nguyên IP lúc mở phiên', async () => {
    const issued = await harness.service.signInWithGoogle(googleProfile(), CONTEXT);
    await harness.service.refresh(issued.refreshToken, {
      userAgent: CHROME_WINDOWS,
      ip: '198.51.100.4',
    });

    const session = harness.sessions.rows[0]!;
    expect(session.ip).toBe('127.0.0.1');
    expect(session.lastIp).toBe('198.51.100.4');
  });
});

describe('AuthService — xoay refresh token', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('xoay ra token mới và token cũ không dùng lại được sau cửa sổ ân hạn', async () => {
    const first = await harness.service.signInWithGoogle(
      googleProfile(),
      CONTEXT,
    );

    const second = await harness.service.refresh(first.refreshToken, CONTEXT);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(second.sessionId).toBe(first.sessionId);

    // Đẩy thời điểm xoay lùi quá cửa sổ ân hạn để mô phỏng token bị đánh cắp dùng lại.
    const session = harness.sessions.rows[0]!;
    session.rotatedAt = new Date(
      Date.now() - (AUTH.rotationGraceSec + 5) * 1000,
    );

    await expect(
      harness.service.refresh(first.refreshToken, CONTEXT),
    ).rejects.toMatchObject({ code: 'SESSION_REVOKED' });
  });

  it('phát hiện tái sử dụng thì thu hồi cả phiên và ghi nhật ký mức critical', async () => {
    const first = await harness.service.signInWithGoogle(
      googleProfile(),
      CONTEXT,
    );
    const second = await harness.service.refresh(first.refreshToken, CONTEXT);

    harness.sessions.rows[0]!.rotatedAt = new Date(
      Date.now() - (AUTH.rotationGraceSec + 5) * 1000,
    );

    await expect(
      harness.service.refresh(first.refreshToken, CONTEXT),
    ).rejects.toThrow();

    expect(harness.sessions.rows[0]!.revokedReason).toBe('reuse_detected');
    expect(harness.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.refresh_reuse_detected',
        level: 'critical',
      }),
    );

    // Token vừa xoay cũng chết theo — cả phiên bị đóng, không chỉ token bị lộ.
    await expect(
      harness.service.refresh(second.refreshToken, CONTEXT),
    ).rejects.toMatchObject({ code: 'SESSION_REVOKED' });
  });

  it('trong cửa sổ ân hạn, token vừa bị xoay vẫn được chấp nhận (nhiều tab cùng refresh)', async () => {
    const first = await harness.service.signInWithGoogle(
      googleProfile(),
      CONTEXT,
    );
    await harness.service.refresh(first.refreshToken, CONTEXT);

    // `rotatedAt` vừa đặt xong nên vẫn nằm trong cửa sổ ân hạn.
    await expect(
      harness.service.refresh(first.refreshToken, CONTEXT),
    ).resolves.toBeDefined();
    expect(harness.sessions.rows[0]!.revokedAt).toBeNull();
  });

  it('refresh token không tồn tại thì báo phiên hết hạn', async () => {
    await expect(
      harness.service.refresh('token-bia-dat', CONTEXT),
    ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
  });

  it('phiên đã hết hạn thì không xoay được nữa', async () => {
    const issued = await harness.service.signInWithGoogle(
      googleProfile(),
      CONTEXT,
    );
    harness.sessions.rows[0]!.expiresAt = new Date(Date.now() - 1000);

    await expect(
      harness.service.refresh(issued.refreshToken, CONTEXT),
    ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
  });

  it('phiên quản trị để lâu không thao tác thì bị đóng', async () => {
    const issued = await harness.service.signInWithGoogle(
      googleProfile('sep@reelforge.vn'),
      CONTEXT,
    );

    harness.sessions.rows[0]!.lastUsedAt = new Date(
      Date.now() - (AUTH.adminIdleTimeoutSec + 60) * 1000,
    );

    await expect(
      harness.service.refresh(issued.refreshToken, CONTEXT),
    ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    expect(harness.sessions.rows[0]!.revokedReason).toBe('idle_timeout');
  });

  it('user thường không bị áp thời hạn không thao tác của admin', async () => {
    const issued = await harness.service.signInWithGoogle(
      googleProfile(),
      CONTEXT,
    );

    harness.sessions.rows[0]!.lastUsedAt = new Date(
      Date.now() - (AUTH.adminIdleTimeoutSec + 60) * 1000,
    );

    await expect(
      harness.service.refresh(issued.refreshToken, CONTEXT),
    ).resolves.toBeDefined();
  });

  it('đăng xuất mọi nơi đóng toàn bộ phiên đang mở', async () => {
    const first = await harness.service.signInWithGoogle(
      googleProfile(),
      CONTEXT,
    );
    await harness.service.signInWithGoogle(googleProfile(), CONTEXT);

    const revoked = await harness.service.logoutAll(
      first.user.id,
      first.user.email,
      null,
    );

    expect(revoked).toBe(2);
    expect(
      harness.sessions.rows.every(
        (session) => session.revokedReason === 'logout_all',
      ),
    ).toBe(true);
  });

  it('người dùng không đóng được phiên của người khác', async () => {
    const owner = await harness.service.signInWithGoogle(
      googleProfile(),
      CONTEXT,
    );

    await expect(
      harness.service.revokeSession({
        sessionId: owner.sessionId,
        requesterId: 'nguoi-khac',
        actorEmail: 'nguoikhac@gmail.com',
        ip: null,
        reason: 'logout',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    expect(harness.sessions.rows[0]!.revokedAt).toBeNull();
  });
});
