import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bố cục xem trước tách ra khỏi kiểu chữ, và lưu riêng cho từng khổ video.
 *
 * Trước đây vị trí phụ đề nằm ở `subtitle_style.positionY` — một con số duy nhất dùng cho
 * cả ba khổ. Kéo phụ đề lên cho vừa khung dọc xong đổi sang 16:9 là chữ nhảy vào giữa mặt
 * sản phẩm, vì 78% chiều cao của hai khổ là hai chỗ hoàn toàn khác nhau.
 *
 * Cột mới giữ cả vị trí lẫn cỡ chữ, khoá theo khổ. Giá trị `positionY` đang có được coi là
 * của **khổ dự án đang dùng** — đó là khổ người dùng nhìn thấy lúc họ kéo, nên gán vào đó
 * là đúng ý họ nhất.
 *
 * Khung cắt ảnh (`crop` trong mỗi phần tử của `lines`) không cần backfill: nó được phép
 * vắng mặt và khi vắng thì cảnh dùng khung mặc định, đúng hệt hành vi cũ.
 */
export class FrameLayouts1789012400000 implements MigrationInterface {
  name = 'FrameLayouts1789012400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "projects" ADD "frame_layouts" jsonb NOT NULL DEFAULT '{}'::jsonb`,
    );

    await queryRunner.query(`
      UPDATE "projects"
      SET "frame_layouts" = jsonb_build_object(
        "aspect_ratio",
        jsonb_build_object('subtitleY', "subtitle_style" -> 'positionY', 'fontScale', NULL)
      )
      WHERE jsonb_typeof("subtitle_style" -> 'positionY') = 'number'
    `);

    await queryRunner.query(`
      UPDATE "projects"
      SET "subtitle_style" = "subtitle_style" - 'positionY'
      WHERE "subtitle_style" ? 'positionY'
    `);
  }

  /**
   * Trả `positionY` về từ bố cục của chính khổ dự án đang dùng.
   *
   * Bố cục của hai khổ còn lại không có chỗ để quay về, nên `down` chấp nhận mất chúng —
   * ghi rõ ở đây thay vì để người chạy tự phát hiện.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "projects"
      SET "subtitle_style" = "subtitle_style" || jsonb_build_object(
        'positionY', "frame_layouts" -> "aspect_ratio" -> 'subtitleY'
      )
      WHERE jsonb_typeof("frame_layouts" -> "aspect_ratio" -> 'subtitleY') = 'number'
    `);

    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "frame_layouts"`);
  }
}
