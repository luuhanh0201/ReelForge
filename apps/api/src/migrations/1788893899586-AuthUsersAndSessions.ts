import { MigrationInterface, QueryRunner } from "typeorm";

export class AuthUsersAndSessions1788893899586 implements MigrationInterface {
    name = 'AuthUsersAndSessions1788893899586'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(320) NOT NULL, "email_verified" boolean NOT NULL DEFAULT false, "name" character varying(120) NOT NULL, "avatar_url" character varying(500), "google_sub" character varying(64), "password_hash" character varying(255), "role" character varying(20) NOT NULL DEFAULT 'user', "status" character varying(20) NOT NULL DEFAULT 'active', "plan" character varying(20) NOT NULL DEFAULT 'starter', "credits" integer NOT NULL DEFAULT '0', "last_login_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_users_plan" CHECK ("plan" IN ('starter', 'creator-pro', 'agency')), CONSTRAINT "chk_users_status" CHECK ("status" IN ('active', 'suspended')), CONSTRAINT "chk_users_role" CHECK ("role" IN ('user', 'viewer', 'editor', 'admin')), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_users_email" ON "users"  ("email") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_users_google_sub" ON "users"  ("google_sub") `);
        await queryRunner.query(`CREATE INDEX "idx_users_role" ON "users"  ("role") `);
        await queryRunner.query(`CREATE TABLE "user_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "refresh_token_hash" character varying(64) NOT NULL, "previous_token_hash" character varying(64), "rotated_at" TIMESTAMP WITH TIME ZONE, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "last_used_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "revoked_reason" character varying(30), "user_agent" character varying(400), "ip" character varying(64), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_user_sessions_revoked_reason" CHECK ("revoked_reason" IS NULL OR "revoked_reason" IN ('logout', 'logout_all', 'admin_revoke', 'reuse_detected', 'max_sessions', 'idle_timeout', 'account_suspended')), CONSTRAINT "PK_e93e031a5fed190d4789b6bfd83" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_user_sessions_user_id" ON "user_sessions"  ("user_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_user_sessions_refresh_token_hash" ON "user_sessions"  ("refresh_token_hash") `);
        await queryRunner.query(`CREATE INDEX "idx_user_sessions_revoked_at" ON "user_sessions"  ("revoked_at") `);
        await queryRunner.query(`ALTER TABLE "ai_models" ALTER COLUMN "config" SET DEFAULT '{}'::jsonb`);
        await queryRunner.query(`ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_e9658e959c490b0a634dfc54783" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_e9658e959c490b0a634dfc54783"`);
        await queryRunner.query(`ALTER TABLE "ai_models" ALTER COLUMN "config" SET DEFAULT '{}'`);
        await queryRunner.query(`DROP INDEX "public"."idx_user_sessions_revoked_at"`);
        await queryRunner.query(`DROP INDEX "public"."uq_user_sessions_refresh_token_hash"`);
        await queryRunner.query(`DROP INDEX "public"."idx_user_sessions_user_id"`);
        await queryRunner.query(`DROP TABLE "user_sessions"`);
        await queryRunner.query(`DROP INDEX "public"."idx_users_role"`);
        await queryRunner.query(`DROP INDEX "public"."uq_users_google_sub"`);
        await queryRunner.query(`DROP INDEX "public"."uq_users_email"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
