import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { User } from './../src/auth/user.entity.js';
import { CreditTransaction } from './../src/credits/credit-transaction.entity.js';
import { CreditsService } from './../src/credits/credits.service.js';

/**
 * Sổ cái credit chạy thật trên database thật.
 *
 * Đây là phần đụng tiền nên phải kiểm tra bằng database thật chứ không phải repository
 * giả: khoá hàng, ràng buộc unique và transaction là những thứ chỉ tồn tại ở tầng Postgres.
 */
const EMAIL = `e2e-credit-${Date.now()}@reelforge.test`;

describe('CreditsService (e2e)', () => {
  let app: INestApplication<App>;
  let credits: CreditsService;
  let users: Repository<User>;
  let transactions: Repository<CreditTransaction>;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    credits = moduleFixture.get(CreditsService);
    users = moduleFixture.get(getRepositoryToken(User));
    transactions = moduleFixture.get(getRepositoryToken(CreditTransaction));

    const user = await users.save(
      users.create({
        email: EMAIL,
        emailVerified: true,
        name: 'Người Dùng Credit',
        avatarUrl: null,
        googleSub: `google-credit-${Date.now()}`,
        passwordHash: null,
        role: 'user',
        status: 'active',
        plan: 'free',
        credits: 0,
      }),
    );
    userId = user.id;
  });

  afterAll(async () => {
    await transactions.delete({ userId });
    await users.delete({ id: userId });
    await app.close();
  });

  it('cộng credit ghi đúng số dư và một dòng sổ cái', async () => {
    const result = await credits.apply({
      userId,
      amount: 50,
      type: 'purchase',
      note: 'Mua gói thử',
    });

    expect(result).toEqual({ balance: 50, applied: true });

    const user = await users.findOne({ where: { id: userId } });
    expect(user?.credits).toBe(50);

    const rows = await transactions.find({ where: { userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.balanceAfter).toBe(50);
  });

  it('trừ credit ghi số âm và số dư sau giao dịch', async () => {
    const result = await credits.apply({
      userId,
      amount: -20,
      type: 'render_charge',
    });

    expect(result.balance).toBe(30);

    const rows = await transactions.find({
      where: { userId, type: 'render_charge' },
    });
    expect(rows[0]?.amount).toBe(-20);
    expect(rows[0]?.balanceAfter).toBe(30);
  });

  /** Không có chốt này thì một lần xuất video hỏng giữa chừng có thể làm số dư âm. */
  it('không cho số dư xuống dưới 0', async () => {
    await expect(
      credits.apply({ userId, amount: -1000, type: 'render_charge' }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDIT' });

    const user = await users.findOne({ where: { id: userId } });
    expect(user?.credits).toBe(30);
  });

  /** Mạng chập chờn khiến client gọi lại là chuyện thường; tiền không được trừ hai lần. */
  it('cùng một ref chỉ ghi một lần dù gọi lại nhiều lần', async () => {
    const refId = '22222222-2222-4222-8222-222222222222';

    const first = await credits.apply({
      userId,
      amount: -1,
      type: 'render_charge',
      refType: 'render',
      refId,
    });
    const second = await credits.apply({
      userId,
      amount: -1,
      type: 'render_charge',
      refType: 'render',
      refId,
    });

    expect(first).toEqual({ balance: 29, applied: true });
    expect(second).toEqual({ balance: 29, applied: false });

    const rows = await transactions.find({ where: { refType: 'render', refId } });
    expect(rows).toHaveLength(1);
  });

  it('hai lần trừ song song không làm số dư sai', async () => {
    const before = (await users.findOne({ where: { id: userId } }))!.credits;

    await Promise.all(
      Array.from({ length: 5 }, () =>
        credits.apply({ userId, amount: -2, type: 'render_charge' }),
      ),
    );

    const after = (await users.findOne({ where: { id: userId } }))!.credits;
    expect(after).toBe(before - 10);
  });

  it('số dư luôn khớp tổng sổ cái', async () => {
    const drift = await credits.findDrift();
    expect(drift.find((row) => row.userId === userId)).toBeUndefined();
  });

  it('từ chối số lượng bằng 0 hoặc không phải số nguyên', async () => {
    await expect(
      credits.apply({ userId, amount: 0, type: 'admin_grant' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

    await expect(
      credits.apply({ userId, amount: 1.5, type: 'admin_grant' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('credit dùng thử chỉ tặng một lần cho mỗi tài khoản', async () => {
    const fresh = await users.save(
      users.create({
        email: `bonus-${Date.now()}@reelforge.test`,
        emailVerified: true,
        name: 'Tài Khoản Mới',
        avatarUrl: null,
        googleSub: `google-bonus-${Date.now()}`,
        passwordHash: null,
        role: 'user',
        status: 'active',
        plan: 'free',
        credits: 0,
      }),
    );

    const first = await credits.grantSignupBonus(fresh.id);
    const second = await credits.grantSignupBonus(fresh.id);

    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(second.balance).toBe(first.balance);

    await transactions.delete({ userId: fresh.id });
    await users.delete({ id: fresh.id });
  });
});
