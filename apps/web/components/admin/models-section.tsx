"use client";

import { Gauge, Pencil, Plus, Settings2, Timer, Wallet } from "lucide-react";
import { useState } from "react";
import type { AiModel, ModelBadge, ModelKind } from "@/config/admin/models.config";
import {
  AdminButton,
  AdminCard,
  AdminInput,
  AdminSelect,
  Pill,
  ToggleSwitch,
} from "@/components/admin/primitives";
import { AdminModal } from "@/components/admin/admin-modal";
import { useToast } from "@/components/admin/toast";

const BADGE_ACCENT = {
  "Default Primary": "brand",
  "Fallback Tier-1": "mint",
  "Fallback Tier-2": "info",
  "Enterprise Only": "voice",
  Experimental: "amber",
} as const;

interface BenchmarkResult {
  latencyMs: number;
  at: string;
}

/**
 * Lưới thẻ model dùng chung cho cả 3 trang Video / Voice / Script.
 * Toàn bộ state là mock phía client — chưa nối backend.
 */
const BADGE_OPTIONS: { id: ModelBadge; label: string }[] = [
  { id: "Default Primary", label: "Default Primary" },
  { id: "Fallback Tier-1", label: "Fallback Tier-1" },
  { id: "Fallback Tier-2", label: "Fallback Tier-2" },
  { id: "Enterprise Only", label: "Enterprise Only" },
  { id: "Experimental", label: "Experimental" },
];

const emptyModelDraft = {
  name: "",
  vendor: "",
  endpoint: "",
  cost: "",
  latency: "",
  capability: "",
  badge: "Experimental" as ModelBadge,
};

type ModelDraft = typeof emptyModelDraft;

const INFO_FIELDS: { key: keyof Omit<ModelDraft, "badge">; label: string }[] = [
  { key: "name", label: "Tên model" },
  { key: "vendor", label: "Nhà cung cấp" },
  { key: "endpoint", label: "Endpoint URL" },
  { key: "capability", label: "Hỗ trợ (ngôn ngữ / độ phân giải)" },
  { key: "latency", label: "Độ trễ ước tính" },
  { key: "cost", label: "Chi phí" },
];

/** Form thông tin model, dùng chung cho modal Thêm mới và modal Sửa. */
function ModelInfoForm({
  draft,
  onChange,
}: {
  draft: ModelDraft;
  onChange: (next: ModelDraft) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {INFO_FIELDS.map((field) => (
        <label key={field.key} className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">{field.label}</span>
          <AdminInput
            ariaLabel={field.label}
            value={draft[field.key]}
            onChange={(value) => onChange({ ...draft, [field.key]: value })}
          />
        </label>
      ))}

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted">Vai trò trong routing</span>
        <AdminSelect
          ariaLabel="Vai trò trong routing"
          value={draft.badge}
          onChange={(value) => onChange({ ...draft, badge: value })}
          options={BADGE_OPTIONS}
          className="w-full"
        />
      </label>
    </div>
  );
}

export function ModelsSection({
  initialModels,
  kind,
  addLabel = "Thêm model",
}: {
  initialModels: AiModel[];
  kind: ModelKind;
  addLabel?: string;
}) {
  const toast = useToast();
  const [models, setModels] = useState(initialModels);
  const [addOpen, setAddOpen] = useState(false);
  const [modelDraft, setModelDraft] = useState(emptyModelDraft);
  const [editing, setEditing] = useState<AiModel | null>(null);
  const [editDraft, setEditDraft] = useState(emptyModelDraft);
  const [configuring, setConfiguring] = useState<AiModel | null>(null);
  const [benchmarks, setBenchmarks] = useState<Record<string, BenchmarkResult>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [draft, setDraft] = useState({ endpoint: "", apiVersion: "", maxTokens: "", temperature: "" });

  const toggleModel = (model: AiModel) => {
    setModels((current) =>
      current.map((item) =>
        item.id === model.id ? { ...item, enabled: !item.enabled } : item,
      ),
    );
    toast(
      `${model.name} đã ${model.enabled ? "tắt" : "bật"} trên toàn hệ thống`,
      model.enabled ? "warning" : "success",
    );
  };

  const openEdit = (model: AiModel) => {
    setEditing(model);
    setEditDraft({
      name: model.name,
      vendor: model.vendor,
      endpoint: model.config.endpoint,
      cost: model.cost,
      latency: model.latency,
      capability: model.capability,
      badge: model.badge,
    });
  };

  const saveEdit = () => {
    if (!editing) return;
    if (editDraft.name.trim() === "" || editDraft.vendor.trim() === "") {
      toast("Tên model và nhà cung cấp không được để trống", "warning");
      return;
    }

    setModels((current) =>
      current.map((item) =>
        item.id === editing.id
          ? {
              ...item,
              name: editDraft.name.trim(),
              vendor: editDraft.vendor.trim(),
              cost: editDraft.cost.trim() || item.cost,
              latency: editDraft.latency.trim() || item.latency,
              capability: editDraft.capability.trim() || item.capability,
              badge: editDraft.badge,
              config: { ...item.config, endpoint: editDraft.endpoint.trim() },
            }
          : item,
      ),
    );
    toast(`Đã cập nhật ${editDraft.name.trim()}`);
    setEditing(null);
  };

  const openConfigure = (model: AiModel) => {
    setConfiguring(model);
    setDraft({
      endpoint: model.config.endpoint,
      apiVersion: model.config.apiVersion,
      maxTokens: String(model.config.maxTokens),
      temperature: String(model.config.temperature),
    });
  };

  const saveConfigure = () => {
    if (!configuring) return;

    setModels((current) =>
      current.map((item) =>
        item.id === configuring.id
          ? {
              ...item,
              config: {
                endpoint: draft.endpoint,
                apiVersion: draft.apiVersion,
                maxTokens: Number(draft.maxTokens) || 0,
                temperature: Number(draft.temperature) || 0,
              },
            }
          : item,
      ),
    );
    toast(`Đã lưu tham số cho ${configuring.name}`);
    setConfiguring(null);
  };

  const runBenchmark = (model: AiModel) => {
    setRunning(model.id);

    window.setTimeout(() => {
      const latencyMs = 380 + Math.round(Math.random() * 1600);
      setBenchmarks((current) => ({
        ...current,
        [model.id]: {
          latencyMs,
          at: new Date().toLocaleTimeString("vi-VN", { hour12: false }),
        },
      }));
      setRunning(null);
      toast(`${model.name}: phản hồi ${latencyMs}ms`, latencyMs > 1200 ? "warning" : "success");
    }, 900);
  };

  const addModel = () => {
    if (modelDraft.name.trim() === "" || modelDraft.vendor.trim() === "") {
      toast("Cần nhập tên model và nhà cung cấp", "warning");
      return;
    }

    const created: AiModel = {
      id: `${kind}-${Date.now()}`,
      kind,
      name: modelDraft.name.trim(),
      vendor: modelDraft.vendor.trim(),
      enabled: false,
      badge: modelDraft.badge,
      latency: modelDraft.latency.trim() || "chưa đo",
      capability: modelDraft.capability.trim() || "chưa khai báo",
      cost: modelDraft.cost.trim() || "chưa có giá",
      config: {
        endpoint: modelDraft.endpoint.trim(),
        apiVersion: "v1",
        maxTokens: 4096,
        temperature: 0.7,
      },
    };

    setModels((current) => [created, ...current]);
    setModelDraft(emptyModelDraft);
    setAddOpen(false);
    toast(`Đã thêm ${created.name} — đang tắt, chạy Benchmark trước khi bật`);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          <span className="font-bold text-ink">
            {models.filter((model) => model.enabled).length}/{models.length}
          </span>{" "}
          model đang bật
        </p>

        <AdminButton variant="primary" onClick={() => setAddOpen(true)}>
          <Plus size={14} />
          {addLabel}
        </AdminButton>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {models.map((model) => {
          const benchmark = benchmarks[model.id];
          const locked = model.comingSoon === true;

          return (
            <AdminCard
              key={model.id}
              className={`flex flex-col ${locked ? "opacity-60" : ""}`}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn border border-line bg-subtle font-display text-sm font-bold text-ink">
                  {model.vendor.charAt(0)}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-bold text-ink">
                    {model.name}
                  </p>
                  <p className="truncate text-xs text-muted">{model.vendor}</p>
                </div>

                <AdminButton
                  variant="ghost"
                  className="h-9 w-9 shrink-0 px-0"
                  disabled={locked}
                  onClick={() => openEdit(model)}
                >
                  <Pencil size={18} />
                </AdminButton>

                <ToggleSwitch
                  checked={model.enabled}
                  disabled={locked}
                  onChange={() => toggleModel(model)}
                  label={`Bật tắt ${model.name}`}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <Pill accent={BADGE_ACCENT[model.badge]}>{model.badge}</Pill>
                {locked ? <Pill accent="info">Sắp ra mắt</Pill> : null}
              </div>

              <dl className="mt-4 flex flex-col gap-2 border-t border-line pt-4 text-xs">
                <div className="flex items-center gap-2">
                  <Timer size={14} className="shrink-0 text-muted" />
                  <dt className="text-muted">Độ trễ</dt>
                  <dd className="ml-auto font-mono font-bold text-ink">{model.latency}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <Gauge size={14} className="shrink-0 text-muted" />
                  <dt className="text-muted">Hỗ trợ</dt>
                  <dd className="ml-auto font-medium text-ink">{model.capability}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <Wallet size={14} className="shrink-0 text-muted" />
                  <dt className="text-muted">Chi phí</dt>
                  <dd className="ml-auto font-mono font-bold text-ink">{model.cost}</dd>
                </div>
              </dl>

              {benchmark ? (
                <p className="mt-3 rounded-btn bg-subtle px-2.5 py-1.5 font-mono text-[11px] text-muted">
                  Benchmark {benchmark.at}:{" "}
                  <span className={benchmark.latencyMs > 1200 ? "text-amber" : "text-mint"}>
                    {benchmark.latencyMs}ms
                  </span>
                </p>
              ) : null}

              <div className="mt-4 flex gap-2">
                <AdminButton
                  onClick={() => openConfigure(model)}
                  disabled={locked}
                  className="flex-1"
                >
                  <Settings2 size={14} />
                  Cấu hình
                </AdminButton>
                <AdminButton
                  variant="primary"
                  onClick={() => runBenchmark(model)}
                  disabled={locked || running === model.id}
                  className="flex-1"
                >
                  {running === model.id ? "Đang đo..." : "Benchmark"}
                </AdminButton>
              </div>
            </AdminCard>
          );
        })}
      </div>

      <AdminModal
        open={configuring !== null}
        onClose={() => setConfiguring(null)}
        title={`Cấu hình ${configuring?.name ?? ""}`}
        description="Tham số áp dụng cho mọi request đi qua model này."
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setConfiguring(null)}>
              Huỷ
            </AdminButton>
            <AdminButton variant="primary" onClick={saveConfigure}>
              Lưu thay đổi
            </AdminButton>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {[
            { key: "endpoint" as const, label: "Endpoint URL" },
            { key: "apiVersion" as const, label: "API Version" },
            { key: "maxTokens" as const, label: "Max Tokens" },
            { key: "temperature" as const, label: "Temperature" },
          ].map((field) => (
            <label key={field.key} className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted">{field.label}</span>
              <AdminInput
                ariaLabel={field.label}
                value={draft[field.key]}
                onChange={(value) => setDraft((current) => ({ ...current, [field.key]: value }))}
              />
            </label>
          ))}
        </div>
      </AdminModal>

      <AdminModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={addLabel}
        description="Model mới mặc định tắt. Chạy Benchmark rồi mới bật trên toàn hệ thống."
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setAddOpen(false)}>
              Huỷ
            </AdminButton>
            <AdminButton variant="primary" onClick={addModel}>
              Thêm model
            </AdminButton>
          </>
        }
      >
        <ModelInfoForm draft={modelDraft} onChange={setModelDraft} />
      </AdminModal>

      <AdminModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Sửa thông tin ${editing?.name ?? ""}`}
        description="Đổi tên, nhà cung cấp, chi phí và vai trò trong chuỗi định tuyến."
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setEditing(null)}>
              Huỷ
            </AdminButton>
            <AdminButton variant="primary" onClick={saveEdit}>
              Lưu thay đổi
            </AdminButton>
          </>
        }
      >
        <ModelInfoForm draft={editDraft} onChange={setEditDraft} />
      </AdminModal>
    </>
  );
}
