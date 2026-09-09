import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import type { Repository } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { User } from './../src/auth/user.entity.js';
import { UserSession } from './../src/auth/user-session.entity.js';
import { UserToken } from './../src/auth/user-token.entity.js';
import { CreditTransaction } from './../src/credits/credit-transaction.entity.js';
import { AccountMailService } from './../src/mail/account-mail.service.js';

/**
 * Luồng đăng ký bằng email chạy thật trên database thật.
 * Chỉ thay đúng một mảnh: việc gửi mail — thay bằng bộ nhớ tạm để đọc lại token.
 */
const HANDLE = `e2e-mail-${Date.now()}`;
const EMAIL = `${HANDLE}@gmail.com`;
const PASSWORD = 'mat-khau-du-dai';

/** Hộp thư giả: giữ token của lần gửi gần nhất theo từng loại mail. */
const outbox = {
  verification: null as string | null,
  reset: null as string | null,
};

const readCookie = (response: request.Response, name: string): string | null => {
  const raw = response.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const entry = list.find((cookie) => cookie.startsWith(`${name}=`));
  if (!entry) return null;

  const value = entry.split(';')[0]!.slice(name.length + 1);
  return value === '' ? null : value;
};

describe('Đăng ký bằng email (e2e)', () => {
  let app: INestApplication<App>;
  let users: Repository<User>;
  let sessions: Repository<UserSession>;
  let tokens: Repository<UserToken>;
  let credits: Repository<CreditTransaction>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AccountMailService)
      .useValue({
        sendEmailVerification: async (_user: User, token: string) => {
          outbox.verification = token;
        },
        sendPasswordReset: async (_user: User, token: string) => {
          outbox.reset = token;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();

    users = moduleFixture.get(getRepositoryToken(User));
    sessions = moduleFixture.get(getRepositoryToken(UserSession));
    tokens = moduleFixture.get(getRepositoryToken(UserToken));
    credits = moduleFixture.get(getRepositoryToken(CreditTransaction));
  });

  afterAll(async () => {
    const user = await users.findOne({ where: { email: EMAIL } });
    if (user) {
      await sessions.delete({ userId: user.id });
      await tokens.delete({ userId: user.id });
      await credits.delete({ userId: user.id });
      await users.delete({ id: user.id });
    }

    await app.close();
  });

  it('đăng ký nhận 202 và KHÔNG cấp phiên đăng nhập ngay', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      // Gõ thiếu đuôi @gmail.com vẫn phải ra đúng tài khoản đó.
      .send({
        email: HANDLE,
        password: PASSWORD,
        name: 'Người Dùng E2E',
        acceptedTerms: true,
      })
      .expect(202);

    expect(response.headers['set-cookie']).toBeUndefined();

    const user = await users.findOne({ where: { email: EMAIL } });
    expect(user?.emailVerified).toBe(false);
    // Credit dùng thử chỉ về sau khi xác minh email (FR-A3) — tài khoản chưa xác minh
    // cũng chưa đăng nhập được nên không có gì để tiêu.
    expect(user?.credits).toBe(0);
    expect(outbox.verification).toBeTruthy();
  });

  it('không cho đăng ký khi chưa tích đồng ý điều khoản', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `khac-${HANDLE}`,
        password: PASSWORD,
        name: 'Ai Đó',
        acceptedTerms: false,
      });

    expect(response.status).toBe(400);
  });

  it('chặn đăng ký trùng email', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: EMAIL,
        password: PASSWORD,
        name: 'Người Dùng E2E',
        acceptedTerms: true,
      });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('chưa xác minh email thì chưa đăng nhập được', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('xác minh email xong thì đăng nhập được và nhận cookie phiên', async () => {
    await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ token: outbox.verification })
      .expect(200);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: HANDLE, password: PASSWORD })
      .expect(200);

    expect(login.body.user.email).toBe(EMAIL);
    expect(readCookie(login, 'rf_at')).toBeTruthy();
    expect(readCookie(login, 'rf_rt')).toBeTruthy();

    // Xác minh xong mới có credit dùng thử, và nó đi qua sổ cái chứ không gán thẳng.
    expect(login.body.user.credits).toBe(10);
  });

  it('token xác minh chỉ dùng được một lần', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ token: outbox.verification });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_TOKEN');
  });

  it('sai mật khẩu và email không tồn tại trả về cùng một lỗi', async () => {
    const wrongPassword = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: 'sai-mat-khau-roi' });

    const unknownEmail = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `khong-ton-tai-${Date.now()}`, password: PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.code).toBe(unknownEmail.body.code);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });

  it('quên mật khẩu trả 202 kể cả với email không tồn tại', async () => {
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: `khong-ton-tai-${Date.now()}` })
      .expect(202);

    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: EMAIL })
      .expect(202);

    expect(outbox.reset).toBeTruthy();
  });

  it('đặt lại mật khẩu đổi được mật khẩu và đóng mọi phiên đang mở', async () => {
    const before = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);

    const oldAccess = readCookie(before, 'rf_at')!;

    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: outbox.reset, password: 'mat-khau-moi-du-dai' })
      .expect(200);

    // Phiên cũ bị thu hồi ngay, không chờ access token hết hạn.
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', `rf_at=${oldAccess}`)
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: 'mat-khau-moi-du-dai' })
      .expect(200);
  });

  it('từ chối mật khẩu quá ngắn khi đăng ký', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `ngan-${HANDLE}`,
        password: 'ngan',
        name: 'Ai Đó',
        acceptedTerms: true,
      });

    expect(response.status).toBe(400);
  });
});
