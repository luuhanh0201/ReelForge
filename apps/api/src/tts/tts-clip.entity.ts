import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Một đoạn tiếng đã tổng hợp, dùng chung cho **toàn hệ thống**.
 *
 * Đây là cơ chế tiết kiệm chi phí lớn nhất của cả sản phẩm: hai người dùng viết trùng một
 * câu quảng cáo — chuyện rất hay xảy ra vì kịch bản sinh từ cùng một bộ mẫu — thì chỉ tốn
 * tiền Google đúng một lần. Vì vậy bảng này **không gắn với người dùng nào**.
 *
 * Khoá cache có gồm tốc độ đọc, khác với bản nghe thử ở `voice_previews`. Ở đó tốc độ áp
 * bằng `playbackRate` của trình duyệt cho rẻ; ở đây audio sẽ đi thẳng vào file MP4 nên
 * phải đúng tốc độ ngay từ lúc tổng hợp — nếu không, video xuất ra sẽ khác bản người dùng
 * vừa nghe.
 */
@Entity('tts_clips')
export class TtsClip {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** sha256 của giọng + nội dung + tốc độ + tham số model. */
  @Index('uq_tts_clips_hash', { unique: true })
  @Column({ name: 'content_hash', type: 'varchar', length: 64 })
  contentHash!: string;

  @Column({ name: 'voice_id', type: 'uuid' })
  voiceId!: string;

  @Column({ name: 'model_id', type: 'varchar', length: 60 })
  modelId!: string;

  /** Số ký tự Google đã tính tiền, giữ lại để đối soát hoá đơn. */
  @Column({ name: 'char_count', type: 'integer' })
  charCount!: number;

  @Column({ name: 'storage_key', type: 'varchar', length: 500 })
  storageKey!: string;

  /** Đo từ chính dữ liệu PCM, không phải ước lượng — xem `readWavInfo`. */
  @Column({ name: 'duration_ms', type: 'integer' })
  durationMs!: number;

  @Column({ name: 'sample_rate', type: 'integer' })
  sampleRate!: number;

  @Column({ name: 'byte_size', type: 'integer' })
  byteSize!: number;

  /**
   * Để sau này dọn được những đoạn không ai còn dùng. Không cập nhật mỗi lần đọc — chỉ
   * mỗi lần một dự án gắn lại đoạn này — vì cache hit là đường nóng.
   */
  @Column({ name: 'last_used_at', type: 'timestamptz' })
  lastUsedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
