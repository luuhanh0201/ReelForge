"use client";

import {
  ArrowDown,
  ArrowUp,
  Compass,
  ExternalLink,
  Loader2,
  Plus,
  Save,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { findBrokenSteps, TourPlacements, type Tour, type TourScope, type TourStep } from "@repo/shared";
import {
  AdminButton,
  AdminCard,
  AdminInput,
  AdminPageHeader,
  AdminSelect,
  Pill,
  ToggleSwitch,
} from "@/components/admin/primitives";
import {
  fetchAdminTour,
  publishTour,
  type TourStats,
  type TourVersionView,
} from "@/lib/tour/tour-api";
import { useToast } from "@/components/ui/toast";

/**
 * Quản trị tour hướng dẫn.
 *
 * Neo và hành động **luôn là dropdown dựng từ danh mục của mã nguồn**, không bao giờ là ô
 * gõ tự do: một selector gõ sai sẽ khiến bước đó bị bỏ qua ở phía người dùng mà không có
 * gì báo lỗi. Cảnh báo hiện ngay trong trình soạn nếu một bước trỏ vào neo đã bị gỡ khỏi
 * giao diện.
 */
export default function AdminToursPage() {
  const [scopeKey, setScopeKey] = useState("studio");
  const [scopes, setScopes] = useState<TourScope[]>([]);
  const [tour, setTour] = useState<Tour | null>(null);
  const [history, setHistory] = useState<TourVersionView[]>([]);
  const [stats, setStats] = useState<TourStats | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = useCallback(
    (key: string) => {
      setLoading(true);

      fetchAdminTour(key)
        .then((result) => {
          setTour(result.tour);
          setScopes(result.scopes);
          setHistory(result.history);
          setStats(result.stats);
          setNote("");
        })
        .catch((cause: unknown) => {
          toast(cause instanceof Error ? cause.message : "Không đọc được tour", "danger");
        })
        .finally(() => setLoading(false));
    },
    [toast],
  );

  useEffect(() => {
    // `load` gọi `setLoading` ngay lập tức; bọc trong một nhịp để React commit xong lần
    // render này trước, thay vì đẩy thêm một vòng render nối tiếp.
    const timer = setTimeout(() => load(scopeKey), 0);
    return () => clearTimeout(timer);
  }, [load, scopeKey]);

  const scope = useMemo(
    () => scopes.find((item) => item.key === scopeKey),
    [scopes, scopeKey],
  );

  const broken = useMemo(
    () => (tour ? findBrokenSteps(tour, scope) : []),
    [tour, scope],
  );

  const brokenById = useMemo(
    () => new Map(broken.map((item) => [item.stepId, item.reason])),
    [broken],
  );

  const patchStep = (index: number, patch: Partial<TourStep>) => {
    if (!tour) return;
    const steps = tour.steps.map((step, position) =>
      position === index ? { ...step, ...patch } : step,
    );
    setTour({ ...tour, steps });
  };

  const move = (index: number, delta: number) => {
    if (!tour) return;
    const target = index + delta;
    if (target < 0 || target >= tour.steps.length) return;

    const steps = [...tour.steps];
    const [moved] = steps.splice(index, 1);
    if (!moved) return;
    steps.splice(target, 0, moved);
    setTour({ ...tour, steps });
  };

  const addStep = () => {
    if (!tour || !scope) return;

    // Mã bước phải duy nhất và **ổn định**: thống kê rơi rớt gộp theo mã này.
    const used = new Set(tour.steps.map((step) => step.id));
    let suffix = tour.steps.length + 1;
    while (used.has(`buoc-${suffix}`)) suffix += 1;

    setTour({
      ...tour,
      steps: [
        ...tour.steps,
        {
          id: `buoc-${suffix}`,
          anchor: scope.anchors[0]?.id ?? "",
          title: "Tiêu đề bước",
          body: "Mô tả ngắn cho người dùng mới.",
          placement: "auto",
          prepare: null,
        },
      ],
    });
  };

  const save = async () => {
    if (!tour) return;

    setSaving(true);

    try {
      const result = await publishTour(scopeKey, tour, note);

      if (result.broken.length > 0) {
        toast(
          `Đã xuất bản, nhưng ${result.broken.length} bước trỏ vào neo không tồn tại.`,
          "warning",
        );
      } else {
        toast("Đã xuất bản phiên bản mới.", "success");
      }

      load(scopeKey);
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "Không xuất bản được", "danger");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !tour) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={22} className="animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title="Tour hướng dẫn"
        description="Nội dung chỉ dẫn cho người dùng mới. Neo và hành động do mã nguồn khai báo, ở đây chỉ chọn từ danh sách."
        actions={
          <>
            <AdminSelect
              value={scopeKey}
              onChange={setScopeKey}
              ariaLabel="Chọn khu vực"
              options={scopes.map((item) => ({ id: item.key, label: item.label }))}
            />
            {scope ? (
              <Link
                href={scope.path}
                target="_blank"
                className="inline-flex h-9 items-center gap-1.5 rounded-btn border border-line bg-subtle px-3.5 text-sm font-medium text-ink transition-colors hover:border-brand/45"
              >
                <ExternalLink size={14} />
                Mở khu vực
              </Link>
            ) : null}
            <AdminButton onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Xuất bản
            </AdminButton>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <AdminCard>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex min-w-[220px] flex-1 flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted">Tên tour</span>
                <AdminInput
                  value={tour.label}
                  onChange={(label) => setTour({ ...tour, label })}
                  ariaLabel="Tên tour"
                />
              </label>

              <ToggleSwitch
                checked={tour.enabled}
                onChange={(enabled) => setTour({ ...tour, enabled })}
                label="Bật tour"
              />
              <ToggleSwitch
                checked={tour.autoStart}
                onChange={(autoStart) => setTour({ ...tour, autoStart })}
                label="Tự mở cho người mới"
              />
            </div>

            <p className="mt-3 text-xs leading-relaxed text-muted">
              Tắt <strong className="text-ink">Tự mở</strong> thì tour chỉ chạy khi người
              dùng bấm &ldquo;Xem lại hướng dẫn&rdquo;. Người đã bấm bỏ qua sẽ không bao giờ
              thấy tour tự mở nữa, dù tuỳ chọn này đang bật.
            </p>
          </AdminCard>

          {broken.length > 0 ? (
            <AdminCard className="border-amber/40 bg-amber/[0.06]">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber">
                <TriangleAlert size={15} />
                {broken.length} bước đang trỏ vào neo hoặc hành động không còn tồn tại
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Những bước này sẽ bị bỏ qua ở phía người dùng. Thường là do giao diện vừa
                được sửa lại — chọn neo khác cho chúng.
              </p>
            </AdminCard>
          ) : null}

          <AdminCard padded={false}>
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="font-display text-base font-bold text-ink">
                Các bước ({tour.steps.length})
              </h2>
              <AdminButton variant="secondary" onClick={addStep}>
                <Plus size={14} />
                Thêm bước
              </AdminButton>
            </div>

            <ul className="flex flex-col">
              {tour.steps.map((step, index) => (
                <StepEditor
                  key={step.id}
                  step={step}
                  index={index}
                  total={tour.steps.length}
                  scope={scope}
                  problem={brokenById.get(step.id)}
                  dropOff={stats?.dropOff.find((item) => item.stepId === step.id)?.count ?? 0}
                  onPatch={(patch) => patchStep(index, patch)}
                  onMove={(delta) => move(index, delta)}
                  onRemove={() =>
                    setTour({
                      ...tour,
                      steps: tour.steps.filter((_, position) => position !== index),
                    })
                  }
                />
              ))}
            </ul>

            {tour.steps.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted">
                Chưa có bước nào. Bấm &ldquo;Thêm bước&rdquo; để bắt đầu.
              </p>
            ) : null}
          </AdminCard>
        </div>

        <div className="flex flex-col gap-4">
          <StatsCard stats={stats} tour={tour} />

          <AdminCard>
            <h2 className="font-display text-base font-bold text-ink">Ghi chú xuất bản</h2>
            <p className="mt-1 text-xs text-muted">
              Ghi lại vì sao lần này sửa, để sau còn biết nên quay về bản nào.
            </p>
            <div className="mt-2.5">
              <AdminInput
                value={note}
                onChange={setNote}
                placeholder="Ví dụ: viết lại bước lồng tiếng cho dễ hiểu"
                ariaLabel="Ghi chú xuất bản"
              />
            </div>
          </AdminCard>

          <AdminCard padded={false}>
            <h2 className="border-b border-line px-5 py-3.5 font-display text-base font-bold text-ink">
              Lịch sử xuất bản
            </h2>
            {history.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">
                Đang dùng bản mặc định trong mã nguồn.
              </p>
            ) : (
              <ul className="flex flex-col">
                {history.map((version) => (
                  <li
                    key={version.id}
                    className="border-b border-line px-5 py-3 last:border-b-0"
                  >
                    <p className="text-xs font-semibold text-ink">
                      {new Date(version.publishedAt).toLocaleString("vi-VN")}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">{version.publishedBy}</p>
                    {version.note ? (
                      <p className="mt-1 text-[11px] leading-snug text-muted">
                        {version.note}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        </div>
      </div>
    </div>
  );
}

/**
 * Thống kê rơi rớt.
 *
 * Con số đáng nhìn nhất không phải tỉ lệ hoàn thành mà là **bước nào nhiều người dừng lại**
 * — đó là bước viết chưa rõ hoặc chỉ sai chỗ.
 */
function StatsCard({ stats, tour }: { stats: TourStats | null; tour: Tour }) {
  if (!stats || stats.started === 0) {
    return (
      <AdminCard>
        <h2 className="font-display text-base font-bold text-ink">Hiệu quả</h2>
        <p className="mt-1.5 text-sm text-muted">
          Chưa có ai xem tour này. Số liệu xuất hiện sau khi người dùng thật bắt đầu.
        </p>
      </AdminCard>
    );
  }

  const worst = Math.max(1, ...stats.dropOff.map((item) => item.count));
  const titleOf = (stepId: string) =>
    tour.steps.find((step) => step.id === stepId)?.title ?? stepId;

  return (
    <AdminCard>
      <h2 className="font-display text-base font-bold text-ink">Hiệu quả</h2>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Bắt đầu", value: stats.started, tone: "text-ink" },
          { label: "Hoàn thành", value: stats.completed, tone: "text-mint" },
          { label: "Bỏ qua", value: stats.skipped, tone: "text-amber" },
        ].map((item) => (
          <div key={item.label} className="rounded-btn bg-subtle px-2 py-2.5">
            <p className={`font-display text-lg font-bold ${item.tone}`}>{item.value}</p>
            <p className="text-[11px] text-muted">{item.label}</p>
          </div>
        ))}
      </div>

      {stats.dropOff.length > 0 ? (
        <>
          <p className="mt-4 text-xs font-semibold text-muted">Dừng lại ở bước</p>
          <ul className="mt-2 flex flex-col gap-2">
            {stats.dropOff.slice(0, 6).map((item) => (
              <li key={item.stepId}>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="min-w-0 truncate text-ink">{titleOf(item.stepId)}</span>
                  <span className="shrink-0 font-mono tabular-nums text-muted">
                    {item.count}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-subtle">
                  <div
                    className="h-full rounded-full bg-amber"
                    style={{ width: `${(item.count / worst) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </AdminCard>
  );
}

function StepEditor({
  step,
  index,
  total,
  scope,
  problem,
  dropOff,
  onPatch,
  onMove,
  onRemove,
}: {
  step: TourStep;
  index: number;
  total: number;
  scope: TourScope | undefined;
  problem: string | undefined;
  dropOff: number;
  onPatch: (patch: Partial<TourStep>) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const action = scope?.actions.find((item) => item.id === step.prepare?.action);

  return (
    <li className="border-b border-line px-5 py-4 last:border-b-0">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-btn bg-subtle font-mono text-[11px] font-bold text-muted">
          {index + 1}
        </span>

        <span className="font-mono text-[11px] text-muted">{step.id}</span>

        {problem ? (
          <Pill accent="amber">
            <TriangleAlert size={11} />
            {problem}
          </Pill>
        ) : null}

        {dropOff > 0 ? (
          <span className="text-[11px] text-muted">{dropOff} người dừng ở đây</span>
        ) : null}

        <span className="ml-auto flex items-center gap-1">
          <AdminButton
            variant="ghost"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            title="Lên trên"
            ariaLabel="Đưa bước lên trên"
          >
            <ArrowUp size={14} />
          </AdminButton>
          <AdminButton
            variant="ghost"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            title="Xuống dưới"
            ariaLabel="Đưa bước xuống dưới"
          >
            <ArrowDown size={14} />
          </AdminButton>
          <AdminButton
            variant="ghost"
            onClick={onRemove}
            title="Xoá bước"
            ariaLabel="Xoá bước"
          >
            <Trash2 size={14} />
          </AdminButton>
        </span>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">Tiêu đề</span>
          <AdminInput
            value={step.title}
            onChange={(title) => onPatch({ title })}
            ariaLabel={`Tiêu đề bước ${index + 1}`}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">Chỉ vào</span>
          <AdminSelect
            value={step.anchor}
            onChange={(anchor) => onPatch({ anchor })}
            ariaLabel={`Neo của bước ${index + 1}`}
            options={(scope?.anchors ?? []).map((anchor) => ({
              id: anchor.id,
              label: anchor.label,
            }))}
          />
        </label>
      </div>

      <label className="mt-3 flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted">Nội dung</span>
        <textarea
          rows={2}
          value={step.body}
          maxLength={400}
          onChange={(event) => onPatch({ body: event.target.value })}
          aria-label={`Nội dung bước ${index + 1}`}
          className="w-full resize-none rounded-btn border border-line bg-subtle px-3.5 py-2.5 text-sm leading-relaxed text-ink outline-none focus:border-brand/50"
        />
      </label>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">Vị trí hộp</span>
          <AdminSelect
            value={step.placement}
            onChange={(placement) => onPatch({ placement })}
            ariaLabel={`Vị trí hộp bước ${index + 1}`}
            options={TourPlacements.map((value) => ({
              id: value,
              label: {
                auto: "Tự chọn",
                top: "Phía trên",
                bottom: "Phía dưới",
                left: "Bên trái",
                right: "Bên phải",
              }[value],
            }))}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">Chuẩn bị trước</span>
          <AdminSelect
            value={step.prepare?.action ?? ""}
            onChange={(value) =>
              onPatch({
                prepare: value
                  ? {
                      action: value,
                      value: scope?.actions.find((item) => item.id === value)?.values?.[0]?.id,
                    }
                  : null,
              })
            }
            ariaLabel={`Hành động chuẩn bị bước ${index + 1}`}
            options={[
              { id: "", label: "Không cần" },
              ...(scope?.actions ?? []).map((item) => ({ id: item.id, label: item.label })),
            ]}
          />
        </label>

        {action?.values ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted">Giá trị</span>
            <AdminSelect
              value={step.prepare?.value ?? ""}
              onChange={(value) =>
                onPatch({ prepare: { action: action.id, value } })
              }
              ariaLabel={`Giá trị chuẩn bị bước ${index + 1}`}
              options={action.values.map((item) => ({ id: item.id, label: item.label }))}
            />
          </label>
        ) : null}
      </div>
    </li>
  );
}

export const TOUR_ICON = Compass;
