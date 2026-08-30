export type ModelKind = "video" | "voice" | "script";

export type ModelBadge =
  | "Default Primary"
  | "Fallback Tier-1"
  | "Fallback Tier-2"
  | "Enterprise Only"
  | "Experimental";

/**
 * Danh mục model **không còn dữ liệu mẫu ở đây** — 14 model đã seed vào bảng `ai_models`
 * (migration `CreateAiModels`) và `ModelsSection` đọc qua `GET /admin/ai-models?kind=`.
 * Các kiểu bên dưới vẫn là hình dạng dùng chung giữa API và giao diện.
 */
/* ------------------------------------------------------------------ */
/* Cấu hình theo từng loại model — khớp với model-config.schema.ts       */
/* ------------------------------------------------------------------ */

export interface VoiceModelConfig {
  apiEndpoint: string;
  apiVersion: "v1" | "v1beta1";
  maxCharsPerRequest: number;
  audioEncoding: "MP3" | "LINEAR16" | "OGG_OPUS";
  defaultSpeakingRate: number;
  defaultPitch: number;
  /** Trần ký tự mỗi ngày; 0 = không giới hạn. */
  dailyCharLimit: number;
  /** Trần ký tự mỗi tháng; 0 = không giới hạn. */
  monthlyCharLimit: number;
}

export interface VideoModelConfig {
  apiEndpoint: string;
  resolution: "720p" | "1080p" | "4K";
  fps: 24 | 30 | 60;
  maxDurationSec: number;
  aspectRatios: ("9:16" | "16:9" | "1:1")[];
}

export interface ScriptModelConfig {
  apiEndpoint: string;
  apiVersion: string;
  maxTokens: number;
  temperature: number;
  topP: number | null;
}

export type ModelConfig = VoiceModelConfig | VideoModelConfig | ScriptModelConfig;

export type CostUnit =
  | "per_million_chars"
  | "per_second"
  | "per_million_input_tokens"
  | "contract";

export interface ModelCost {
  amount: number;
  unit: CostUnit;
  /** Số đơn vị cơ sở miễn phí mỗi tháng (ký tự / giây / token). */
  freeTierAmount: number | null;
}

export const COST_UNIT_OPTIONS: { id: CostUnit; label: string }[] = [
  { id: "per_million_chars", label: "$ / 1 triệu ký tự" },
  { id: "per_second", label: "$ / giây render" },
  { id: "per_million_input_tokens", label: "$ / 1 triệu token vào" },
  { id: "contract", label: "Theo hợp đồng" },
];

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
  /** Cấu hình kỹ thuật, schema khác nhau theo `kind`. */
  config: ModelConfig;
  cost: ModelCost;
  /** Chuỗi hiển thị do backend dựng từ `cost`. */
  costLabel: string;
  /** Model chưa mở — hiển thị nhưng khoá mọi thao tác. */
  comingSoon?: boolean;
  /** Nhà cung cấp credential dùng để gọi model; null = chỉ là khai báo thủ công. */
  credentialProvider: string | null;
  /** Lần cuối nhà cung cấp thật sự chấp nhận credential này. */
  verifiedAt: string | null;
  verificationNote: string | null;
  lastLatencyMs: number | null;
}

/** Nhà cung cấp có luồng xác minh thật ở backend. */
export const VERIFIABLE_PROVIDERS = [
  { id: "google-tts", label: "Google Cloud TTS" },
] as const;





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
  /** Thuộc model nào trong bảng `ai_models` (kind = voice). */
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
  /** Lần cuối nhà cung cấp xác nhận `providerVoiceId` này có thật. */
  verifiedAt: string | null;
  verificationNote: string | null;
  /** Câu thoại ngắn dùng để nghe thử giọng này. */
  sampleText: string;
}

/** Giới hạn câu thoại nghe thử — mỗi lần nghe đều tính tiền theo ký tự. */
export const MAX_SAMPLE_CHARS = 300;

/**
 * Các mức tốc độ đọc, lấy đúng bộ của YouTube.
 * Nằm gọn trong khoảng 0.25–4 mà Google chấp nhận, và cũng là khoảng `playbackRate`
 * của trình duyệt nghe còn tự nhiên.
 */
export const SPEED_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

/** Mức gần nhất với một giá trị bất kỳ đã lưu trong database. */
export const nearestSpeedStep = (speed: number): number =>
  SPEED_STEPS.reduce((best, step) =>
    Math.abs(step - speed) < Math.abs(best - speed) ? step : best,
  );

export const VOICE_GENDER_LABEL: Record<VoiceGender, string> = {
  female: "Nữ",
  male: "Nam",
};

/**
 * Danh mục giọng **không còn dữ liệu mẫu ở đây** — 6 giọng đại diện đã được seed vào
 * bảng `voices` (migration `SeedVoices`) và `VoiceCatalog` đọc thẳng qua
 * `GET /admin/voices`. Interface `VoiceEntry` phía trên vẫn là hình dạng dùng chung
 * giữa API và giao diện.
 */



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
