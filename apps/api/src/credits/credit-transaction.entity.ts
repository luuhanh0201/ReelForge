import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../auth/user.entity.js';

/** Toàn bộ cách số dư có thể thay đổi — không có đường nào khác. */
export type CreditTxType =
  | 'signup_bonus'
  | 'purchase'
  | 'render_charge'
  | 'tts_extra'
  | 'refund'
  | 'admin_grant'
  | 'admin_deduct';

export const CREDIT_TX_TYPES: readonly CreditTxType[] = [
  'signup_bonus',
  'purchase',
  'render_charge',
  'tts_extra',
  'refund',
  'admin_grant',
  'admin_deduct',
];

/**
 * Sổ cái credit — **chỉ thêm, không bao giờ sửa hay xoá**.
 *
 * `users.credits` là số dư đọc nhanh; bảng này là bằng chứng vì sao nó ra con số đó. Khi
 * số dư sai lệch, đây là nơi duy nhất truy được nguyên nhân.
 */
@Entity('credit_transactions')
@Check(
  'chk_credit_tx_type',
  `"type" IN ('signup_bonus', 'purchase', 'render_charge', 'tts_extra', 'refund', 'admin_grant', 'admin_deduct')`,
)
export class CreditTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_credit_tx_user')
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'varchar', length: 30 })
  type!: CreditTxType;

  /** Âm khi trừ, dương khi cộng. */
  @Column({ type: 'integer' })
  amount!: number;

  /** Số dư sau giao dịch — để đối soát và hiện lịch sử mà không phải tính luỹ kế. */
  @Column({ name: 'balance_after', type: 'integer' })
  balanceAfter!: number;

  /**
   * Trỏ tới thứ gây ra giao dịch (`render`, `order`...). Cặp `ref_type` + `ref_id` là
   * **duy nhất**: cùng một lần xuất video gọi lại hai lần cũng chỉ trừ tiền một lần.
   */
  @Column({ name: 'ref_type', type: 'varchar', length: 30, nullable: true })
  refType!: string | null;

  @Column({ name: 'ref_id', type: 'uuid', nullable: true })
  refId!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
