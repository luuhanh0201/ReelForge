import { MigrationInterface, QueryRunner } from "typeorm";

export class VoicePreviewCache1788115152475 implements MigrationInterface {
    name = 'VoicePreviewCache1788115152475'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "voice_previews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "voice_id" uuid NOT NULL, "audio" bytea NOT NULL, "mime_type" character varying(40) NOT NULL, "char_count" integer NOT NULL, "input_hash" character(64) NOT NULL, "api_version" character varying(20) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a4976a9f3aa30bb601bd410ce04" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_voice_previews_voice_id" ON "voice_previews"  ("voice_id") `);
        await queryRunner.query(`ALTER TABLE "ai_models" ALTER COLUMN "config" SET DEFAULT '{}'::jsonb`);
        await queryRunner.query(`ALTER TABLE "voice_previews" ADD CONSTRAINT "FK_e1c7d2e9279d4ab12bec3e18156" FOREIGN KEY ("voice_id") REFERENCES "voices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "voice_previews" DROP CONSTRAINT "FK_e1c7d2e9279d4ab12bec3e18156"`);
        await queryRunner.query(`ALTER TABLE "ai_models" ALTER COLUMN "config" SET DEFAULT '{}'`);
        await queryRunner.query(`DROP INDEX "public"."uq_voice_previews_voice_id"`);
        await queryRunner.query(`DROP TABLE "voice_previews"`);
    }

}
