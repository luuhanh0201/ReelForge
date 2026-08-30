import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAiModels1788081468014 implements MigrationInterface {
    name = 'CreateAiModels1788081468014'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "ai_models" ("id" character varying(60) NOT NULL, "kind" character varying(10) NOT NULL, "name" character varying(120) NOT NULL, "vendor" character varying(80) NOT NULL, "enabled" boolean NOT NULL DEFAULT false, "badge" character varying(40) NOT NULL, "latency" character varying(60) NOT NULL, "capability" character varying(120) NOT NULL, "cost" character varying(60) NOT NULL, "endpoint" character varying(300) NOT NULL, "api_version" character varying(40) NOT NULL, "max_tokens" integer NOT NULL DEFAULT '0', "temperature" numeric(3,2) NOT NULL DEFAULT '0', "coming_soon" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3d254744f0bcf6f35be5826e25e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_ai_models_kind" ON "ai_models"  ("kind") `);

        await queryRunner.query(`ALTER TABLE "ai_models" ADD CONSTRAINT "chk_ai_models_kind" CHECK ("kind" IN ('video', 'voice', 'script'))`);
        await queryRunner.query(`ALTER TABLE "ai_models" ADD CONSTRAINT "chk_ai_models_badge" CHECK ("badge" IN ('Default Primary', 'Fallback Tier-1', 'Fallback Tier-2', 'Enterprise Only', 'Experimental'))`);
        await queryRunner.query(`ALTER TABLE "ai_models" ADD CONSTRAINT "chk_ai_models_temperature" CHECK ("temperature" >= 0 AND "temperature" <= 2)`);
        // Seed danh mục model đang hiển thị trên admin. Idempotent: trùng id thì bỏ qua.
        const models: unknown[][] = [
    ["runway-gen3", "video", "Runway Gen-3 Alpha", "Runway", false, "Experimental", "~24s / cảnh", "1080p · 24 FPS", "$0,050 / giây render", "https://api.runwayml.com/v1", "2024-11", 0, 0.0, true],
    ["sora", "video", "OpenAI Sora", "OpenAI", false, "Experimental", "~40s / cảnh", "1080p · 30 FPS", "$0,100 / giây render", "https://api.openai.com/v1/video", "v1", 0, 0.0, true],
    ["veo-2", "video", "Google Veo 2", "Google", false, "Experimental", "~18s / cảnh", "4K · 60 FPS", "$0,075 / giây render", "https://aiplatform.googleapis.com/v1", "v1", 0, 0.0, true],
    ["luma", "video", "Luma Dream Machine", "Luma AI", false, "Experimental", "~22s / cảnh", "1080p · 30 FPS", "$0,040 / giây render", "https://api.lumalabs.ai/dream-machine/v1", "v1", 0, 0.0, true],
    ["pika", "video", "Pika 2.0", "Pika Labs", false, "Experimental", "~20s / cảnh", "1080p · 24 FPS", "$0,035 / giây render", "https://api.pika.art/v2", "v2", 0, 0.0, true],
    ["google-chirp3", "voice", "Google Cloud TTS · Chirp 3 HD", "Google", true, "Default Primary", "~1,2s / cảnh", "vi-VN · 28 giọng", "$30 / 1M ký tự", "https://texttospeech.googleapis.com/v1", "v1", 5000, 0.0, false],
    ["google-wavenet", "voice", "Google Cloud TTS · WaveNet", "Google", true, "Fallback Tier-1", "~0,9s / cảnh", "vi-VN · có timepoints", "$16 / 1M ký tự", "https://texttospeech.googleapis.com/v1beta1", "v1beta1", 5000, 0.0, false],
    ["elevenlabs-turbo", "voice", "ElevenLabs Turbo v2.5", "ElevenLabs", false, "Enterprise Only", "~0,6s / cảnh", "Đa ngôn ngữ · voice cloning", "$0,30 / 1.000 ký tự", "https://api.elevenlabs.io/v1", "v1", 5000, 0.0, false],
    ["openai-tts-hd", "voice", "OpenAI TTS-1 HD", "OpenAI", false, "Fallback Tier-2", "~1,4s / cảnh", "Đa ngôn ngữ · 6 giọng", "$30 / 1M ký tự", "https://api.openai.com/v1/audio/speech", "v1", 4096, 0.0, false],
    ["fpt-voice", "voice", "FPT AI Voice", "FPT.AI", false, "Experimental", "~1,0s / cảnh", "Tiếng Việt 3 miền", "Theo hợp đồng", "https://api.fpt.ai/hmi/tts/v5", "v5", 5000, 0.0, false],
    ["gemini-flash", "script", "Gemini 2.5 Flash", "Google", true, "Default Primary", "~1,8s / kịch bản", "Ngữ cảnh 1M token", "$0,30 / 1M token vào", "https://generativelanguage.googleapis.com/v1beta", "v1beta", 8192, 0.9, false],
    ["deepseek-v3", "script", "DeepSeek V3", "DeepSeek", true, "Fallback Tier-1", "~2,4s / kịch bản", "Ngữ cảnh 128K token", "$0,27 / 1M token vào", "https://api.deepseek.com/v1", "v1", 8192, 0.8, false],
    ["gpt-4o", "script", "GPT-4o", "OpenAI", true, "Fallback Tier-2", "~2,1s / kịch bản", "Ngữ cảnh 128K token", "$2,50 / 1M token vào", "https://api.openai.com/v1", "v1", 8192, 0.8, false],
    ["claude-sonnet", "script", "Claude 3.5 Sonnet", "Anthropic", false, "Enterprise Only", "~2,6s / kịch bản", "Ngữ cảnh 200K token", "$3,00 / 1M token vào", "https://api.anthropic.com/v1", "2023-06-01", 8192, 0.8, false],
        ];

        for (const model of models) {
            await queryRunner.query(
                `INSERT INTO "ai_models" (
                   "id", "kind", "name", "vendor", "enabled", "badge", "latency",
                   "capability", "cost", "endpoint", "api_version", "max_tokens",
                   "temperature", "coming_soon"
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
                 ON CONFLICT ("id") DO NOTHING`,
                model,
            );
        }
    }
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_ai_models_kind"`);
        await queryRunner.query(`DROP TABLE "ai_models"`);
    }

}
