import { MigrationInterface, QueryRunner } from "typeorm";

export class CredentialsAndAudit1788076688165 implements MigrationInterface {
    name = 'CredentialsAndAudit1788076688165'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "admin_audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actor" character varying(80) NOT NULL, "ip" character varying(64), "action" character varying(120) NOT NULL, "target" character varying(200) NOT NULL, "level" character varying(20) NOT NULL, "success" boolean NOT NULL DEFAULT true, "metadata" jsonb, CONSTRAINT "PK_de7a8fc2fbb525484c71a86bb96" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_admin_audit_logs_occurred_at" ON "admin_audit_logs"  ("occurred_at") `);
        await queryRunner.query(`CREATE INDEX "idx_admin_audit_logs_level" ON "admin_audit_logs"  ("level") `);
        await queryRunner.query(`CREATE TABLE "provider_credentials" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "provider" character varying(40) NOT NULL, "encrypted_payload" bytea NOT NULL, "iv" bytea NOT NULL, "auth_tag" bytea NOT NULL, "algorithm" character varying(20) NOT NULL, "encryption_key_version" smallint NOT NULL, "credential_fingerprint" character(64) NOT NULL, "project_id" character varying(120) NOT NULL, "client_email_masked" character varying(160) NOT NULL, "private_key_id_suffix" character varying(8) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'connected', "last_latency_ms" integer, "last_verified_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_31f2884572a5fef8e25a08b5a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_provider_credentials_provider" ON "provider_credentials"  ("provider") `);

        // Ràng buộc ở tầng database: kích thước IV/auth tag sai là dấu hiệu dữ liệu
        // hỏng hoặc bị can thiệp, chặn ngay từ đây thay vì để lộ ở lúc giải mã.
        await queryRunner.query(`ALTER TABLE "provider_credentials" ADD CONSTRAINT "chk_provider_credentials_algorithm" CHECK ("algorithm" = 'aes-256-gcm')`);
        await queryRunner.query(`ALTER TABLE "provider_credentials" ADD CONSTRAINT "chk_provider_credentials_iv_len" CHECK (octet_length("iv") = 12)`);
        await queryRunner.query(`ALTER TABLE "provider_credentials" ADD CONSTRAINT "chk_provider_credentials_tag_len" CHECK (octet_length("auth_tag") = 16)`);
        await queryRunner.query(`ALTER TABLE "provider_credentials" ADD CONSTRAINT "chk_provider_credentials_key_version" CHECK ("encryption_key_version" > 0)`);
        await queryRunner.query(`ALTER TABLE "provider_credentials" ADD CONSTRAINT "chk_provider_credentials_status" CHECK ("status" IN ('connected', 'disabled', 'error'))`);
        await queryRunner.query(`ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "chk_admin_audit_logs_level" CHECK ("level" IN ('info', 'warning', 'critical'))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "admin_audit_logs" DROP CONSTRAINT "chk_admin_audit_logs_level"`);
        await queryRunner.query(`ALTER TABLE "provider_credentials" DROP CONSTRAINT "chk_provider_credentials_status"`);
        await queryRunner.query(`ALTER TABLE "provider_credentials" DROP CONSTRAINT "chk_provider_credentials_key_version"`);
        await queryRunner.query(`ALTER TABLE "provider_credentials" DROP CONSTRAINT "chk_provider_credentials_tag_len"`);
        await queryRunner.query(`ALTER TABLE "provider_credentials" DROP CONSTRAINT "chk_provider_credentials_iv_len"`);
        await queryRunner.query(`ALTER TABLE "provider_credentials" DROP CONSTRAINT "chk_provider_credentials_algorithm"`);
        await queryRunner.query(`DROP INDEX "public"."uq_provider_credentials_provider"`);
        await queryRunner.query(`DROP TABLE "provider_credentials"`);
        await queryRunner.query(`DROP INDEX "public"."idx_admin_audit_logs_level"`);
        await queryRunner.query(`DROP INDEX "public"."idx_admin_audit_logs_occurred_at"`);
        await queryRunner.query(`DROP TABLE "admin_audit_logs"`);
    }

}
