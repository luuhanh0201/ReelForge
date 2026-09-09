import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Redis } from 'ioredis';
import { beforeEach, describe, expect, it } from 'vitest';
import { BusinessException } from '../common/exceptions/business.exception.js';
import type { AuthConfig } from '../config/configuration.js';
import { TokenService } from './token.service.js';

const AUTH: AuthConfig = {
  jwtSecret: 'khoa-test-du-dai-de-ky-hs256',
  accessTtlSec: 900,
  refreshTtlSec: 2_592_000,
  adminRefreshTtlSec: 604_800,
  adminIdleTimeoutSec: 1_800,
  rotationGraceSec: 30,
  maxSessionsPerUser: 10,
  cookieSecure: false,
  google: {},
  bootstrapAdminEmails: [],
};

/** Redis giả, đủ cho denylist: chỉ cần get/set/exists trên một Map. */
const fakeRedis = () => {
  const store = new Map<string, string>();

  return {
    store,
    client: {
      get: async (key: string) => store.get(key) ?? null,
      set: async (key: string, value: string) => {
        store.set(key, value);
        return 'OK';
      },
      exists: async (key: string) => (store.has(key) ? 1 : 0),
    } as unknown as Redis,
  };
};

const build = () => {
  const redis = fakeRedis();
  const jwt = new JwtService({
    secret: AUTH.jwtSecret,
    signOptions: { algorithm: 'HS256' },
    verifyOptions: { algorithms: ['HS256'] },
  });

  const service = new TokenService(
    jwt,
    { getOrThrow: () => AUTH } as unknown as ConfigService,
    redis.client,
  );

  return { service, redis, jwt };
};

describe('TokenService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('ký rồi xác minh được access token, giữ nguyên user/session/role', async () => {
    const token = await harness.service.signAccessToken({
      userId: 'user-1',
      sessionId: 'session-1',
      role: 'admin',
    });

    const payload = await harness.service.verifyAccessToken(token);

    expect(payload.sub).toBe('user-1');
    expect(payload.sid).toBe('session-1');
    expect(payload.role).toBe('admin');
  });

  it('token ký bằng khoá khác thì bị từ chối', async () => {
    const foreign = new JwtService({ secret: 'khoa-khac-hoan-toan' });
    const token = await foreign.signAsync({ sub: 'user-1', sid: 'session-1' });

    await expect(harness.service.verifyAccessToken(token)).rejects.toThrow(
      BusinessException,
    );
  });

  it('thu hồi phiên làm access token còn hạn mất hiệu lực ngay', async () => {
    const token = await harness.service.signAccessToken({
      userId: 'user-1',
      sessionId: 'session-1',
      role: 'user',
    });

    await expect(
      harness.service.verifyAccessToken(token),
    ).resolves.toBeDefined();

    await harness.service.revokeSession('session-1');

    await expect(harness.service.verifyAccessToken(token)).rejects.toMatchObject(
      { code: 'SESSION_REVOKED' },
    );
  });

  it('đăng xuất mọi nơi vô hiệu hoá token phát trước đó nhưng không chặn token mới', async () => {
    const old = await harness.service.signAccessToken({
      userId: 'user-1',
      sessionId: 'session-1',
      role: 'user',
    });

    // Mốc thu hồi tính bằng giây nên đẩy `iat` của token cũ lùi lại một giây, đúng như
    // khi người dùng bấm "đăng xuất mọi nơi" sau khi đã đăng nhập từ trước.
    harness.redis.store.set(
      'auth:revoked:user:user-1',
      String(Math.floor(Date.now() / 1000) + 1),
    );

    await expect(harness.service.verifyAccessToken(old)).rejects.toMatchObject({
      code: 'SESSION_REVOKED',
    });
  });

  it('refresh token mỗi lần sinh một khác và chỉ lưu dạng hash', () => {
    const first = harness.service.createRefreshToken();
    const second = harness.service.createRefreshToken();

    expect(first.token).not.toBe(second.token);
    expect(first.hash).toHaveLength(64);
    expect(first.hash).not.toContain(first.token);
    expect(harness.service.hashRefreshToken(first.token)).toBe(first.hash);
  });

  it('so khớp hash đúng token, từ chối token khác và giá trị rỗng', () => {
    const { token, hash } = harness.service.createRefreshToken();
    const other = harness.service.createRefreshToken();

    expect(harness.service.matchesHash(token, hash)).toBe(true);
    expect(harness.service.matchesHash(other.token, hash)).toBe(false);
    expect(harness.service.matchesHash(token, null)).toBe(false);
  });
});
