import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Một bản ghi = một **phiên bản đã xuất bản** của Landing Page.
 *
 * Giữ lịch sử thay vì ghi đè một dòng: xuất bản nhầm thì còn bản trước để quay lại.
 * Bản đang chạy là bản có `published_at` mới nhất.
 */
@Entity('landing_settings')
export class LandingSetting {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'jsonb' })
  config!: Record<string, unknown>;

  @Index('idx_landing_settings_published_at')
  @CreateDateColumn({ name: 'published_at', type: 'timestamptz' })
  publishedAt!: Date;

  /** Chưa có auth nên tạm là 'local-admin'. */
  @Column({ name: 'published_by', type: 'varchar', length: 80 })
  publishedBy!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  note!: string | null;
}
