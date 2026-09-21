import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Nền cho việc sinh clip bằng AI.
 *
 * Ba thay đổi, đều là điều kiện cần trước khi gọi bất kỳ nhà cung cấp nào:
 *
 * 1. **Bảng `generation_jobs`** — sinh một clip mất 1–5 phút, không giữ trong một request
 *    được. Job sống độc lập với tab trình duyệt: người dùng đóng máy rồi quay lại vẫn thấy
 *    kết quả.
 * 2. **`media_assets.origin` nhận `'generated'`** — clip AI là một loại tài nguyên thứ ba,
 *    khác cả ảnh cào về lẫn file người dùng tự tải lên.
 * 3. **`credit_transactions.type` nhận `'ai_clip_charge'`** — clip AI tính tiền theo giây,
 *    không phải theo lần xuất như `render_charge`. Tách ra để đối soát được từng nguồn chi.
 *
 * `prompt`, `provider`, `provider_job_id` và `credits_charged` lưu lại để dựng lại được clip
 * và để đối chiếu với hoá đơn của nhà cung cấp — thiếu chúng thì tháng sau không ai biết
 * khoản tiền đó đến từ đâu.
 */
export class GenerationJobs1789500000000 implements MigrationInterface {
  name = 'GenerationJobs1789500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "generation_jobs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "line_index" integer NOT NULL,
        "kind" character varying(20) NOT NULL,
        "model_id" character varying(60) NOT NULL,
        "prompt" text NOT NULL,
        "source_asset_id" uuid,
        "status" character varying(20) NOT NULL DEFAULT 'queued',
        "provider_job_id" character varying(200),
        "asset_id" uuid,
        "duration_sec" integer NOT NULL,
        "credits_charged" integer NOT NULL DEFAULT 0,
        "error" character varying(300),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "finished_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "pk_generation_jobs" PRIMARY KEY ("id"),
        CONSTRAINT "chk_generation_jobs_kind"
          CHECK ("kind" IN ('image_to_video', 'text_to_video', 'avatar')),
        CONSTRAINT "chk_generation_jobs_status"
          CHECK ("status" IN ('queued', 'running', 'succeeded', 'failed', 'canceled')),
        CONSTRAINT "chk_generation_jobs_duration" CHECK ("duration_sec" > 0),
        CONSTRAINT "fk_generation_jobs_project"
          FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE
      )
    `);

    // Truy vấn chạy nhiều nhất: job đang chờ của một dự án, để giao diện hỏi trạng thái.
    await queryRunner.query(
      `CREATE INDEX "idx_generation_jobs_project" ON "generation_jobs" ("project_id", "created_at" DESC)`,
    );
    // Trần chi tiêu mỗi ngày đếm theo người dùng.
    await queryRunner.query(
      `CREATE INDEX "idx_generation_jobs_user_day" ON "generation_jobs" ("user_id", "created_at" DESC)`,
    );

    await queryRunner.query(
      `ALTER TABLE "media_assets" DROP CONSTRAINT "chk_media_assets_origin"`,
    );
    await queryRunner.query(
      `ALTER TABLE "media_assets" ADD CONSTRAINT "chk_media_assets_origin" CHECK ("origin" IN ('crawled', 'uploaded', 'generated'))`,
    );

    await queryRunner.query(
      `ALTER TABLE "credit_transactions" DROP CONSTRAINT "chk_credit_tx_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "credit_transactions" ADD CONSTRAINT "chk_credit_tx_type" CHECK ("type" IN ('signup_bonus', 'purchase', 'render_charge', 'tts_extra', 'ai_clip_charge', 'refund', 'admin_grant', 'admin_deduct'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Giao dịch đã ghi thì không xoá: sổ cái chỉ thêm, không sửa. Siết lại ràng buộc mà còn
    // bản ghi loại mới thì lệnh này hỏng — và đó là cảnh báo đúng, không phải lỗi.
    await queryRunner.query(
      `ALTER TABLE "credit_transactions" DROP CONSTRAINT "chk_credit_tx_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "credit_transactions" ADD CONSTRAINT "chk_credit_tx_type" CHECK ("type" IN ('signup_bonus', 'purchase', 'render_charge', 'tts_extra', 'refund', 'admin_grant', 'admin_deduct'))`,
    );

    await queryRunner.query(`DELETE FROM "media_assets" WHERE "origin" = 'generated'`);
    await queryRunner.query(
      `ALTER TABLE "media_assets" DROP CONSTRAINT "chk_media_assets_origin"`,
    );
    await queryRunner.query(
      `ALTER TABLE "media_assets" ADD CONSTRAINT "chk_media_assets_origin" CHECK ("origin" IN ('crawled', 'uploaded'))`,
    );

    await queryRunner.query(`DROP TABLE "generation_jobs"`);
  }
}
