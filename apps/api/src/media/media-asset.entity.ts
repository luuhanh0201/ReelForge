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
import { Project } from '../projects/project.entity.js';

export type MediaOrigin = 'crawled' | 'uploaded';

/** Một bản resize của ảnh gốc, khoá theo chiều rộng đích. */
export interface MediaVariant {
  width: number;
  height: number;
  /** Khoá trên R2, không phải URL — URL có chữ ký được sinh lúc trả về cho máy khách. */
  key: string;
  byteSize: number;
}

/**
 * Ảnh dùng trong video, đã được xử lý lại và đẩy lên R2.
 *
 * Không bao giờ trỏ thẳng tới ảnh gốc trên CDN của sàn: ảnh cross-origin không có header
 * CORS sẽ làm canvas "nhiễm bẩn" và **không xuất được video**. Đi qua R2 cũng cho phép
 * resize một lần rồi dùng lại cho mọi lần render của mọi người dùng.
 */
@Entity('media_assets')
@Check('chk_media_assets_origin', `"origin" IN ('crawled', 'uploaded')`)
export class MediaAsset {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_media_assets_project')
  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project?: Project;

  @Column({ type: 'varchar', length: 20 })
  origin!: MediaOrigin;

  /** Khoá của bản gốc đã được `sharp` xử lý lại (loại payload nhúng trong file ảnh). */
  @Column({ name: 'source_key', type: 'varchar', length: 300 })
  sourceKey!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 40 })
  mimeType!: string;

  @Column({ type: 'integer' })
  width!: number;

  @Column({ type: 'integer' })
  height!: number;

  @Column({ name: 'byte_size', type: 'integer' })
  byteSize!: number;

  /** Các bản resize theo khổ và độ phân giải; sinh thêm khi người dùng đổi khổ video. */
  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  variants!: MediaVariant[];

  /** Link ảnh gốc trên sàn, giữ lại để biết ảnh này từ đâu ra. */
  @Column({ name: 'source_url', type: 'varchar', length: 2000, nullable: true })
  sourceUrl!: string | null;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
