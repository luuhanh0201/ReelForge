import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tách cấu hình model theo loại và đổi chi phí thành dữ liệu có cấu trúc.
 *
 * Ba loại model không dùng chung tham số nào: voice cần apiVersion/maxCharsPerRequest,
 * video cần resolution/fps, script cần maxTokens/temperature. Bốn cột phẳng cũ khiến
 * trang nào cũng hiện đủ mọi ô — model video mang `temperature = 0` vô nghĩa, model voice
 * mang `max_tokens = 4096` sai đơn vị (Google TTS giới hạn 5.000 **byte**).
 *
 * Thứ tự bắt buộc: **thêm cột mới → chuyển dữ liệu → mới xoá cột cũ.**
 */
export class ModelConfigAndCost1788108998494 implements MigrationInterface {
  name = 'ModelConfigAndCost1788108998494';

  /** Giá niêm yết tra ngày 2026-08-30, xem `.agent/backend/model-catalog-split.md`. */
  private static readonly COSTS: [string, number, string, number | null][] = [
    ['google-tts', 30, 'per_million_chars', 1_000_000],
    ['runway-gen3', 0.05, 'per_second', null],
    ['sora', 0.1, 'per_second', null],
    ['veo-2', 0.075, 'per_second', null],
    ['luma', 0.04, 'per_second', null],
    ['pika', 0.035, 'per_second', null],
    ['gemini-flash', 0.3, 'per_million_input_tokens', null],
    ['deepseek-v3', 0.27, 'per_million_input_tokens', null],
    ['gpt-4o', 2.5, 'per_million_input_tokens', null],
    ['claude-sonnet', 3, 'per_million_input_tokens', null],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_models" ADD "config" jsonb NOT NULL DEFAULT '{}'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_models" ADD "cost_amount" numeric(12,4) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_models" ADD "cost_unit" character varying(32) NOT NULL DEFAULT 'contract'`,
    );
    await queryRunner.query(`ALTER TABLE "ai_models" ADD "free_tier_amount" numeric(14,2)`);

    // Chuyển cấu hình cũ sang jsonb theo từng loại.
    await queryRunner.query(`
      UPDATE "ai_models" SET "config" = jsonb_build_object(
        'apiEndpoint', coalesce("endpoint", ''),
        'apiVersion', CASE WHEN "api_version" = 'v1beta1' THEN 'v1beta1' ELSE 'v1' END,
        'maxCharsPerRequest', 5000,
        'audioEncoding', 'MP3',
        'defaultSpeakingRate', 1,
        'defaultPitch', 0
      ) WHERE "kind" = 'voice'
    `);

    await queryRunner.query(`
      UPDATE "ai_models" SET "config" = jsonb_build_object(
        'apiEndpoint', coalesce("endpoint", ''),
        'resolution', '1080p',
        'fps', 30,
        'maxDurationSec', 60,
        'aspectRatios', jsonb_build_array('9:16')
      ) WHERE "kind" = 'video'
    `);

    // Script giữ nguyên giá trị cũ vì hai tham số này vốn đúng với LLM.
    await queryRunner.query(`
      UPDATE "ai_models" SET "config" = jsonb_build_object(
        'apiEndpoint', coalesce("endpoint", ''),
        'apiVersion', coalesce(nullif("api_version", ''), 'v1'),
        'maxTokens', greatest(coalesce("max_tokens", 8192), 1),
        'temperature', least(greatest(coalesce("temperature", 0.7), 0), 2),
        'topP', NULL
      ) WHERE "kind" = 'script'
    `);

    for (const [id, amount, unit, freeTier] of ModelConfigAndCost1788108998494.COSTS) {
      await queryRunner.query(
        `UPDATE "ai_models" SET "cost_amount" = $2, "cost_unit" = $3, "free_tier_amount" = $4 WHERE "id" = $1`,
        [id, amount, unit, freeTier],
      );
    }

    await queryRunner.query(
      `ALTER TABLE "ai_models" DROP CONSTRAINT "chk_ai_models_temperature"`,
    );
    await queryRunner.query(`ALTER TABLE "ai_models" DROP COLUMN "cost"`);
    await queryRunner.query(`ALTER TABLE "ai_models" DROP COLUMN "endpoint"`);
    await queryRunner.query(`ALTER TABLE "ai_models" DROP COLUMN "api_version"`);
    await queryRunner.query(`ALTER TABLE "ai_models" DROP COLUMN "max_tokens"`);
    await queryRunner.query(`ALTER TABLE "ai_models" DROP COLUMN "temperature"`);

    await queryRunner.query(
      `ALTER TABLE "ai_models" ADD CONSTRAINT "chk_ai_models_cost_amount" CHECK ("cost_amount" >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_models" ADD CONSTRAINT "chk_ai_models_cost_unit" CHECK ("cost_unit" IN ('per_million_chars', 'per_second', 'per_million_input_tokens', 'contract'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_models" DROP CONSTRAINT "chk_ai_models_cost_unit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_models" DROP CONSTRAINT "chk_ai_models_cost_amount"`,
    );

    await queryRunner.query(
      `ALTER TABLE "ai_models" ADD "cost" character varying(60) NOT NULL DEFAULT 'chưa có giá'`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_models" ADD "endpoint" character varying(300) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_models" ADD "api_version" character varying(40) NOT NULL DEFAULT 'v1'`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_models" ADD "max_tokens" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_models" ADD "temperature" numeric(3,2) NOT NULL DEFAULT 0`,
    );

    // Dựng lại giá trị cũ từ config; chuỗi cost ghép gần đúng từ đơn giá.
    await queryRunner.query(`
      UPDATE "ai_models" SET
        "endpoint" = coalesce("config" ->> 'apiEndpoint', ''),
        "api_version" = coalesce("config" ->> 'apiVersion', 'v1'),
        "max_tokens" = coalesce(("config" ->> 'maxTokens')::int, 0),
        "temperature" = coalesce(("config" ->> 'temperature')::numeric, 0),
        "cost" = CASE
          WHEN "cost_unit" = 'contract' THEN 'Theo hợp đồng'
          ELSE '$' || trim(trailing '.' from trim(trailing '0' from "cost_amount"::text)) ||
               ' / ' || CASE "cost_unit"
                 WHEN 'per_million_chars' THEN '1M ký tự'
                 WHEN 'per_second' THEN 'giây'
                 ELSE '1M token vào' END
        END
    `);

    await queryRunner.query(
      `ALTER TABLE "ai_models" ADD CONSTRAINT "chk_ai_models_temperature" CHECK ("temperature" >= 0 AND "temperature" <= 2)`,
    );

    await queryRunner.query(`ALTER TABLE "ai_models" DROP COLUMN "free_tier_amount"`);
    await queryRunner.query(`ALTER TABLE "ai_models" DROP COLUMN "cost_unit"`);
    await queryRunner.query(`ALTER TABLE "ai_models" DROP COLUMN "cost_amount"`);
    await queryRunner.query(`ALTER TABLE "ai_models" DROP COLUMN "config"`);
  }
}
