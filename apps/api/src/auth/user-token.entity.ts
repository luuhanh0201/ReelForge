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
import { User } from './user.entity.js';

export type UserTokenType = 'email_verification' | 'password_reset';

/**
 * Token dùng một lần gửi qua email.
 *
 * Giống refresh token: **chỉ lưu hash SHA-256**, bản gốc chỉ tồn tại trong đường link gửi
 * đi. Đọc trộm được bảng này cũng không dựng lại được link để chiếm tài khoản.
 */
@Entity('user_tokens')
@Check(
  'chk_user_tokens_type',
  `"type" IN ('email_verification', 'password_reset')`,
)
export class UserToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_user_tokens_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'varchar', length: 30 })
  type!: UserTokenType;

  @Index('uq_user_tokens_hash', { unique: true })
  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  /** Đã dùng thì không dùng lại được — chống việc phát tán lại link cũ. */
  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
