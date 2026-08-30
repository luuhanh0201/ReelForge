import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type AuditLevel = 'info' | 'warning' | 'critical';

/**
 * Nhật ký thao tác quản trị. Chỉ ghi mô tả hành động — tuyệt đối không chứa
 * credential, ciphertext hay bất kỳ mẩu bí mật nào.
 */
@Entity('admin_audit_logs')
@Check('chk_admin_audit_logs_level', `"level" IN ('info', 'warning', 'critical')`)
export class AdminAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_admin_audit_logs_occurred_at')
  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  /** Chưa có auth nên tạm là 'local-admin'; thay bằng user id khi có đăng nhập. */
  @Column({ name: 'actor', type: 'varchar', length: 80 })
  actor!: string;

  @Column({ name: 'ip', type: 'varchar', length: 64, nullable: true })
  ip!: string | null;

  @Column({ name: 'action', type: 'varchar', length: 120 })
  action!: string;

  @Column({ name: 'target', type: 'varchar', length: 200 })
  target!: string;

  @Index('idx_admin_audit_logs_level')
  @Column({ name: 'level', type: 'varchar', length: 20 })
  level!: AuditLevel;

  @Column({ name: 'success', type: 'boolean', default: true })
  success!: boolean;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;
}
