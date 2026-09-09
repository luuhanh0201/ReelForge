import { MigrationInterface, QueryRunner } from "typeorm";

export class ProjectsAndMedia1788924111085 implements MigrationInterface {
    name = 'ProjectsAndMedia1788924111085'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."uq_credit_tx_ref"`);
        await queryRunner.query(`CREATE TABLE "projects" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "title" character varying(200) NOT NULL, "mode" character varying(10) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'draft', "aspect_ratio" character varying(10) NOT NULL DEFAULT '9:16', "resolution" character varying(10) NOT NULL DEFAULT '1080p', "source_url" character varying(2000), "product" jsonb NOT NULL DEFAULT '{}'::jsonb, "lines" jsonb NOT NULL DEFAULT '[]'::jsonb, "script_template" character varying(60), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_projects_resolution" CHECK ("resolution" IN ('720p', '1080p', '2k')), CONSTRAINT "chk_projects_aspect" CHECK ("aspect_ratio" IN ('9:16', '1:1', '16:9')), CONSTRAINT "chk_projects_status" CHECK ("status" IN ('draft', 'ready', 'archived')), CONSTRAINT "chk_projects_mode" CHECK ("mode" IN ('link', 'manual')), CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_projects_user_recent" ON "projects"  ("updated_at") `);
        await queryRunner.query(`CREATE TABLE "media_assets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "project_id" uuid NOT NULL, "origin" character varying(20) NOT NULL, "source_key" character varying(300) NOT NULL, "mime_type" character varying(40) NOT NULL, "width" integer NOT NULL, "height" integer NOT NULL, "byte_size" integer NOT NULL, "variants" jsonb NOT NULL DEFAULT '[]'::jsonb, "source_url" character varying(2000), "sort_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_media_assets_origin" CHECK ("origin" IN ('crawled', 'uploaded')), CONSTRAINT "PK_ca47e9f67a5e5d8af1e75d66ee6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_media_assets_project" ON "media_assets"  ("project_id") `);
        await queryRunner.query(`ALTER TABLE "ai_models" ALTER COLUMN "config" SET DEFAULT '{}'::jsonb`);
        await queryRunner.query(`ALTER TABLE "projects" ADD CONSTRAINT "FK_bd55b203eb9f92b0c8390380010" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "media_assets" ADD CONSTRAINT "FK_3bf45acc3bc7dab569ac1dcd99f" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "media_assets" DROP CONSTRAINT "FK_3bf45acc3bc7dab569ac1dcd99f"`);
        await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "FK_bd55b203eb9f92b0c8390380010"`);
        await queryRunner.query(`ALTER TABLE "ai_models" ALTER COLUMN "config" SET DEFAULT '{}'`);
        await queryRunner.query(`DROP INDEX "public"."idx_media_assets_project"`);
        await queryRunner.query(`DROP TABLE "media_assets"`);
        await queryRunner.query(`DROP INDEX "public"."idx_projects_user_recent"`);
        await queryRunner.query(`DROP TABLE "projects"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_credit_tx_ref" ON "credit_transactions" USING btree ("ref_type", "ref_id") WHERE (ref_type IS NOT NULL)`);
    }

}
