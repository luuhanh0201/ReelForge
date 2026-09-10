import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cache đoạn tiếng dùng chung + hạn mức lồng tiếng theo tài khoản.
 *
 * `tts_clips` **không gắn với người dùng nào**: hai người viết trùng một câu — chuyện rất
 * hay xảy ra vì kịch bản sinh từ cùng một bộ mẫu — thì chỉ tốn tiền Google một lần.
 *
 * Cũng điền `voiceClipId: null` cho các cảnh dựng trước đợt này. Thêm trường vào cột jsonb
 * không tự sửa hàng cũ; bỏ bước này thì giao diện đọc ra `undefined` và không phân biệt
 * được "chưa lồng tiếng" với "dữ liệu cũ".
 */
export class TtsClips1788937172720 implements MigrationInterface {
  name = 'TtsClips1788937172720';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "tts_clips" (
         "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
         "content_hash" character varying(64) NOT NULL,
         "voice_id" uuid NOT NULL,
         "model_id" character varying(60) NOT NULL,
         "char_count" integer NOT NULL,
         "storage_key" character varying(500) NOT NULL,
         "duration_ms" integer NOT NULL,
         "sample_rate" integer NOT NULL,
         "byte_size" integer NOT NULL,
         "last_used_at" TIMESTAMP WITH TIME ZONE NOT NULL,
         "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
         CONSTRAINT "PK_e51a3e5d91fd3043abcc0d9a633" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_tts_clips_hash" ON "tts_clips" ("content_hash")`,
    );

    await queryRunner.query(
      `CREATE TABLE "user_tts_quota" (
         "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
         "user_id" uuid NOT NULL,
         "day" date NOT NULL,
         "lines" integer NOT NULL DEFAULT '0',
         "chars" integer NOT NULL DEFAULT '0',
         "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
         CONSTRAINT "PK_4660b53770549c678dd4085fb38" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_user_tts_quota_day" ON "user_tts_quota" ("user_id", "day")`,
    );

    await queryRunner.query(`
      UPDATE "projects"
      SET "lines" = (
        SELECT COALESCE(
          jsonb_agg(
            CASE
              WHEN line ? 'voiceClipId' THEN line
              ELSE line || '{"voiceClipId": null}'::jsonb
            END
            ORDER BY ordinality
          ),
          '[]'::jsonb
        )
        FROM jsonb_array_elements("lines") WITH ORDINALITY AS t(line, ordinality)
      )
      WHERE jsonb_typeof("lines") = 'array'
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements("lines") AS line
          WHERE NOT (line ? 'voiceClipId')
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Không gỡ `voiceClipId` khỏi jsonb: nó chỉ mang giá trị null cho hàng cũ, và gỡ đi
    // sẽ đưa dữ liệu về đúng trạng thái mà migration này sinh ra để sửa.
    await queryRunner.query(`DROP INDEX "public"."uq_user_tts_quota_day"`);
    await queryRunner.query(`DROP TABLE "user_tts_quota"`);
    await queryRunner.query(`DROP INDEX "public"."uq_tts_clips_hash"`);
    await queryRunner.query(`DROP TABLE "tts_clips"`);
  }
}
