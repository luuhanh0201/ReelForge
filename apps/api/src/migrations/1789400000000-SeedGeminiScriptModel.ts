import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Đưa Gemini trở lại danh mục model kịch bản.
 *
 * `CreateAiModels` từng seed bốn model kịch bản, nhưng chúng đã bị gỡ khỏi database — và
 * vì thế cổng `scriptReadiness` luôn báo "chưa bật model AI", không có cách nào bật.
 *
 * Chỉ seed **một** model, đúng cái sắp dùng thật, và **để tắt sẵn**: quản trị viên phải dán
 * khoá rồi bấm Xác minh mới bật được. Ba model còn lại của bản seed cũ (DeepSeek, GPT-4o,
 * Claude) không dựng lại — chưa nối vào đâu thì bày ra chỉ làm danh mục rối.
 *
 * `ON CONFLICT DO NOTHING`: ai đã tự thêm lại rồi thì giữ nguyên cấu hình của họ.
 */
export class SeedGeminiScriptModel1789400000000 implements MigrationInterface {
  name = 'SeedGeminiScriptModel1789400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "ai_models" (
         "id", "kind", "name", "vendor", "enabled", "badge", "latency", "capability",
         "coming_soon", "credential_provider", "config", "cost_amount", "cost_unit",
         "free_tier_amount"
       ) VALUES (
         'gemini-flash', 'script', 'Gemini Flash', 'Google', false, 'Default Primary',
         'chưa đo', 'Tiếng Việt · ngữ cảnh dài', false, 'google-gemini',
         $1::jsonb, 0, 'per_million_input_tokens', NULL
       )
       ON CONFLICT ("id") DO NOTHING`,
      [JSON.stringify({ maxTokens: 2048, temperature: 0.9, topP: 0.95, apiVersion: 'v1beta' })],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Chỉ xoá khi chưa ai bật lên dùng: gỡ mất một model đang chạy thì luồng viết kịch bản
    // chết theo, và người chạy `migration:revert` không nhất thiết biết điều đó.
    await queryRunner.query(
      `DELETE FROM "ai_models" WHERE "id" = 'gemini-flash' AND "enabled" = false`,
    );
  }
}
