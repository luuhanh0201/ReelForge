import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Số dòng đã tổng hợp tiếng của **một người dùng trong một ngày**.
 *
 * `tts_usage` đã đếm theo model để giữ hoá đơn Google trong tầm kiểm soát, nhưng đó là
 * trần của cả hệ thống: một tài khoản lặp vòng vẫn có thể đốt hết hạn mức của mọi người
 * khác trước khi ai đó kịp nhận ra. Bảng này chặn theo từng tài khoản.
 *
 * Chỉ đếm **lần gọi thật sang Google**; lấy lại từ cache không tính, vì nó không tốn gì.
 */
@Entity('user_tts_quota')
@Index('uq_user_tts_quota_day', ['userId', 'day'], { unique: true })
export class UserTtsQuota {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  /** Ngày theo giờ máy chủ, dạng `2026-09-09`. */
  @Column({ type: 'date' })
  day!: string;

  /** Số dòng thoại đã tổng hợp mới. */
  @Column({ type: 'integer', default: 0 })
  lines!: number;

  @Column({ type: 'integer', default: 0 })
  chars!: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
