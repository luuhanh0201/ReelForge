import { MigrationInterface, QueryRunner } from "typeorm";

export class VoiceSampleText1788108151319 implements MigrationInterface {
    name = 'VoiceSampleText1788108151319'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Có DEFAULT để bảng đang có dữ liệu vẫn thêm được cột NOT NULL.
        await queryRunner.query(`ALTER TABLE "voices" ADD "sample_text" character varying(300) NOT NULL DEFAULT 'Xin chào, đây là giọng đọc thử của ReelForge. Sản phẩm đang giảm giá năm mươi phần trăm.'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "voices" DROP COLUMN "sample_text"`);
    }

}
