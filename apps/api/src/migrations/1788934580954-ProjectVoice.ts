import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Giọng đọc và tốc độ đọc ở cấp dự án.
 *
 * Không đặt khoá ngoại sang `voices`: admin gỡ một giọng khỏi danh mục không được phép
 * làm hỏng dự án của khách — giao diện tự coi giá trị lạc là "cần chọn lại".
 *
 * TypeORM còn muốn viết lại default của mấy cột jsonb thành `'{}'::jsonb`; đó là khác biệt
 * về cách in chuỗi chứ không phải khác biệt thật, nên không đưa vào đây.
 */
export class ProjectVoice1788934580954 implements MigrationInterface {
  name = 'ProjectVoice1788934580954';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "projects" ADD "voice_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "projects" ADD "voice_speed" real NOT NULL DEFAULT '1'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "voice_speed"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "voice_id"`);
  }
}
