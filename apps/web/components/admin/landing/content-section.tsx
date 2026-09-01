"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import type { LandingConfig, Localized } from "@/lib/admin/landing-cms-api";
import { AdminButton, AdminCard, AdminInput } from "@/components/admin/primitives";

type TextField = Exclude<keyof LandingConfig["content"], "keywords">;

const FIELDS: { id: TextField; label: string; hint?: string; multiline?: boolean }[] = [
  { id: "heroBadge", label: "Huy hiệu Hero" },
  { id: "heroTitlePrefix", label: "Tiêu đề H1 (phần cố định trước từ khoá)" },
  { id: "heroSubtitle", label: "Đoạn mô tả dưới tiêu đề", multiline: true },
  { id: "primaryCta", label: "Nhãn nút CTA chính" },
  { id: "secondaryCta", label: "Nhãn nút CTA phụ" },
];

/**
 * Nội dung Hero. Mỗi trường có hai ô **Tiếng Việt** và **Tiếng Anh** vì landing đang
 * song ngữ; sửa tiếng Việt mà bỏ trống tiếng Anh thì backend tạm lấy chính chuỗi tiếng
 * Việt (Cloud Translation API chưa bật).
 */
export function ContentSection({
  config,
  onChange,
}: {
  config: LandingConfig;
  onChange: (patch: (current: LandingConfig) => LandingConfig) => void;
}) {
  const [keyword, setKeyword] = useState("");

  const setField = (id: TextField, locale: keyof Localized, value: string) =>
    onChange((current) => ({
      ...current,
      content: {
        ...current.content,
        [id]: { ...current.content[id], [locale]: value },
      },
    }));

  const addKeyword = () => {
    const text = keyword.trim();
    if (text === "") return;

    onChange((current) => ({
      ...current,
      content: {
        ...current.content,
        keywords: [...current.content.keywords, { vi: text, en: text }],
      },
    }));
    setKeyword("");
  };

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <AdminCard>
        <h2 className="font-display text-base font-bold text-ink">Tiêu đề & nút CTA</h2>

        <div className="mt-4 flex flex-col gap-4">
          {FIELDS.map((field) => (
            <div key={field.id} className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-muted">{field.label}</span>

              {(["vi", "en"] as const).map((locale) => (
                <label key={locale} className="flex items-center gap-2">
                  <span className="w-6 shrink-0 font-mono text-[11px] font-bold text-muted">
                    {locale.toUpperCase()}
                  </span>

                  {field.multiline ? (
                    <textarea
                      aria-label={`${field.label} (${locale})`}
                      rows={2}
                      value={config.content[field.id][locale]}
                      onChange={(event) => setField(field.id, locale, event.target.value)}
                      className="w-full resize-none rounded-btn border border-line bg-subtle px-3.5 py-2 text-sm text-ink outline-none focus:border-brand/50"
                    />
                  ) : (
                    <AdminInput
                      ariaLabel={`${field.label} (${locale})`}
                      value={config.content[field.id][locale]}
                      onChange={(value) => setField(field.id, locale, value)}
                      className="w-full"
                    />
                  )}
                </label>
              ))}
            </div>
          ))}
        </div>
      </AdminCard>

      <AdminCard>
        <h2 className="font-display text-base font-bold text-ink">
          Từ khoá chạy chữ trong tiêu đề
        </h2>
        <p className="mt-0.5 text-xs text-muted">
          {config.content.keywords.length} từ khoá · đổi mỗi 2,8 giây trên landing
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {config.content.keywords.map((item, index) => (
            <span
              key={`${item.vi}-${index}`}
              className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-subtle py-1 pl-3 pr-1 text-xs font-semibold text-ink"
            >
              {item.vi}
              <button
                type="button"
                title={`Xóa từ khoá ${item.vi}`}
                aria-label={`Xóa từ khoá ${item.vi}`}
                disabled={config.content.keywords.length <= 1}
                onClick={() =>
                  onChange((current) => ({
                    ...current,
                    content: {
                      ...current.content,
                      keywords: current.content.keywords.filter((_, i) => i !== index),
                    },
                  }))
                }
                className="rounded-btn p-1 text-muted transition-colors hover:bg-danger/15 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>

        {config.content.keywords.length <= 1 ? (
          <p className="mt-3 text-[11px] text-muted">
            Phải giữ ít nhất một từ khoá — tiêu đề cần có gì đó để chạy.
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <AdminInput
            ariaLabel="Từ khoá mới"
            value={keyword}
            onChange={setKeyword}
            placeholder="Ví dụ: Shopee Top 1"
            className="w-full sm:w-60"
          />
          <AdminButton variant="primary" onClick={addKeyword} disabled={keyword.trim() === ""}>
            <Plus size={14} />
            Thêm từ khoá
          </AdminButton>
        </div>
      </AdminCard>
    </div>
  );
}
