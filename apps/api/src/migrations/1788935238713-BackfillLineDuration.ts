import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Điền `durationMs` cho các cảnh được tạo trước khi trường này tồn tại.
 *
 * `lines` là jsonb nên thêm một trường vào `ProjectLine` **không** tự sửa hàng cũ: dự án
 * dựng trước đó vẫn giữ nguyên hình dạng cũ, và giao diện đọc ra `undefined` rồi hiện
 * `NaN` ở mọi chỗ có thời lượng. Mọi lần mở rộng một cột jsonb đều phải kèm một bước như
 * thế này.
 *
 * 10 giây là giá trị `SECONDS_PER_LINE` mà bộ mẫu kịch bản đang dùng, nên các cảnh cũ giữ
 * đúng độ dài chúng vẫn được hiểu là có.
 */
export class BackfillLineDuration1788935238713 implements MigrationInterface {
  name = 'BackfillLineDuration1788935238713';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "projects"
      SET "lines" = (
        SELECT COALESCE(
          jsonb_agg(
            CASE
              WHEN line ? 'durationMs' THEN line
              ELSE line || '{"durationMs": 10000}'::jsonb
            END
            ORDER BY ordinality
          ),
          '[]'::jsonb
        )
        FROM jsonb_array_elements("lines") WITH ORDINALITY AS t(line, ordinality)
      )
      WHERE jsonb_typeof("lines") = 'array'
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements("lines") AS line
          WHERE NOT (line ? 'durationMs')
        )
    `);
  }

  /**
   * Không có `down`: gỡ lại `durationMs` sẽ đưa dữ liệu về đúng trạng thái hỏng mà
   * migration này sinh ra để sửa, và không phân biệt được cảnh nào vốn đã có sẵn giá trị.
   */
  public async down(): Promise<void> {
    // Cố ý để trống.
  }
}
