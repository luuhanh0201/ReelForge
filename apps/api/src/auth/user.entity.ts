import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * `user` là khách hàng ngoài; ba vai còn lại là nhân sự nội bộ, khớp với `ROLE_LABEL`
 * ở `apps/web/config/admin/accounts.config.ts`.
 */
export type UserRole = 'user' | 'viewer' | 'editor' | 'admin';
export type UserStatus = 'active' | 'suspended';
/** Bốn gói cước, thứ tự từ thấp lên cao. `free` là gói của mọi tài khoản mới. */
export type UserPlan = 'free' | 'advanced' | 'plus' | 'premium';

export const USER_ROLES: readonly UserRole[] = [
  'user',
  'viewer',
  'editor',
  'admin',
];

/** Vai được phép vào khu quản trị. `user` thường không nằm trong nhóm này. */
export const STAFF_ROLES: readonly UserRole[] = ['viewer', 'editor', 'admin'];

@Entity('users')
@Check('chk_users_role', `"role" IN ('user', 'viewer', 'editor', 'admin')`)
@Check('chk_users_status', `"status" IN ('active', 'suspended')`)
@Check('chk_users_plan', `"plan" IN ('free', 'advanced', 'plus', 'premium')`)
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('uq_users_email', { unique: true })
  @Column({ type: 'varchar', length: 320 })
  email!: string;

  /** Google đã xác minh email này chưa. Chưa xác minh thì không cho đăng nhập. */
  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified!: boolean;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl!: string | null;

  /**
   * Định danh ổn định của Google (`sub`). Khoá đối chiếu là cột này chứ **không phải
   * email** — người dùng đổi được email Google, và email cũ có thể rơi vào tay người khác.
   */
  @Index('uq_users_google_sub', { unique: true })
  @Column({ name: 'google_sub', type: 'varchar', length: 64, nullable: true })
  googleSub!: string | null;

  /** Để trống ở đợt này; dành sẵn cho đăng nhập bằng email/mật khẩu sau. */
  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash!: string | null;

  @Index('idx_users_role')
  @Column({ type: 'varchar', length: 20, default: 'user' })
  role!: UserRole;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: UserStatus;

  @Column({ type: 'varchar', length: 20, default: 'free' })
  plan!: UserPlan;

  @Column({ type: 'integer', default: 0 })
  credits!: number;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
