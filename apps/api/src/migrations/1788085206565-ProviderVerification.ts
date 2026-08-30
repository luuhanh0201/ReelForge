import { MigrationInterface, QueryRunner } from "typeorm";

export class ProviderVerification1788085206565 implements MigrationInterface {
    name = 'ProviderVerification1788085206565'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ai_models" ADD "credential_provider" character varying(40)`);
        await queryRunner.query(`ALTER TABLE "ai_models" ADD "verified_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "ai_models" ADD "verification_note" character varying(200)`);
        await queryRunner.query(`ALTER TABLE "ai_models" ADD "last_latency_ms" integer`);
        await queryRunner.query(`ALTER TABLE "voices" ADD "verified_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "voices" ADD "verification_note" character varying(200)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "voices" DROP COLUMN "verification_note"`);
        await queryRunner.query(`ALTER TABLE "voices" DROP COLUMN "verified_at"`);
        await queryRunner.query(`ALTER TABLE "ai_models" DROP COLUMN "last_latency_ms"`);
        await queryRunner.query(`ALTER TABLE "ai_models" DROP COLUMN "verification_note"`);
        await queryRunner.query(`ALTER TABLE "ai_models" DROP COLUMN "verified_at"`);
        await queryRunner.query(`ALTER TABLE "ai_models" DROP COLUMN "credential_provider"`);
    }

}
