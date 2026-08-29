import { Clapperboard, FileSearch, Mic2, Webhook, type LucideIcon } from "lucide-react";

/** Chu kỳ làm mới dùng chung với các dashboard hạ tầng khác. */
export { REFRESH_OPTIONS, resolveRefreshMs } from "./monitoring.config";
export type { RefreshOptionId } from "./monitoring.config";

/** Ngưỡng đổi màu cảnh báo cho thanh bộ nhớ. */
export const MEMORY_THRESHOLDS = { warning: 60, critical: 80 } as const;
export type LatencyAccent = "mint" | "amber" | "brand" | "danger";

export interface LatencyLevel {
  /** Giới hạn trên của mức, tính bằng ms. `null` nghĩa là không có trần. */
  maxMs: number | null;
  label: string;
  accent: LatencyAccent;
  /** Mô tả khoảng để hiển thị kèm nhãn. */
  range: string;
}

/** Thang đánh giá độ trễ ping Redis. */
export const LATENCY_LEVELS: LatencyLevel[] = [
  { maxMs: 50, label: "Tốt", accent: "mint", range: "0–50ms" },
  { maxMs: 100, label: "Cảnh báo", accent: "amber", range: "51–100ms" },
  { maxMs: 150, label: "Cao", accent: "brand", range: "101–150ms" },
  { maxMs: null, label: "Nghiêm trọng", accent: "danger", range: "> 150ms" },
];

export const resolveLatencyLevel = (latencyMs: number): LatencyLevel =>
  LATENCY_LEVELS.find((level) => level.maxMs === null || latencyMs <= level.maxMs) ??
  LATENCY_LEVELS[LATENCY_LEVELS.length - 1]!;

export type ThroughputAccent = "muted" | "mint" | "amber" | "brand" | "danger";

export interface ThroughputLevel {
  /** Giới hạn trên của mức, tính bằng cmd/s. `null` nghĩa là không có trần. */
  maxOps: number | null;
  label: string;
  accent: ThroughputAccent;
  range: string;
}

/** Thang đánh giá tốc độ xử lý lệnh của Redis. */
export const THROUGHPUT_LEVELS: ThroughputLevel[] = [
  { maxOps: 0, label: "Không có tải", accent: "muted", range: "0 cmd/s" },
  { maxOps: 100, label: "Rất nhẹ", accent: "mint", range: "1–100 cmd/s" },
  { maxOps: 500, label: "Bình thường", accent: "mint", range: "101–500 cmd/s" },
  { maxOps: 1000, label: "Tải trung bình", accent: "amber", range: "501–1.000 cmd/s" },
  { maxOps: 2000, label: "Tải cao", accent: "brand", range: "1.001–2.000 cmd/s" },
  { maxOps: null, label: "Tải rất cao", accent: "danger", range: "> 2.000 cmd/s" },
];

export const resolveThroughputLevel = (opsPerSec: number): ThroughputLevel =>
  THROUGHPUT_LEVELS.find((level) => level.maxOps === null || opsPerSec <= level.maxOps) ??
  THROUGHPUT_LEVELS[THROUGHPUT_LEVELS.length - 1]!;

/* ------------------------------------------------------------------ */
/* Hàng đợi BullMQ                                                      */
/* ------------------------------------------------------------------ */

export interface BullQueueData {
  id: string;
  name: string;
  icon: LucideIcon;
  purpose: string;
  waiting: number;
  active: number;
  done: number;
  failed: number;
  workers: number;
  avgDuration: string;
}

export const BULL_QUEUES: BullQueueData[] = [
  {
    id: "video-render-pipeline",
    name: "Render video",
    icon: Clapperboard,
    purpose:
      "Ghép phân cảnh, tạo transition, chèn phụ đề động và xuất MP4 1080p bằng Canvas/FFmpeg.",
    waiting: 4,
    active: 3,
    done: 1842,
    failed: 2,
    workers: 4,
    avgDuration: "12,5s/job",
  },
  {
    id: "tts-audio-synthesis",
    name: "Giọng đọc AI",
    icon: Mic2,
    purpose:
      "Gọi API ElevenLabs, FPT AI Voice và Azure Neural để tạo file audio lồng tiếng.",
    waiting: 1,
    active: 2,
    done: 3918,
    failed: 0,
    workers: 2,
    avgDuration: "1,8s/job",
  },
  {
    id: "ai-script-extraction",
    name: "Bóc tách kịch bản",
    icon: FileSearch,
    purpose:
      "Cào dữ liệu Shopee/TikTok Shop và tạo 4 phân cảnh kịch bản bằng Gemini 2.5 Flash.",
    waiting: 0,
    active: 1,
    done: 2145,
    failed: 1,
    workers: 2,
    avgDuration: "2,4s/job",
  },
  {
    id: "affiliate-webhook-sync",
    name: "Đồng bộ webhook",
    icon: Webhook,
    purpose:
      "Tiếp nhận và đối soát hoa hồng tức thì từ TikTok Shop Partner và Shopee Affiliate.",
    waiting: 0,
    active: 0,
    done: 8490,
    failed: 0,
    workers: 1,
    avgDuration: "85ms/job",
  },
];

/* ------------------------------------------------------------------ */
/* Jobs                                                                 */
/* ------------------------------------------------------------------ */

export type JobStatus = "active" | "waiting" | "failed";

export interface QueueJobItem {
  id: string;
  title: string;
  detail: string;
  queueId: string;
  status: JobStatus;
  /** Phần trăm hoàn thành, chỉ có ở job đang chạy. */
  progress?: number;
  /** Thời gian đã xử lý hoặc thời gian kể từ khi tạo. */
  elapsed: string;
  /** Nguyên nhân lỗi, chỉ có ở job failed. */
  error?: string;
  attempt?: number;
  maxAttempts?: number;
}

export const QUEUE_JOBS: QueueJobItem[] = [
  { id: "job_vrd_9821", title: "Máy lọc không khí Gen4 Pro", detail: "1080p · 4 phân cảnh · 32s", queueId: "video-render-pipeline", status: "active", progress: 68, elapsed: "8,4s" },
  { id: "job_vrd_9822", title: "Nồi chiên không dầu 6L", detail: "1080p · 5 phân cảnh · 28s", queueId: "video-render-pipeline", status: "active", progress: 42, elapsed: "5,1s" },
  { id: "job_tts_4417", title: "Son kem lì Velvet Matte", detail: "Ban Mai · 486 ký tự", queueId: "tts-audio-synthesis", status: "active", progress: 89, elapsed: "1,6s" },
  { id: "job_scr_2210", title: "Tai nghe Bluetooth Air 5", detail: "Gemini 2.5 Flash · 4 phân cảnh", queueId: "ai-script-extraction", status: "active", progress: 55, elapsed: "1,3s" },
  { id: "job_vrd_9823", title: "Áo khoác dù unisex", detail: "1080p · 4 phân cảnh · 30s", queueId: "video-render-pipeline", status: "waiting", elapsed: "chờ 12s" },
  { id: "job_tts_4418", title: "Máy hút bụi cầm tay", detail: "Quốc Tuấn · 512 ký tự", queueId: "tts-audio-synthesis", status: "waiting", elapsed: "chờ 4s" },
  { id: "job_vrd_9819", title: "Bàn phím cơ RGB", detail: "1080p · 6 phân cảnh · 45s", queueId: "video-render-pipeline", status: "failed", elapsed: "11,2s", error: "Runway ML 504 Gateway Timeout", attempt: 2, maxAttempts: 3 },
  { id: "job_vrd_9820", title: "Ghế công thái học", detail: "1080p · 5 phân cảnh · 38s", queueId: "video-render-pipeline", status: "failed", elapsed: "9,8s", error: "Runway ML 504 Gateway Timeout", attempt: 1, maxAttempts: 3 },
  { id: "job_scr_2208", title: "Kem chống nắng SPF50", detail: "Link Shopee · bóc tách sản phẩm", queueId: "ai-script-extraction", status: "failed", elapsed: "3,4s", error: "Shopee Anti-bot Challenge (captcha)", attempt: 3, maxAttempts: 3 },
];

/* ------------------------------------------------------------------ */
/* Phân bổ bộ nhớ theo tiền tố key                                      */
/* ------------------------------------------------------------------ */

export interface KeyspaceSlice {
  prefix: string;
  label: string;
  percent: number;
  sizeMb: number;
  accent: "brand" | "amber" | "info" | "voice" | "mint";
}

export const KEYSPACE_BREAKDOWN: KeyspaceSlice[] = [
  { prefix: "bullmq:*", label: "Hàng đợi & payload video", percent: 45, sizeMb: 154, accent: "brand" },
  { prefix: "cache:product_links:*", label: "Cache link Shopee/TikTok", percent: 26, sizeMb: 89, accent: "amber" },
  { prefix: "cache:ai_scripts:*", label: "Cache kịch bản Gemini", percent: 15, sizeMb: 51, accent: "info" },
  { prefix: "session:user_tokens:*", label: "Phiên đăng nhập & token", percent: 8, sizeMb: 27, accent: "voice" },
  { prefix: "ratelimit:*", label: "Bộ đếm rate limit", percent: 6, sizeMb: 21, accent: "mint" },
];

/** Dung lượng giải phóng được khi dọn cache link sản phẩm quá 7 ngày. */
export const RECLAIMABLE_CACHE_MB = 96;
