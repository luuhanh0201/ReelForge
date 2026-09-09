import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Đổi bộ gói cước sang free / advanced / plus / premium.
 *
 * Thứ tự bắt buộc: **gỡ ràng buộc CHECK trước, đổi dữ liệu, rồi mới gắn ràng buộc mới**.
 * Làm ngược lại thì lệnh UPDATE vi phạm ràng buộc cũ và migration chết giữa chừng.
 *
 * Ánh xạ giữ nguyên thứ bậc cũ: starter (0đ) → free, creator-pro (199k) → advanced,
 * agency (499k) → plus. Chưa ai ở bậc cao nhất nên `premium` bắt đầu từ số không.
 */
export class RenamePlans1788899186893 implements MigrationInterface {
  name = 'RenamePlans1788899186893';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "chk_users_plan"`,
    );
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "plan" DROP DEFAULT`);

    await queryRunner.query(
      `UPDATE "users" SET "plan" = CASE "plan"
         WHEN 'starter' THEN 'free'
         WHEN 'creator-pro' THEN 'advanced'
         WHEN 'agency' THEN 'plus'
         ELSE 'free'
       END`,
    );

    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "plan" SET DEFAULT 'free'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "chk_users_plan" CHECK ("plan" IN ('free', 'advanced', 'plus', 'premium'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "chk_users_plan"`,
    );
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "plan" DROP DEFAULT`);

    // `premium` không có bậc tương ứng ở bộ cũ nên gộp về `agency`, bậc cao nhất khi đó.
    await queryRunner.query(
      `UPDATE "users" SET "plan" = CASE "plan"
         WHEN 'free' THEN 'starter'
         WHEN 'advanced' THEN 'creator-pro'
         WHEN 'plus' THEN 'agency'
         WHEN 'premium' THEN 'agency'
         ELSE 'starter'
       END`,
    );

    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "plan" SET DEFAULT 'starter'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "chk_users_plan" CHECK ("plan" IN ('starter', 'creator-pro', 'agency'))`,
    );
  }
}
