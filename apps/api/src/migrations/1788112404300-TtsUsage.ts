import { MigrationInterface, QueryRunner } from "typeorm";

export class TtsUsage1788112404300 implements MigrationInterface {
    name = 'TtsUsage1788112404300'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "tts_usage" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "day" date NOT NULL, "model_id" character varying(60) NOT NULL, "voice_id" uuid NOT NULL, "chars" integer NOT NULL DEFAULT '0', "requests" integer NOT NULL DEFAULT '0', "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9076f3baa87ac596e599cf15fd8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_tts_usage_day" ON "tts_usage"  ("day") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_tts_usage_day_model_voice" ON "tts_usage"  ("day", "model_id", "voice_id") `);
        await queryRunner.query(`ALTER TABLE "ai_models" ALTER COLUMN "config" SET DEFAULT '{}'::jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ai_models" ALTER COLUMN "config" SET DEFAULT '{}'`);
        await queryRunner.query(`DROP INDEX "public"."uq_tts_usage_day_model_voice"`);
        await queryRunner.query(`DROP INDEX "public"."idx_tts_usage_day"`);
        await queryRunner.query(`DROP TABLE "tts_usage"`);
    }

}
