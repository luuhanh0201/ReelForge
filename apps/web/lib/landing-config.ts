import "server-only";
import type { LandingConfig } from "@/lib/admin/landing-cms-api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Đọc cấu hình CMS lúc render trang chủ.
 *
 * **Trả về `null` khi API hỏng** — landing phải lên được bằng nội dung tĩnh trong
 * `content.config.ts`. Trang bán hàng không bao giờ được trắng chỉ vì API admin chết.
 */
export const loadLandingConfig = async (): Promise<LandingConfig | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/landing-config`, {
      // Cấu hình đổi là thấy ngay, không cần build lại.
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });

    if (!response.ok) return null;

    return (await response.json()) as LandingConfig;
  } catch {
    return null;
  }
};
