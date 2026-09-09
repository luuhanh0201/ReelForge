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
import type { DeviceType } from './device-parser.js';
import { User } from './user.entity.js';

/** Vì sao phiên bị chấm dứt — hiện thẳng trên trang quản lý thiết bị. */
export type SessionRevokedReason =
  | 'logout'
  | 'logout_all'
  | 'admin_revoke'
  | 'reuse_detected'
  | 'max_sessions'
  | 'idle_timeout'
  | 'account_suspended';

export const SESSION_REVOKED_REASONS: readonly SessionRevokedReason[] = [
  'logout',
  'logout_all',
  'admin_revoke',
  'reuse_detected',
  'max_sessions',
  'idle_timeout',
  'account_suspended',
];

/**
 * Một dòng = một thiết bị đang đăng nhập.
 *
 * Refresh token **không bao giờ được lưu nguyên văn** — chỉ giữ hash SHA-256, nên kể cả
 * khi lộ toàn bộ bảng này thì cũng không ai đăng nhập lại được bằng dữ liệu đọc trộm.
 */
@Entity('user_sessions')
@Check(
  'chk_user_sessions_device_type',
  `"device_type" IN ('desktop', 'mobile', 'tablet', 'unknown')`,
)
@Check(
  'chk_user_sessions_revoked_reason',
  `"revoked_reason" IS NULL OR "revoked_reason" IN ('logout', 'logout_all', 'admin_revoke', 'reuse_detected', 'max_sessions', 'idle_timeout', 'account_suspended')`,
)
export class UserSession {
  /** Chính là `sid` trong access token. */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_user_sessions_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Index('uq_user_sessions_refresh_token_hash', { unique: true })
  @Column({ name: 'refresh_token_hash', type: 'varchar', length: 64 })
  refreshTokenHash!: string;

  /**
   * Hash của token ngay trước lần xoay gần nhất. Còn giữ lại để phân biệt hai tình huống:
   * nhiều tab cùng refresh trong cửa sổ ân hạn (hợp lệ) và token bị đánh cắp dùng lại
   * sau đó (tấn công → thu hồi cả phiên).
   */
  @Column({
    name: 'previous_token_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  previousTokenHash!: string | null;

  @Column({ name: 'rotated_at', type: 'timestamptz', nullable: true })
  rotatedAt!: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  /** Lần cuối phiên này đổi refresh token — nguồn cho cột "hoạt động lần cuối". */
  @Column({ name: 'last_used_at', type: 'timestamptz' })
  lastUsedAt!: Date;

  @Index('idx_user_sessions_revoked_at')
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({
    name: 'revoked_reason',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  revokedReason!: SessionRevokedReason | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 400, nullable: true })
  userAgent!: string | null;

  /*
   * Thông tin thiết bị được bóc sẵn lúc mở phiên thay vì tính lại từ `user_agent` mỗi lần
   * đọc: đây vừa là thứ hiển thị cho người dùng, vừa là căn cứ nhận diện thiết bị lạ.
   * Giữ nguyên giá trị đã ghi kể cả khi logic bóc tách sau này thay đổi.
   */
  @Column({ type: 'varchar', length: 60, nullable: true })
  browser!: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  os!: string | null;

  @Column({ name: 'device_type', type: 'varchar', length: 20, default: 'unknown' })
  deviceType!: DeviceType;

  /** Phiên này mở từ một tổ hợp trình duyệt + hệ điều hành chưa từng thấy ở tài khoản. */
  @Column({ name: 'is_new_device', type: 'boolean', default: false })
  isNewDevice!: boolean;

  /** IP lúc mở phiên — giữ lại để đối chiếu khi điều tra, không dùng để nhận diện thiết bị. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  ip!: string | null;

  /** IP của lần refresh gần nhất; khác `ip` thì phiên đã đổi mạng giữa chừng. */
  @Column({ name: 'last_ip', type: 'varchar', length: 64, nullable: true })
  lastIp!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
