"use client";

import { Check, Loader2, MinusCircle, TriangleAlert, Wand2 } from "lucide-react";
import {
  AUTOBUILD_STEPS,
  AUTOBUILD_STEP_LABELS,
  type AutobuildStepReport,
} from "@/lib/studio/projects-api";

/**
 * Lớp phủ lúc hệ thống tự dựng video.
 *
 * **Không vẽ tiến trình giả.** Máy chủ chạy cả chuỗi trong một lệnh gọi nên trình duyệt
 * không biết đang tới bước nào; tick từng bước theo đồng hồ chỉ là nói dối cho đẹp. Lúc
 * chạy chỉ liệt kê những việc sắp làm, xong mới hiện kết quả thật của từng bước.
 *
 * Khi mọi bước trót lọt thì lớp phủ tự tắt — người dùng vào thẳng phòng dựng. Chỉ khi có
 * bước hỏng hoặc bị bỏ qua nó mới ở lại, vì lúc đó người dùng cần biết mình phải làm gì
 * tiếp.
 */
export function AutobuildOverlay({
  running,
  steps,
  onClose,
}: {
  running: boolean;
  steps: AutobuildStepReport[] | null;
  onClose: () => void;
}) {
  if (!running && !steps) return null;

  const byStep = new Map(steps?.map((item) => [item.step, item]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10151e]/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-btn bg-voice/15 text-voice">
            {running ? <Loader2 size={17} className="animate-spin" /> : <Wand2 size={17} />}
          </span>
          <div className="min-w-0">
            <p className="font-display text-base font-bold text-ink">
              {running ? "Đang dựng video của bạn" : "Đã dựng xong"}
            </p>
            <p className="text-xs text-muted">
              {running
                ? "Mất khoảng 20–40 giây, bạn đừng đóng tab nhé"
                : "Xem lại rồi sửa chỗ nào bạn thấy chưa ưng"}
            </p>
          </div>
        </div>

        <ul className="mt-4 flex flex-col gap-1.5">
          {AUTOBUILD_STEPS.map((step) => {
            const report = byStep.get(step);

            return (
              <li key={step} className="flex items-start gap-2.5">
                <StepIcon status={report?.status} running={running} />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-xs font-semibold ${
                      report?.status === "failed" ? "text-amber" : "text-ink"
                    }`}
                  >
                    {AUTOBUILD_STEP_LABELS[step]}
                  </span>
                  {report ? (
                    <span className="block text-[11px] leading-snug text-muted">
                      {report.detail}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>

        {!running ? (
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-btn bg-brand text-sm font-bold text-[#10151e] transition-transform hover:-translate-y-0.5"
          >
            Kiểm tra video
          </button>
        ) : null}
      </div>
    </div>
  );
}

function StepIcon({
  status,
  running,
}: {
  status: AutobuildStepReport["status"] | undefined;
  running: boolean;
}) {
  if (status === "done") return <Check size={14} className="mt-0.5 shrink-0 text-mint" />;
  if (status === "failed") {
    return <TriangleAlert size={14} className="mt-0.5 shrink-0 text-amber" />;
  }
  if (status === "skipped") {
    return <MinusCircle size={14} className="mt-0.5 shrink-0 text-muted" />;
  }

  return (
    <span
      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
        running ? "bg-line" : "bg-subtle"
      }`}
    />
  );
}
