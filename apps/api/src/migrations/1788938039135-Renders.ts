import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Bảng nhật ký các lần xuất video.
 *
 * `render_config` là ảnh chụp đầy đủ cấu hình đã dùng — khi người dùng báo video hỏng thì
 * đây là thứ duy nhất dựng lại được đúng khung hình đó, kể cả sau khi họ đã sửa dự án.
 */
export class Renders1788938039135 implements MigrationInterface {
    name = 'Renders1788938039135'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "renders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "project_id" uuid NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'running', "render_config" jsonb NOT NULL, "credits_charged" integer NOT NULL DEFAULT '0', "duration_ms" integer NOT NULL DEFAULT '0', "file_size" integer NOT NULL DEFAULT '0', "failure_reason" character varying(500), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a5678fd96b9b0f258b93177c4d1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_renders_user_recent" ON "renders"  ("user_id", "created_at") `);
        await queryRunner.query(`ALTER TABLE "renders" ADD CONSTRAINT "FK_4e21267f6dba2aecf7b0273d631" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "renders" ADD CONSTRAINT "FK_6da04723eea3f274322eb282a66" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "renders" DROP CONSTRAINT "FK_6da04723eea3f274322eb282a66"`);
        await queryRunner.query(`ALTER TABLE "renders" DROP CONSTRAINT "FK_4e21267f6dba2aecf7b0273d631"`);
        await queryRunner.query(`DROP INDEX "public"."idx_renders_user_recent"`);
        await queryRunner.query(`DROP TABLE "renders"`);
    }

}
