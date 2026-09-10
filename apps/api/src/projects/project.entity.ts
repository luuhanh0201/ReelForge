import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../auth/user.entity.js';

/** `link` — tạo từ link sản phẩm. `manual` — người dùng tự viết nội dung. */
export type ProjectMode = 'link' | 'manual';
export type ProjectStatus = 'draft' | 'ready' | 'archived';
export type AspectRatio = '9:16' | '1:1' | '16:9';
export type Resolution = '720p' | '1080p' | '2k';

/**
 * Một dòng thoại kèm ảnh của nó. Đây chính là một "cảnh" khi dựng video.
 *
 * Lưu thành **mảng dòng rời** chứ không phải một khối văn bản: TTS gọi theo từng dòng nên
 * biết chính xác thời lượng mỗi câu, phụ đề khớp tuyệt đối mà không cần speech-to-text, và
 * sửa một câu chỉ phải đọc lại đúng câu đó.
 */
export interface ProjectLine {
  index: number;
  text: string;
  role: 'hook' | 'usp' | 'cta';
  /** Ảnh gán cho cảnh này; `null` khi người dùng chưa chọn. */
  assetId: string | null;
  /** Các cụm được tô màu nhấn trong phụ đề. */
  emphasis: string[];
  /**
   * Thời lượng cảnh.
   *
   * Người dùng kéo chỉnh được **chừng nào cảnh chưa có tiếng**. Có `voiceClipId` rồi thì
   * giá trị này bằng độ dài file audio cộng đệm và giao diện khoá lại — kéo tay lúc đó sẽ
   * làm chữ lệch tiếng.
   */
  durationMs: number;
  /** Đoạn tiếng đã tổng hợp cho câu này; `null` khi chưa lồng tiếng. */
  voiceClipId: string | null;
}

/**
 * Gốc của cả hai chế độ tạo video.
 *
 * Gom chung một bảng thay vì tách hai là chủ ý: mọi thứ phía sau — kịch bản, phụ đề,
 * render, credit — xử lý giống hệt nhau, chỉ khác cách dữ liệu ban đầu được tạo ra.
 *
 * `aspect_ratio` và `resolution` đặt ở **cấp dự án** chứ không ở cấp lần xuất, vì đổi khổ
 * làm thay đổi cả kích thước ảnh cần resize lẫn bố cục của toàn bộ timeline.
 */
@Entity('projects')
@Check('chk_projects_mode', `"mode" IN ('link', 'manual')`)
@Check('chk_projects_status', `"status" IN ('draft', 'ready', 'archived')`)
@Check('chk_projects_aspect', `"aspect_ratio" IN ('9:16', '1:1', '16:9')`)
@Check('chk_projects_resolution', `"resolution" IN ('720p', '1080p', '2k')`)
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'varchar', length: 10 })
  mode!: ProjectMode;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status!: ProjectStatus;

  @Column({ name: 'aspect_ratio', type: 'varchar', length: 10, default: '9:16' })
  aspectRatio!: AspectRatio;

  @Column({ type: 'varchar', length: 10, default: '1080p' })
  resolution!: Resolution;

  /** Chỉ có ở chế độ `link`. Giữ nguyên link người dùng dán, kể cả link rút gọn. */
  @Column({ name: 'source_url', type: 'varchar', length: 2000, nullable: true })
  sourceUrl!: string | null;

  /** Tên, giá, mô tả sản phẩm — người dùng sửa được mọi trường sau khi lấy về. */
  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  product!: Record<string, unknown>;

  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  lines!: ProjectLine[];

  /** Mã mẫu kịch bản đã dùng, để biết dòng nào sinh ra từ đâu. */
  @Column({ name: 'script_template', type: 'varchar', length: 60, nullable: true })
  scriptTemplate!: string | null;

  /**
   * Kiểu chữ phụ đề người dùng đã chọn.
   *
   * Lưu ở cấp dự án vì nó áp cho cả video; hình dạng do `SubtitleStyleSchema` trong
   * `@repo/shared` quyết định — chỗ này chỉ giữ nguyên văn để không phải migrate mỗi lần
   * thêm một tuỳ chọn kiểu chữ.
   */
  @Column({ name: 'subtitle_style', type: 'jsonb', default: () => `'{}'::jsonb` })
  subtitleStyle!: Record<string, unknown>;

  /**
   * Giọng đọc đã chọn. `null` khi người dùng chưa chọn hoặc giọng đó bị gỡ khỏi danh mục.
   *
   * Không đặt khoá ngoại: admin gỡ một giọng không được phép làm hỏng dự án của khách.
   * Giao diện tự hiểu giá trị không còn trong danh mục là "cần chọn lại".
   */
  @Column({ name: 'voice_id', type: 'uuid', nullable: true })
  voiceId!: string | null;

  /**
   * Tốc độ đọc, 0.8–1.5.
   *
   * Dùng `real` chứ không `numeric` để TypeORM trả về số — cột `numeric` trả chuỗi, và
   * một trường chỉ dùng cho thanh trượt thì không đáng phải ép kiểu ở mọi nơi đọc nó.
   */
  @Column({ name: 'voice_speed', type: 'real', default: 1 })
  voiceSpeed!: number;

  /** Danh sách dự án của một người, mới nhất trước — truy vấn chạy nhiều nhất. */
  @Index('idx_projects_user_recent')
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
