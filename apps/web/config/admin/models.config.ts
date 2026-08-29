export type ModelKind = "video" | "voice" | "script";

export type ModelBadge =
  | "Default Primary"
  | "Fallback Tier-1"
  | "Fallback Tier-2"
  | "Enterprise Only"
  | "Experimental";

export interface AiModel {
  id: string;
  kind: ModelKind;
  name: string;
  vendor: string;
  enabled: boolean;
  badge: ModelBadge;
  /** Độ trễ trung bình, hiển thị kèm đơn vị riêng theo loại model. */
  latency: string;
  capability: string;
  cost: string;
  /** Tham số mở trong modal Configure. */
  config: {
    endpoint: string;
    apiVersion: string;
    maxTokens: number;
    temperature: number;
  };
  /** Model chưa mở — hiển thị nhưng khoá mọi thao tác. */
  comingSoon?: boolean;
}

export const VIDEO_MODELS: AiModel[] = [
  {
    id: "runway-gen3",
    kind: "video",
    name: "Runway Gen-3 Alpha",
    vendor: "Runway",
    enabled: false,
    badge: "Experimental",
    latency: "~24s / cảnh",
    capability: "1080p · 24 FPS",
    cost: "$0,050 / giây render",
    config: { endpoint: "https://api.runwayml.com/v1", apiVersion: "2024-11", maxTokens: 0, temperature: 0 },
    comingSoon: true,
  },
  {
    id: "sora",
    kind: "video",
    name: "OpenAI Sora",
    vendor: "OpenAI",
    enabled: false,
    badge: "Experimental",
    latency: "~40s / cảnh",
    capability: "1080p · 30 FPS",
    cost: "$0,100 / giây render",
    config: { endpoint: "https://api.openai.com/v1/video", apiVersion: "v1", maxTokens: 0, temperature: 0 },
    comingSoon: true,
  },
  {
    id: "veo-2",
    kind: "video",
    name: "Google Veo 2",
    vendor: "Google",
    enabled: false,
    badge: "Experimental",
    latency: "~18s / cảnh",
    capability: "4K · 60 FPS",
    cost: "$0,075 / giây render",
    config: { endpoint: "https://aiplatform.googleapis.com/v1", apiVersion: "v1", maxTokens: 0, temperature: 0 },
    comingSoon: true,
  },
  {
    id: "luma",
    kind: "video",
    name: "Luma Dream Machine",
    vendor: "Luma AI",
    enabled: false,
    badge: "Experimental",
    latency: "~22s / cảnh",
    capability: "1080p · 30 FPS",
    cost: "$0,040 / giây render",
    config: { endpoint: "https://api.lumalabs.ai/dream-machine/v1", apiVersion: "v1", maxTokens: 0, temperature: 0 },
    comingSoon: true,
  },
  {
    id: "pika",
    kind: "video",
    name: "Pika 2.0",
    vendor: "Pika Labs",
    enabled: false,
    badge: "Experimental",
    latency: "~20s / cảnh",
    capability: "1080p · 24 FPS",
    cost: "$0,035 / giây render",
    config: { endpoint: "https://api.pika.art/v2", apiVersion: "v2", maxTokens: 0, temperature: 0 },
    comingSoon: true,
  },
];

export const VOICE_MODELS: AiModel[] = [
  {
    id: "google-chirp3",
    kind: "voice",
    name: "Google Cloud TTS · Chirp 3 HD",
    vendor: "Google",
    enabled: true,
    badge: "Default Primary",
    latency: "~1,2s / cảnh",
    capability: "vi-VN · 28 giọng",
    cost: "$30 / 1M ký tự",
    config: { endpoint: "https://texttospeech.googleapis.com/v1", apiVersion: "v1", maxTokens: 5000, temperature: 0 },
  },
  {
    id: "google-wavenet",
    kind: "voice",
    name: "Google Cloud TTS · WaveNet",
    vendor: "Google",
    enabled: true,
    badge: "Fallback Tier-1",
    latency: "~0,9s / cảnh",
    capability: "vi-VN · có timepoints",
    cost: "$16 / 1M ký tự",
    config: { endpoint: "https://texttospeech.googleapis.com/v1beta1", apiVersion: "v1beta1", maxTokens: 5000, temperature: 0 },
  },
  {
    id: "elevenlabs-turbo",
    kind: "voice",
    name: "ElevenLabs Turbo v2.5",
    vendor: "ElevenLabs",
    enabled: false,
    badge: "Enterprise Only",
    latency: "~0,6s / cảnh",
    capability: "Đa ngôn ngữ · voice cloning",
    cost: "$0,30 / 1.000 ký tự",
    config: { endpoint: "https://api.elevenlabs.io/v1", apiVersion: "v1", maxTokens: 5000, temperature: 0 },
  },
  {
    id: "openai-tts-hd",
    kind: "voice",
    name: "OpenAI TTS-1 HD",
    vendor: "OpenAI",
    enabled: false,
    badge: "Fallback Tier-2",
    latency: "~1,4s / cảnh",
    capability: "Đa ngôn ngữ · 6 giọng",
    cost: "$30 / 1M ký tự",
    config: { endpoint: "https://api.openai.com/v1/audio/speech", apiVersion: "v1", maxTokens: 4096, temperature: 0 },
  },
  {
    id: "fpt-voice",
    kind: "voice",
    name: "FPT AI Voice",
    vendor: "FPT.AI",
    enabled: false,
    badge: "Experimental",
    latency: "~1,0s / cảnh",
    capability: "Tiếng Việt 3 miền",
    cost: "Theo hợp đồng",
    config: { endpoint: "https://api.fpt.ai/hmi/tts/v5", apiVersion: "v5", maxTokens: 5000, temperature: 0 },
  },
];

/* ------------------------------------------------------------------ */
/* Danh mục giọng đọc cụ thể của từng model                             */
/* ------------------------------------------------------------------ */

export type VoiceGender = "female" | "male";

export interface VoiceEntry {
  id: string;
  /** Tên persona hiển thị cho người dùng cuối. */
  personaName: string;
  /** Tên gốc của giọng theo nhà cung cấp, hiển thị trong ngoặc. */
  originName: string;
  /** ID gọi sang nhà cung cấp. */
  providerVoiceId: string;
  /** Thuộc model nào trong VOICE_MODELS. */
  modelId: string;
  gender: VoiceGender;
  region: string;
  /** Tốc độ đọc mặc định, ví dụ 1.05 = 1.05x. */
  speed: number;
  /** Số lượt đã dùng để tạo video — đo mức độ ưa chuộng. */
  usageCount: number;
  /** Có trả timestamp từng từ không — quyết định karaoke chuẩn hay phải align lại. */
  supportsTimepoints: boolean;
  costPerMillionUsd: number;
  durationSec: number;
  enabled: boolean;
}

export const VOICE_GENDER_LABEL: Record<VoiceGender, string> = {
  female: "Nữ",
  male: "Nam",
};

/** 6 giọng đại diện: Bắc - Trung - Nam và một giọng tiếng Anh quốc tế. */
export const VOICE_CATALOG: VoiceEntry[] = [
  { id: "v-thao-my", personaName: "Thảo My", originName: "Ban Mai", providerVoiceId: "vi-VN-Chirp3-HD-Achernar", modelId: "google-chirp3", gender: "female", region: "Miền Bắc", speed: 1.05, usageCount: 2180, supportsTimepoints: false, costPerMillionUsd: 30, durationSec: 14, enabled: true },
  { id: "v-minh-khoi", personaName: "Minh Khôi", originName: "Minh Quang", providerVoiceId: "vi-VN-Chirp3-HD-Puck", modelId: "google-chirp3", gender: "male", region: "Miền Bắc", speed: 1.0, usageCount: 1890, supportsTimepoints: false, costPerMillionUsd: 30, durationSec: 16, enabled: true },
  { id: "v-huong-giang", personaName: "Hương Giang", originName: "Ngọc Huyền", providerVoiceId: "vi-VN-Chirp3-HD-Leda", modelId: "google-chirp3", gender: "female", region: "Miền Trung", speed: 0.85, usageCount: 980, supportsTimepoints: false, costPerMillionUsd: 30, durationSec: 15, enabled: true },
  { id: "v-mai-linh", personaName: "Mai Linh", originName: "Mỹ An", providerVoiceId: "vi-VN-Wavenet-C", modelId: "google-wavenet", gender: "female", region: "Miền Nam", speed: 1.1, usageCount: 1650, supportsTimepoints: true, costPerMillionUsd: 16, durationSec: 15, enabled: true },
  { id: "v-quoc-bao", personaName: "Quốc Bảo", originName: "Quốc Tuấn", providerVoiceId: "vi-VN-Chirp3-HD-Charon", modelId: "google-chirp3", gender: "male", region: "Miền Nam", speed: 1.15, usageCount: 1420, supportsTimepoints: false, costPerMillionUsd: 30, durationSec: 13, enabled: true },
  { id: "v-emma", personaName: "Emma", originName: "US Native Global", providerVoiceId: "en-US-Chirp3-HD-Kore", modelId: "google-chirp3", gender: "female", region: "Quốc tế", speed: 1.0, usageCount: 640, supportsTimepoints: false, costPerMillionUsd: 30, durationSec: 12, enabled: false },
];

export const SCRIPT_MODELS: AiModel[] = [
  {
    id: "gemini-flash",
    kind: "script",
    name: "Gemini 2.5 Flash",
    vendor: "Google",
    enabled: true,
    badge: "Default Primary",
    latency: "~1,8s / kịch bản",
    capability: "Ngữ cảnh 1M token",
    cost: "$0,30 / 1M token vào",
    config: { endpoint: "https://generativelanguage.googleapis.com/v1beta", apiVersion: "v1beta", maxTokens: 8192, temperature: 0.9 },
  },
  {
    id: "deepseek-v3",
    kind: "script",
    name: "DeepSeek V3",
    vendor: "DeepSeek",
    enabled: true,
    badge: "Fallback Tier-1",
    latency: "~2,4s / kịch bản",
    capability: "Ngữ cảnh 128K token",
    cost: "$0,27 / 1M token vào",
    config: { endpoint: "https://api.deepseek.com/v1", apiVersion: "v1", maxTokens: 8192, temperature: 0.8 },
  },
  {
    id: "gpt-4o",
    kind: "script",
    name: "GPT-4o",
    vendor: "OpenAI",
    enabled: true,
    badge: "Fallback Tier-2",
    latency: "~2,1s / kịch bản",
    capability: "Ngữ cảnh 128K token",
    cost: "$2,50 / 1M token vào",
    config: { endpoint: "https://api.openai.com/v1", apiVersion: "v1", maxTokens: 8192, temperature: 0.8 },
  },
  {
    id: "claude-sonnet",
    kind: "script",
    name: "Claude 3.5 Sonnet",
    vendor: "Anthropic",
    enabled: false,
    badge: "Enterprise Only",
    latency: "~2,6s / kịch bản",
    capability: "Ngữ cảnh 200K token",
    cost: "$3,00 / 1M token vào",
    config: { endpoint: "https://api.anthropic.com/v1", apiVersion: "2023-06-01", maxTokens: 8192, temperature: 0.8 },
  },
];

export const HOOK_RETENTION = {
  label: "Điểm giữ chân người xem",
  value: 78,
  hint: "Tỷ lệ giữ chân 3 giây đầu, đo trên 1.240 video gần nhất",
};

export interface RoutingRule {
  id: string;
  modelId: string;
  name: string;
  note: string;
}

export const ROUTING_STRATEGIES = [
  { id: "quality", label: "Chất lượng cao nhất" },
  { id: "speed", label: "Tốc độ nhanh nhất" },
  { id: "cost", label: "Chi phí rẻ nhất" },
] as const;

export const DEFAULT_ROUTING: RoutingRule[] = [
  { id: "r1", modelId: "gemini-flash", name: "Gemini 2.5 Flash", note: "Tối ưu chi phí và tốc độ viết kịch bản tiếng Việt" },
  { id: "r2", modelId: "deepseek-v3", name: "DeepSeek V3", note: "Kích hoạt khi Gemini quá tải hoặc trả 5xx" },
  { id: "r3", modelId: "gpt-4o", name: "GPT-4o", note: "Chốt chặn cuối, đảm bảo không đứt luồng dựng video" },
];

export const COST_LIMITS = {
  dailyBudgetUsd: 120,
  spentTodayUsd: 86.4,
  alertThresholdPercent: 90,
  channels: ["Telegram", "Email"],
  fallbackTimeoutMs: 200,
};
