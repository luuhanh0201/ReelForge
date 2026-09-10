import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type TourStatus = 'running' | 'done' | 'skipped';

/**
 * Người dùng đã đi tới đâu trong một tour.
 *
 * `lastStepId` là thứ đáng giá nhất ở đây: gộp lại theo bước sẽ cho biết **người dùng bỏ
 * cuộc ở đâu**, tức bước nào viết chưa rõ. Lưu theo id của bước chứ không phải theo số thứ
 * tự, để thống kê không sai lệch mỗi khi quản trị viên chèn thêm một bước ở giữa.
 */
@Entity('user_tour_state')
@Index('uq_user_tour_state', ['userId', 'tourKey'], { unique: true })
export class UserTourState {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'tour_key', type: 'varchar', length: 60 })
  tourKey!: string;

  @Column({ type: 'varchar', length: 20 })
  status!: TourStatus;

  @Column({ name: 'last_step_id', type: 'varchar', length: 60, nullable: true })
  lastStepId!: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
