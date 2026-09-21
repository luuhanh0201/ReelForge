import { PRODUCT_FIELDS, type ProductField, type ProductInfo } from "./product.js";

/**
 * Điều kiện để **được phép gọi AI viết kịch bản**.
 *
 * Gọi mô hình khi chưa đủ dữ liệu vừa tốn quota vừa cho ra kịch bản bịa — nguy hiểm nhất là
 * bịa giá, vì con số đó sẽ nằm trên video bán hàng thật của người dùng. Nên cổng này đứng
 * trước mọi lệnh gọi, và **web lẫn API dùng chung đúng hàm này**: giao diện khoá nút theo
 * nó, máy chủ từ chối cũng theo nó.
 */

/** Ngoài `ProductField`, cổng còn xét những thứ không nằm trong bản ghi sản phẩm. */
export type ScriptRequirement = ProductField | "model";

export const SCRIPT_REQUIREMENT_LABELS: Record<ScriptRequirement, string> = {
  name: "tên sản phẩm",
  price: "giá bán",
  description: "mô tả sản phẩm",
  images: "ảnh sản phẩm",
  model: "model AI đang bật",
};

/** Mô tả ngắn hơn mức này thì kịch bản sẽ nhạt, nhưng vẫn viết được. */
export const MIN_USEFUL_DESCRIPTION = 40;

export interface ScriptReadiness {
  /** Đủ điều kiện gọi AI. `false` thì dùng bộ mẫu. */
  ready: boolean;
  /** Thiếu hẳn, chặn việc gọi AI. */
  missing: ScriptRequirement[];
  /** Có cũng được, thiếu thì kịch bản kém hơn — không chặn. */
  warnings: ScriptRequirement[];
  /** Câu giải thích sẵn cho giao diện và cho báo cáo từng bước của luồng tự động. */
  reason: string;
}

const list = (items: ScriptRequirement[]): string =>
  items.map((item) => SCRIPT_REQUIREMENT_LABELS[item]).join(", ");

export function scriptReadiness(input: {
  product: Partial<ProductInfo>;
  assetCount: number;
  /** Có model kịch bản **đang bật và đã xác minh** hay không. */
  hasEnabledModel: boolean;
}): ScriptReadiness {
  const { product, assetCount, hasEnabledModel } = input;

  const missing: ScriptRequirement[] = [];
  if (!product.name?.trim()) missing.push("name");
  // Giá là trường duy nhất mà đoán sai gây hại thật: người xem tin con số trên video.
  if (!product.price?.trim()) missing.push("price");
  if (assetCount === 0) missing.push("images");
  if (!hasEnabledModel) missing.push("model");

  const warnings: ScriptRequirement[] = [];
  if ((product.description?.trim().length ?? 0) < MIN_USEFUL_DESCRIPTION) {
    warnings.push("description");
  }

  if (missing.length > 0) {
    return {
      ready: false,
      missing,
      warnings,
      reason: missing.includes("model")
        ? missing.length === 1
          ? "Chưa bật model AI viết kịch bản"
          : `Chưa bật model AI, và còn thiếu ${list(missing.filter((item) => item !== "model"))}`
        : `Còn thiếu ${list(missing)}`,
    };
  }

  return {
    ready: true,
    missing,
    warnings,
    reason:
      warnings.length > 0
        ? `Đủ dữ liệu, nhưng thiếu ${list(warnings)} nên kịch bản sẽ chung chung hơn`
        : "Đủ dữ liệu cho AI viết kịch bản",
  };
}

/** Các trường sản phẩm cổng này quan tâm — dùng cho giao diện tô màu ô còn trống. */
export const SCRIPT_PRODUCT_FIELDS: readonly ProductField[] = PRODUCT_FIELDS;
