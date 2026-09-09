import { MigrationInterface, QueryRunner } from "typeorm";

export class CreditLedger1788922041624 implements MigrationInterface {
    name = 'CreditLedger1788922041624'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "credit_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "type" character varying(30) NOT NULL, "amount" integer NOT NULL, "balance_after" integer NOT NULL, "ref_type" character varying(30), "ref_id" uuid, "note" character varying(200), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_credit_tx_type" CHECK ("type" IN ('signup_bonus', 'purchase', 'render_charge', 'tts_extra', 'refund', 'admin_grant', 'admin_deduct')), CONSTRAINT "PK_a408319811d1ab32832ec86fc2c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_credit_tx_user" ON "credit_transactions"  ("user_id") `);
        await queryRunner.query(`ALTER TABLE "ai_models" ALTER COLUMN "config" SET DEFAULT '{}'::jsonb`);
        await queryRunner.query(`ALTER TABLE "credit_transactions" ADD CONSTRAINT "FK_9ac41a5292ef4d8356a86be30c2" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        // Chống ghi trùng: cùng một lần xuất video hay một đơn hàng gọi lại vì mạng chập
        // chờn cũng chỉ tạo đúng một dòng. Partial index vì phần lớn giao dịch không có ref.
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_credit_tx_ref" ON "credit_transactions" ("ref_type", "ref_id") WHERE "ref_type" IS NOT NULL`);

        // Tài khoản đã có số dư từ trước khi có sổ cái: ghi một dòng mở sổ, nếu không thì
        // phép đối chiếu số dư sẽ báo lệch ngay từ lần chạy đầu tiên.
        await queryRunner.query(`
            INSERT INTO "credit_transactions" ("user_id", "type", "amount", "balance_after", "ref_type", "ref_id", "note")
            SELECT id, 'admin_grant', credits, credits, 'user', id, 'Số dư mở sổ, có trước khi ghi sổ cái credit'
            FROM "users"
            WHERE credits > 0
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "credit_transactions" DROP CONSTRAINT "FK_9ac41a5292ef4d8356a86be30c2"`);
        await queryRunner.query(`ALTER TABLE "ai_models" ALTER COLUMN "config" SET DEFAULT '{}'`);
        await queryRunner.query(`DROP INDEX "public"."uq_credit_tx_ref"`);
        await queryRunner.query(`DROP INDEX "public"."idx_credit_tx_user"`);
        await queryRunner.query(`DROP TABLE "credit_transactions"`);
    }

}
