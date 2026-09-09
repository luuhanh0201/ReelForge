import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditLogService } from '../audit/audit-log.service.js';
import { User } from '../auth/user.entity.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import {
  CreditTransaction,
  type CreditTxType,
} from './credit-transaction.entity.js';

export interface CreditChange {
  userId: string;
  /** Dương là cộng, âm là trừ. */
  amount: number;
  type: CreditTxType;
  /** Cặp ref chống trừ trùng: cùng một lần xuất video gọi lại chỉ tính một lần. */
  refType?: string;
  refId?: string;
  note?: string;
  ip?: string | null;
}

export interface CreditResult {
  balance: number;
  /** `false` nghĩa là giao dịch này đã được ghi trước đó, số dư giữ nguyên. */
  applied: boolean;
}

/**
 * Credit tặng tài khoản mới. Phải khớp `AUTH_CONFIG.googleBonusCredits` ở web và số
 * credits của gói Free trong bảng giá.
 */
export const SIGNUP_BONUS_CREDITS = 10;

/**
 * Nơi **duy nhất** được phép sửa `users.credits`.
 *
 * Quy tắc này nghe cứng nhắc nhưng cần thiết: khi số dư sai lệch, có đúng một chỗ để tìm
 * nguyên nhân. Không module nào khác được chạy câu lệnh cập nhật số dư.
 */
@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(CreditTransaction)
    private readonly transactions: Repository<CreditTransaction>,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * Ghi một thay đổi số dư.
   *
   * Toàn bộ nằm trong transaction có **khoá hàng người dùng** (`SELECT ... FOR UPDATE`):
   * hai lần xuất video song song không thể cùng đọc số dư cũ rồi cùng trừ, làm số dư âm.
   */
  async apply(change: CreditChange): Promise<CreditResult> {
    if (!Number.isInteger(change.amount) || change.amount === 0) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Số credit thay đổi phải là số nguyên khác 0',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      // Đã ghi rồi thì thôi — chống trừ trùng khi client gọi lại vì mạng chập chờn.
      if (change.refType && change.refId) {
        const existing = await manager.findOne(CreditTransaction, {
          where: { refType: change.refType, refId: change.refId },
        });

        if (existing) {
          return { balance: existing.balanceAfter, applied: false };
        }
      }

      const user = await manager
        .createQueryBuilder(User, 'user')
        .setLock('pessimistic_write')
        .where('user.id = :id', { id: change.userId })
        .getOne();

      if (!user) {
        throw new BusinessException('NOT_FOUND', {
          message: 'Không tìm thấy tài khoản để ghi giao dịch credit',
        });
      }

      const balance = user.credits + change.amount;

      if (balance < 0) {
        throw new BusinessException('INSUFFICIENT_CREDIT', {
          details: { required: Math.abs(change.amount), available: user.credits },
        });
      }

      user.credits = balance;
      await manager.save(user);

      const transaction = manager.create(CreditTransaction, {
        userId: user.id,
        type: change.type,
        amount: change.amount,
        balanceAfter: balance,
        refType: change.refType ?? null,
        refId: change.refId ?? null,
        note: change.note ?? null,
      });
      await manager.save(transaction);

      await this.audit.record({
        action: `credit.${change.type}`,
        target: user.email,
        level: change.amount < 0 ? 'warning' : 'info',
        actor: user.email,
        ip: change.ip ?? null,
        metadata: { amount: change.amount, balanceAfter: balance },
      });

      return { balance, applied: true };
    });
  }

  /**
   * Credit dùng thử cho tài khoản mới.
   *
   * Khoá theo `user` + id tài khoản nên gọi lại bao nhiêu lần cũng chỉ tặng một lần —
   * cần thiết vì đường Google gọi hàm này ở mỗi lần tạo tài khoản, còn đường email gọi
   * ở bước xác minh, và hai đường có thể gặp nhau trên cùng một địa chỉ.
   */
  async grantSignupBonus(userId: string): Promise<CreditResult> {
    return this.apply({
      userId,
      amount: SIGNUP_BONUS_CREDITS,
      type: 'signup_bonus',
      refType: 'user',
      refId: userId,
      note: 'Credit dùng thử cho tài khoản mới',
    });
  }

  async history(userId: string, limit = 50): Promise<CreditTransaction[]> {
    return this.transactions.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  /**
   * Đối chiếu số dư với tổng sổ cái.
   *
   * Giữ số dư dạng số nguyên thay vì tính lại từ lịch sử mỗi lần đọc là đánh đổi có chủ ý;
   * cái giá phải trả là phải có người canh xem hai con số còn khớp nhau không.
   */
  async findDrift(): Promise<
    { userId: string; email: string; balance: number; ledger: number }[]
  > {
    const rows = await this.dataSource.query<
      { user_id: string; email: string; balance: string; ledger: string }[]
    >(`
      SELECT u.id AS user_id,
             u.email,
             u.credits AS balance,
             COALESCE(SUM(t.amount), 0) AS ledger
      FROM users u
      LEFT JOIN credit_transactions t ON t.user_id = u.id
      GROUP BY u.id, u.email, u.credits
      HAVING u.credits <> COALESCE(SUM(t.amount), 0)
    `);

    if (rows.length > 0) {
      this.logger.error(
        `Số dư credit lệch sổ cái ở ${rows.length} tài khoản — cần kiểm tra ngay`,
      );
    }

    return rows.map((row) => ({
      userId: row.user_id,
      email: row.email,
      balance: Number(row.balance),
      ledger: Number(row.ledger),
    }));
  }
}
