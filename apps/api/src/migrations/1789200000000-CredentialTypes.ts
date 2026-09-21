import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Mở bảng credential cho nhà cung cấp chỉ có một API key.
 *
 * Bảng này sinh ra cho service account của Google TTS, nên `project_id`,
 * `client_email_masked` và `private_key_id_suffix` đều `NOT NULL`. Gemini thì credential
 * chỉ là một chuỗi — không có project, không có email — nên ba cột đó phải cho phép rỗng.
 *
 * Thêm `credential_type` để service biết đọc payload đã giải mã theo kiểu nào, và
 * `display_hint` để giao diện có thứ hiển thị chung cho mọi loại.
 *
 * Bản ghi Google TTS đang có được điền `display_hint` từ email đã che — đúng thứ giao diện
 * vẫn đang hiện, nên admin không thấy gì thay đổi.
 */
export class CredentialTypes1789200000000 implements MigrationInterface {
  name = 'CredentialTypes1789200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "provider_credentials" ADD "credential_type" character varying(20) NOT NULL DEFAULT 'service_account'`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_credentials" ADD "display_hint" character varying(160) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_credentials" ADD CONSTRAINT "chk_provider_credentials_type" CHECK ("credential_type" IN ('service_account', 'api_key'))`,
    );

    await queryRunner.query(
      `ALTER TABLE "provider_credentials" ALTER COLUMN "project_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_credentials" ALTER COLUMN "client_email_masked" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_credentials" ALTER COLUMN "private_key_id_suffix" DROP NOT NULL`,
    );

    await queryRunner.query(
      `UPDATE "provider_credentials" SET "display_hint" = COALESCE("client_email_masked", '')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Bản ghi api_key không có dữ liệu để điền vào ba cột NOT NULL của schema cũ, nên phải
    // xoá trước khi siết lại. Chúng chỉ tồn tại nhờ chính migration này.
    await queryRunner.query(
      `DELETE FROM "provider_credentials" WHERE "credential_type" <> 'service_account'`,
    );

    await queryRunner.query(
      `ALTER TABLE "provider_credentials" ALTER COLUMN "private_key_id_suffix" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_credentials" ALTER COLUMN "client_email_masked" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_credentials" ALTER COLUMN "project_id" SET NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "provider_credentials" DROP CONSTRAINT "chk_provider_credentials_type"`,
    );
    await queryRunner.query(`ALTER TABLE "provider_credentials" DROP COLUMN "display_hint"`);
    await queryRunner.query(
      `ALTER TABLE "provider_credentials" DROP COLUMN "credential_type"`,
    );
  }
}
