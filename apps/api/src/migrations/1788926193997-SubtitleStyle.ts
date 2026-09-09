import { MigrationInterface, QueryRunner } from "typeorm";

export class SubtitleStyle1788926193997 implements MigrationInterface {
    name = 'SubtitleStyle1788926193997'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "projects" ADD "subtitle_style" jsonb NOT NULL DEFAULT '{}'::jsonb`);
        await queryRunner.query(`ALTER TABLE "ai_models" ALTER COLUMN "config" SET DEFAULT '{}'::jsonb`);
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "product" SET DEFAULT '{}'::jsonb`);
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "lines" SET DEFAULT '[]'::jsonb`);
        await queryRunner.query(`ALTER TABLE "media_assets" ALTER COLUMN "variants" SET DEFAULT '[]'::jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "media_assets" ALTER COLUMN "variants" SET DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "lines" SET DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "product" SET DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "ai_models" ALTER COLUMN "config" SET DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "subtitle_style"`);
    }

}
