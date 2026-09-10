import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Một bản ghi = một **phiên bản đã xuất bản** của một tour.
 *
 * Giữ lịch sử thay vì ghi đè một dòng, giống `landing_settings`: sửa nhầm lời hướng dẫn
 * rồi xuất bản thì còn bản trước để quay lại. Bản đang chạy là bản mới nhất theo `key`.
 */
@Entity('tours')
@Index('idx_tours_key_published', ['key', 'publishedAt'])
export class TourVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Khoá khu vực, khớp `TOUR_SCOPES` trong `@repo/shared`. */
  @Column({ type: 'varchar', length: 60 })
  key!: string;

  /** Hình dạng do `TourSchema` quyết định; giữ nguyên văn để thêm tuỳ chọn không phải migrate. */
  @Column({ type: 'jsonb' })
  config!: Record<string, unknown>;

  @CreateDateColumn({ name: 'published_at', type: 'timestamptz' })
  publishedAt!: Date;

  @Column({ name: 'published_by', type: 'varchar', length: 120 })
  publishedBy!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  note!: string | null;
}
