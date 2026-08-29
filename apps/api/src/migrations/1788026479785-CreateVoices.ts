import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateVoices1788026479785 implements MigrationInterface {
    name = 'CreateVoices1788026479785'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "voices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "persona_name" character varying(120) NOT NULL, "origin_name" character varying(120) NOT NULL, "provider_voice_id" character varying(160) NOT NULL, "model_id" character varying(60) NOT NULL, "gender" character varying(10) NOT NULL, "region" character varying(60) NOT NULL, "speed" numeric(3,2) NOT NULL DEFAULT '1', "usage_count" integer NOT NULL DEFAULT '0', "supports_timepoints" boolean NOT NULL DEFAULT false, "cost_per_million_usd" numeric(8,2) NOT NULL DEFAULT '0', "duration_sec" integer NOT NULL DEFAULT '0', "enabled" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e9aca1140ce459e098f259fcc47" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_voices_provider_voice_id" ON "voices"  ("provider_voice_id") `);
        await queryRunner.query(`CREATE INDEX "idx_voices_enabled" ON "voices"  ("enabled") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_voices_enabled"`);
        await queryRunner.query(`DROP INDEX "public"."uq_voices_provider_voice_id"`);
        await queryRunner.query(`DROP TABLE "voices"`);
    }

}
