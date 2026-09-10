import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Kho media của dự án nhận thêm video và ảnh động.
 *
 * `kind` mặc định `image` nên mọi tài nguyên đã có được coi là ảnh — đúng với thực tế,
 * không cần backfill. `duration_ms` chỉ video mới có: ảnh và GIF do người dùng quyết định
 * thời lượng hiển thị.
 */
export class MediaKind1788961151088 implements MigrationInterface {
    name = 'MediaKind1788961151088'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "media_assets" ADD "kind" character varying(10) NOT NULL DEFAULT 'image'`);
        await queryRunner.query(`ALTER TABLE "media_assets" ADD "duration_ms" integer`);
        await queryRunner.query(`ALTER TABLE "media_assets" ADD CONSTRAINT "chk_media_assets_kind" CHECK ("kind" IN ('image', 'video', 'gif'))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "media_assets" DROP CONSTRAINT "chk_media_assets_kind"`);
        await queryRunner.query(`ALTER TABLE "media_assets" DROP COLUMN "duration_ms"`);
        await queryRunner.query(`ALTER TABLE "media_assets" DROP COLUMN "kind"`);
    }

}
