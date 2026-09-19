"use client";

import { CircleCheck, ExternalLink, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  PRODUCT_LIMITS,
  SHOP_LABELS,
  type ProductField,
  type ProductInfo,
} from "@repo/shared";
import type { Project } from "@/lib/studio/projects-api";

type TextField = "name" | "price" | "originalPrice" | "description";

const FIELD_LABEL: Record<ProductField, string> = {
  name: "tên",
  price: "giá",
  description: "mô tả",
  images: "ảnh",
};

const inputClass = (warn: boolean) =>
  `w-full rounded-btn border bg-canvas px-2.5 text-xs text-ink outline-none transition-colors focus:border-brand/50 ${
    warn ? "border-amber/60" : "border-line"
  }`;

/**
 * Thông tin sản phẩm của dự án, nằm đầu tab Nội dung.
 *
 * Với dự án tạo từ link, đây là nơi người dùng **kiểm tra và sửa** những gì máy đọc được —
 * sàn thương mại điện tử chặn bot thường xuyên, nên form nhập tay là đường chính chứ không
 * phải đường phụ. Trường nào máy không đọc ra được viền `amber` cho tới khi được điền.
 *
 * Tên và giá được chèn vào mẫu kịch bản (`{ten}`, `{gia}`), nên mục này hiện cho cả dự án
 * tự viết nội dung.
 */
export function ProductSection({
  project,
  hasImages,
  busy,
  importing,
  onChange,
  onCommit,
  onReimport,
}: {
  project: Project;
  /** Dự án đã có ảnh hay chưa — tải tay lên rồi thì thôi nhắc thiếu ảnh. */
  hasImages: boolean;
  busy: boolean;
  importing: boolean;
  onChange: (patch: Partial<ProductInfo>) => void;
  /** Nhận thẳng sản phẩm **sau khi đổi**, vì state của trang chưa kịp cập nhật. */
  onCommit: (product: Partial<ProductInfo>) => void;
  onReimport: () => void;
}) {
  const product = project.product;
  const crawl = product.crawl;
  const missing = new Set(crawl?.missingFields ?? []);
  const isLink = project.mode === "link";
  const platform = product.platform && product.platform !== "manual" ? product.platform : null;

  /**
   * Bản đã nằm trên máy chủ. Ô nhập đổi `project` ngay khi gõ, nên không so được với
   * `project` lúc rời ô — phải giữ riêng bản đã lưu để biết có gì thật sự đổi hay không.
   * Mỗi lần máy chủ trả dự án mới (`updatedAt` đổi) thì chép lại.
   */
  const saved = useRef(product);
  useEffect(() => {
    saved.current = project.product;
    // Cố ý không phụ thuộc `project.product`: nó đổi theo từng phím gõ, chép theo nó thì
    // bản "đã lưu" luôn bằng bản đang gõ và không lần rời ô nào được lưu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.updatedAt]);

  const warn = (field: ProductField, value: string | undefined) =>
    isLink && missing.has(field) && !value?.trim();

  const field = (key: TextField) => ({
    value: product[key] ?? "",
    maxLength: PRODUCT_LIMITS[key === "originalPrice" ? "price" : key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ [key]: event.target.value }),
    onBlur: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if ((saved.current[key] ?? "") === event.target.value) return;
      onCommit({ ...product, [key]: event.target.value });
    },
  });

  // Chỉ nhắc những trường người dùng **còn** chưa điền; điền xong thì dòng nhắc tự thu lại.
  const stillMissing = [...missing].filter((key) =>
    key === "images" ? !hasImages : !product[key]?.trim(),
  );

  return (
    <div className="flex flex-col gap-2.5">
      {isLink ? (
        <div className="rounded-btn border border-line bg-canvas p-2.5">
          <div className="flex items-center gap-2">
            <span className="shrink-0 rounded-btn bg-subtle px-1.5 py-0.5 text-[10px] font-bold text-muted">
              {platform ? SHOP_LABELS[platform] : "Link"}
            </span>
            {project.sourceUrl ? (
              <a
                href={project.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                title={project.sourceUrl}
                className="flex min-w-0 flex-1 items-center gap-1 text-[11px] text-muted hover:text-ink"
              >
                <span className="truncate">{project.sourceUrl}</span>
                <ExternalLink size={11} className="shrink-0" />
              </a>
            ) : (
              <span className="flex-1 text-[11px] text-muted">Chưa có link</span>
            )}
            <button
              type="button"
              onClick={onReimport}
              disabled={busy || importing || !project.sourceUrl}
              title="Đọc lại link — không ghi đè những trường bạn đã sửa"
              aria-label="Đọc lại link"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-btn border border-line bg-surface text-muted transition-colors hover:border-brand/40 hover:text-ink disabled:opacity-45"
            >
              {importing ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <RefreshCw size={13} />
              )}
            </button>
          </div>

          {crawl ? <CrawlStatus status={crawl.status} missing={stillMissing} /> : null}
        </div>
      ) : null}

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold text-muted">Tên sản phẩm</span>
        <input
          {...field("name")}
          placeholder="Ví dụ: Tai nghe Bluetooth K29"
          className={`h-9 ${inputClass(warn("name", product.name))}`}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-muted">Giá bán</span>
          <input
            {...field("price")}
            placeholder="199.000đ"
            className={`h-9 font-mono ${inputClass(warn("price", product.price))}`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-muted">Giá gốc</span>
          <input
            {...field("originalPrice")}
            placeholder="Không bắt buộc"
            className={`h-9 font-mono ${inputClass(false)}`}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold text-muted">Mô tả</span>
        <textarea
          {...field("description")}
          rows={4}
          placeholder="Điểm nổi bật, thông số, ưu đãi…"
          className={`resize-y py-2 leading-relaxed ${inputClass(
            warn("description", product.description),
          )}`}
        />
      </label>

      <p className="text-[11px] leading-relaxed text-muted">
        Tên và giá được chèn vào mẫu kịch bản bên dưới. Sửa xong thì chọn lại mẫu để cập nhật
        lời thoại.
      </p>
    </div>
  );
}

function CrawlStatus({
  status,
  missing,
}: {
  status: NonNullable<Project["product"]["crawl"]>["status"];
  missing: ProductField[];
}) {
  if (status === "failed") {
    return (
      <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-amber">
        <TriangleAlert size={12} className="mt-0.5 shrink-0" />
        <span>
          Sàn không trả dữ liệu cho link này. Bạn điền tay bên dưới và tải ảnh sản phẩm lên,
          hoặc thử đọc lại sau ít phút.
        </span>
      </p>
    );
  }

  if (missing.length === 0) {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-mint">
        <CircleCheck size={12} className="shrink-0" />
        Đã có đủ thông tin sản phẩm
      </p>
    );
  }

  return (
    <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-amber">
      <TriangleAlert size={12} className="mt-0.5 shrink-0" />
      <span>
        Không đọc được {missing.map((key) => FIELD_LABEL[key]).join(", ")}
        {missing.includes("images") ? " — tải ảnh lên ở mục Ảnh và video." : ", vui lòng điền tay."}
      </span>
    </p>
  );
}
