import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Tour hướng dẫn: nội dung có phiên bản, và trạng thái từng người dùng.
 *
 * `tours` giữ lịch sử xuất bản như `landing_settings` — sửa nhầm lời hướng dẫn rồi xuất
 * bản thì còn bản trước để quay lại. `user_tour_state` mỗi người một dòng cho mỗi tour,
 * nên gộp theo `last_step_id` là ra ngay bước nào khiến người dùng bỏ cuộc.
 */
export class Tours1788957536150 implements MigrationInterface {
    name = 'Tours1788957536150'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "tours" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "key" character varying(60) NOT NULL, "config" jsonb NOT NULL, "published_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "published_by" character varying(120) NOT NULL, "note" character varying(200), CONSTRAINT "PK_2202ba445792c1ad0edf2de8de2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_tours_key_published" ON "tours"  ("key", "published_at") `);
        await queryRunner.query(`CREATE TABLE "user_tour_state" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "tour_key" character varying(60) NOT NULL, "status" character varying(20) NOT NULL, "last_step_id" character varying(60), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_dd50e38390beca0c71b2e552253" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_user_tour_state" ON "user_tour_state"  ("user_id", "tour_key") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."uq_user_tour_state"`);
        await queryRunner.query(`DROP TABLE "user_tour_state"`);
        await queryRunner.query(`DROP INDEX "public"."idx_tours_key_published"`);
        await queryRunner.query(`DROP TABLE "tours"`);
    }

}
