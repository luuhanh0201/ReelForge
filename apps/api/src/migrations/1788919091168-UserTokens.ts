import { MigrationInterface, QueryRunner } from "typeorm";

export class UserTokens1788919091168 implements MigrationInterface {
    name = 'UserTokens1788919091168'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "type" character varying(30) NOT NULL, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_user_tokens_type" CHECK ("type" IN ('email_verification', 'password_reset')), CONSTRAINT "PK_63764db9d9aaa4af33e07b2f4bf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_user_tokens_user_id" ON "user_tokens"  ("user_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_user_tokens_hash" ON "user_tokens"  ("token_hash") `);
        await queryRunner.query(`ALTER TABLE "ai_models" ALTER COLUMN "config" SET DEFAULT '{}'::jsonb`);
        await queryRunner.query(`ALTER TABLE "user_tokens" ADD CONSTRAINT "FK_9e144a67be49e5bba91195ef5de" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_tokens" DROP CONSTRAINT "FK_9e144a67be49e5bba91195ef5de"`);
        await queryRunner.query(`ALTER TABLE "ai_models" ALTER COLUMN "config" SET DEFAULT '{}'`);
        await queryRunner.query(`DROP INDEX "public"."uq_user_tokens_hash"`);
        await queryRunner.query(`DROP INDEX "public"."idx_user_tokens_user_id"`);
        await queryRunner.query(`DROP TABLE "user_tokens"`);
    }

}
