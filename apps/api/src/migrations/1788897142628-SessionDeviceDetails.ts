import { MigrationInterface, QueryRunner } from "typeorm";

export class SessionDeviceDetails1788897142628 implements MigrationInterface {
    name = 'SessionDeviceDetails1788897142628'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_sessions" ADD "browser" character varying(60)`);
        await queryRunner.query(`ALTER TABLE "user_sessions" ADD "os" character varying(60)`);
        await queryRunner.query(`ALTER TABLE "user_sessions" ADD "device_type" character varying(20) NOT NULL DEFAULT 'unknown'`);
        await queryRunner.query(`ALTER TABLE "user_sessions" ADD "is_new_device" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "user_sessions" ADD "last_ip" character varying(64)`);
        await queryRunner.query(`ALTER TABLE "ai_models" ALTER COLUMN "config" SET DEFAULT '{}'::jsonb`);
        await queryRunner.query(`ALTER TABLE "user_sessions" ADD CONSTRAINT "chk_user_sessions_device_type" CHECK ("device_type" IN ('desktop', 'mobile', 'tablet', 'unknown'))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_sessions" DROP CONSTRAINT "chk_user_sessions_device_type"`);
        await queryRunner.query(`ALTER TABLE "ai_models" ALTER COLUMN "config" SET DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "user_sessions" DROP COLUMN "last_ip"`);
        await queryRunner.query(`ALTER TABLE "user_sessions" DROP COLUMN "is_new_device"`);
        await queryRunner.query(`ALTER TABLE "user_sessions" DROP COLUMN "device_type"`);
        await queryRunner.query(`ALTER TABLE "user_sessions" DROP COLUMN "os"`);
        await queryRunner.query(`ALTER TABLE "user_sessions" DROP COLUMN "browser"`);
    }

}
