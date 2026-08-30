import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Nạp 6 giọng đại diện Bắc – Trung – Nam và một giọng tiếng Anh quốc tế.
 * Trước đây danh sách này nằm cứng trong `apps/web/config/admin/models.config.ts`.
 *
 * Idempotent: trùng `provider_voice_id` thì bỏ qua, nên chạy lại không nhân bản dữ liệu.
 */
export class SeedVoices1788081096255 implements MigrationInterface {
  name = 'SeedVoices1788081096255';

  private static readonly VOICES = [
    ['Thảo My', 'Ban Mai', 'vi-VN-Chirp3-HD-Achernar', 'google-chirp3', 'female', 'Miền Bắc', 1.05, 2180, false, 30, 14, true],
    ['Minh Khôi', 'Minh Quang', 'vi-VN-Chirp3-HD-Puck', 'google-chirp3', 'male', 'Miền Bắc', 1.0, 1890, false, 30, 16, true],
    ['Hương Giang', 'Ngọc Huyền', 'vi-VN-Chirp3-HD-Leda', 'google-chirp3', 'female', 'Miền Trung', 0.85, 980, false, 30, 15, true],
    ['Mai Linh', 'Mỹ An', 'vi-VN-Wavenet-C', 'google-wavenet', 'female', 'Miền Nam', 1.1, 1650, true, 16, 15, true],
    ['Quốc Bảo', 'Quốc Tuấn', 'vi-VN-Chirp3-HD-Charon', 'google-chirp3', 'male', 'Miền Nam', 1.15, 1420, false, 30, 13, true],
    ['Emma', 'US Native Global', 'en-US-Chirp3-HD-Kore', 'google-chirp3', 'female', 'Quốc tế', 1.0, 640, false, 30, 12, false],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const voice of SeedVoices1788081096255.VOICES) {
      await queryRunner.query(
        `INSERT INTO "voices" (
           "persona_name", "origin_name", "provider_voice_id", "model_id", "gender",
           "region", "speed", "usage_count", "supports_timepoints",
           "cost_per_million_usd", "duration_sec", "enabled"
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT ("provider_voice_id") DO NOTHING`,
        voice,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const ids = SeedVoices1788081096255.VOICES.map((voice) => voice[2]);
    await queryRunner.query(`DELETE FROM "voices" WHERE "provider_voice_id" = ANY($1)`, [ids]);
  }
}
