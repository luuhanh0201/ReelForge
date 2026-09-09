import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { AuthService } from './../src/auth/auth.service.js';
import {
  GoogleOAuthService,
  type GoogleProfile,
} from './../src/auth/google-oauth.service.js';
import { User } from './../src/auth/user.entity.js';
import { UserSession } from './../src/auth/user-session.entity.js';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

/**
 * Luồng đăng nhập đầu-cuối, chỉ thay đúng một mảnh: việc đổi code với Google.
 * Mọi thứ còn lại — guard, cookie, xoay token, thu hồi — chạy thật trên database thật.
 */
const TEST_EMAIL = `e2e-${Date.now()}@reelforge.test`;

const PROFILE: GoogleProfile = {
  sub: `google-e2e-${Date.now()}`,
  email: TEST_EMAIL,
  emailVerified: true,
  name: 'Người Dùng E2E',
  avatarUrl: null,
};

/** Bóc một cookie ra khỏi header Set-Cookie. */
const readCookie = (response: request.Response, name: string): string | null => {
  const raw = response.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const entry = list.find((cookie) => cookie.startsWith(`${name}=`));
  if (!entry) return null;

  const value = entry.split(";")[0]!.slice(name.length + 1);
  return value === '' ? null : value;
};

const cookieAttributes = (
  response: request.Response,
  name: string,
): string[] => {
  const raw = response.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const entry = list.find((cookie) => cookie.startsWith(`${name}=`));

  return entry ? entry.split(';').map((part) => part.trim()) : [];
};

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let users: Repository<User>;
  let sessions: Repository<UserSession>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GoogleOAuthService)
      .useValue({ exchangeCode: async () => PROFILE })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();

    users = moduleFixture.get(getRepositoryToken(User));
    sessions = moduleFixture.get(getRepositoryToken(UserSession));
  });

  afterAll(async () => {
    // Dọn sạch dấu vết của test — database này cũng là database đang phát triển.
    const user = await users.findOne({ where: { email: TEST_EMAIL } });
    if (user) {
      await sessions.delete({ userId: user.id });
      await users.delete({ id: user.id });
    }

    await app.close();
  });

  it('chặn endpoint quản trị khi chưa đăng nhập', async () => {
    const response = await request(app.getHttpServer()).get('/admin/voices');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  it('đăng nhập Google phát cookie HttpOnly và không lộ token ra thân phản hồi', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/google')
      .send({ code: 'ma-gia-cho-test' })
      .expect(200);

    expect(response.body.user.email).toBe(TEST_EMAIL);
    expect(JSON.stringify(response.body)).not.toContain('rf_at');
    expect(response.body.accessToken).toBeUndefined();

    const accessAttributes = cookieAttributes(response, 'rf_at');
    expect(accessAttributes).toContain('HttpOnly');
    expect(accessAttributes).toContain('SameSite=Lax');
    expect(accessAttributes).toContain('Path=/');

    // Refresh token bị giới hạn đường đi, không gửi kèm mọi request thường.
    expect(cookieAttributes(response, 'rf_rt')).toContain('Path=/auth');
  });

  it('cookie phiên mở được /auth/me nhưng vai user không vào được khu quản trị', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/google')
      .send({ code: 'ma-gia-cho-test' });

    const accessCookie = `rf_at=${readCookie(login, 'rf_at')}`;

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', accessCookie)
      .expect(200);
    expect(me.body.user.email).toBe(TEST_EMAIL);
    expect(me.body.user.role).toBe('user');

    await request(app.getHttpServer())
      .get('/admin/voices')
      .set('Cookie', accessCookie)
      .expect(403);
  });

  it('refresh xoay token, và token đã xoay dùng lại thì cả phiên bị thu hồi', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/google')
      .send({ code: 'ma-gia-cho-test' });

    const firstRefresh = readCookie(login, 'rf_rt')!;

    const refreshed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `rf_rt=${firstRefresh}`)
      .expect(200);

    const secondRefresh = readCookie(refreshed, 'rf_rt')!;
    expect(secondRefresh).not.toBe(firstRefresh);

    // Đẩy mốc xoay ra ngoài cửa sổ ân hạn để mô phỏng token cũ bị đánh cắp.
    const user = await users.findOne({ where: { email: TEST_EMAIL } });
    await sessions.update(
      { userId: user!.id },
      { rotatedAt: new Date(Date.now() - 5 * 60_000) },
    );

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `rf_rt=${firstRefresh}`)
      .expect(401);

    // Token mới cũng chết theo vì cả phiên đã bị đóng.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `rf_rt=${secondRefresh}`)
      .expect(401);
  });

  it('đăng xuất thu hồi phiên và xoá cookie', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/google')
      .send({ code: 'ma-gia-cho-test' });

    const accessCookie = `rf_at=${readCookie(login, 'rf_at')}`;

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', accessCookie)
      .expect(204);

    // Access token cũ tuy còn hạn nhưng đã nằm trong denylist.
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', accessCookie)
      .expect(401);
  });

  it('tài khoản bị khoá mất quyền ngay lập tức dù access token còn hạn', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/google')
      .send({ code: 'ma-gia-cho-test' });

    const accessCookie = `rf_at=${readCookie(login, 'rf_at')}`;
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', accessCookie)
      .expect(200);

    await users.update({ email: TEST_EMAIL }, { status: 'suspended' });

    const blocked = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', accessCookie);

    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('ACCOUNT_SUSPENDED');

    await users.update({ email: TEST_EMAIL }, { status: 'active' });
  });

  it('lưu thông tin thiết bị và đánh dấu thiết bị lạ ở lần đăng nhập từ máy khác', async () => {
    const chrome =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    const iphone =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

    const first = await request(app.getHttpServer())
      .post('/auth/google')
      .set('User-Agent', chrome)
      .send({ code: 'ma-gia-cho-test' });

    const sessions = await request(app.getHttpServer())
      .get('/auth/sessions')
      .set('Cookie', `rf_at=${readCookie(first, 'rf_at')}`)
      .expect(200);

    const current = sessions.body.items.find(
      (item: { current: boolean }) => item.current,
    );
    expect(current.browser).toBe('Chrome');
    expect(current.os).toBe('Windows');
    expect(current.deviceType).toBe('desktop');
    expect(current.deviceLabel).toBe('Chrome trên Windows');
    expect(current.ip).not.toBeNull();

    // Đăng nhập từ một tổ hợp trình duyệt + hệ điều hành chưa từng thấy → thiết bị lạ.
    const second = await request(app.getHttpServer())
      .post('/auth/google')
      .set('User-Agent', iphone)
      .send({ code: 'ma-gia-cho-test' });

    const afterSecond = await request(app.getHttpServer())
      .get('/auth/sessions')
      .set('Cookie', `rf_at=${readCookie(second, 'rf_at')}`)
      .expect(200);

    const newest = afterSecond.body.items.find(
      (item: { current: boolean }) => item.current,
    );
    expect(newest.browser).toBe('Safari');
    expect(newest.os).toBe('iOS');
    expect(newest.deviceType).toBe('mobile');
    expect(newest.isNewDevice).toBe(true);
  });

  it('endpoint công khai vẫn mở: landing page không bao giờ bị auth chặn', async () => {
    await request(app.getHttpServer()).get('/landing-config').expect(200);
    await request(app.getHttpServer()).get('/health').expect(200);
  });

  /**
   * `AuthService` được lấy ra để dựng sẵn một phiên admin: `signInWithGoogle` đi qua
   * đúng luồng thật, chỉ khác là vai được nâng trước khi mở phiên.
   */
  it('vai admin vào được khu quản trị', async () => {
    const auth = app.get(AuthService);

    await users.update({ email: TEST_EMAIL }, { role: 'admin' });
    const issued = await auth.signInWithGoogle(PROFILE, {
      userAgent: 'vitest',
      ip: '127.0.0.1',
    });

    await request(app.getHttpServer())
      .get('/admin/users')
      .set('Cookie', `rf_at=${issued.accessToken}`)
      .expect(200);

    await users.update({ email: TEST_EMAIL }, { role: 'user' });
  });
});
