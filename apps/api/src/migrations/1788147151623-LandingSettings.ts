import { MigrationInterface, QueryRunner } from "typeorm";

export class LandingSettings1788147151623 implements MigrationInterface {
    name = 'LandingSettings1788147151623'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "landing_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "config" jsonb NOT NULL, "published_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "published_by" character varying(80) NOT NULL, "note" character varying(200), CONSTRAINT "PK_6f4246572d8c2f951c827dbf3af" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_landing_settings_published_at" ON "landing_settings"  ("published_at") `);
        await queryRunner.query(`ALTER TABLE "ai_models" ALTER COLUMN "config" SET DEFAULT '{}'::jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ai_models" ALTER COLUMN "config" SET DEFAULT '{}'`);
        await queryRunner.query(`DROP INDEX "public"."idx_landing_settings_published_at"`);
        await queryRunner.query(`DROP TABLE "landing_settings"`);
    }

}
