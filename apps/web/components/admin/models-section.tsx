"use client";

import {
  BadgeCheck,
  KeyRound,
  Pencil,
  Plus,
  Settings2,
  ShieldAlert,
  Timer,
  Trash2,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  COST_UNIT_OPTIONS,
  VERIFIABLE_PROVIDERS,
  type AiModel,
  type ModelBadge,
  type ModelConfig,
  type ModelCost,
  type ModelKind,
} from "@/config/admin/models.config";
import {
  AdminButton,
  AdminCard,
  AdminInput,
  AdminRowMenu,
  AdminSelect,
  ToggleSwitch,
} from "@/components/admin/primitives";
import { AdminModal } from "@/components/admin/admin-modal";
import { ModelConfigForm } from "@/components/admin/models/model-config-forms";
import {
  fetchCredentials,
  type CredentialStatusView,
} from "@/lib/admin/credentials-api";
import { CredentialUploadModal } from "@/components/admin/credentials/credential-upload-modal";
import {
  createAiModel,
  deleteAiModel,
  fetchAiModels,
  fetchModelUsage,
  setAiModelEnabled,
  updateAiModel,
  verifyAiModel,
  type ModelUsage,
} from "@/lib/admin/ai-models-api";
import { useToast } from "@/components/ui/toast";

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
  latency: "",
  capability: "",
  badge: "Experimental" as ModelBadge,
  /** "" = không gắn nhà cung cấp nào, model chỉ là khai báo thủ công. */
  credentialProvider: "",
  costAmount: "0",
  costUnit: "contract" as ModelCost["unit"],
  freeTierAmount: "",
};

type ModelDraft = typeof emptyModelDraft;

const INFO_FIELDS: { key: "name" | "vendor" | "capability" | "latency"; label: string }[] = [
  { key: "name", label: "Tên model" },
  { key: "vendor", label: "Nhà cung cấp" },
  { key: "capability", label: "Hỗ trợ (ngôn ngữ / độ phân giải)" },
  { key: "latency", label: "Độ trễ ước tính" },
];

const number = (value: number) => value.toLocaleString("vi-VN");

/**
 * Mức tiêu thụ ký tự trong tháng. Hệ thống tự đếm vì Google không có API trả về
 * hạn mức miễn phí còn lại.
 */
function UsageLine({ usage }: { usage: ModelUsage }) {
  const limit = usage.monthlyCharLimit;
  const percent = limit > 0 ? Math.min(100, (usage.monthChars / limit) * 100) : 0;
  const tone = percent >= 90 ? "bg-danger" : percent >= 70 ? "bg-amber" : "bg-mint";

  return (
    <div className="mt-3 rounded-btn border border-line bg-subtle px-2.5 py-2">
      <p className="flex flex-wrap items-baseline justify-between gap-x-2 font-mono text-[11px] text-muted">
        <span>
          Tháng này{" "}
          <span className="font-bold text-ink">{number(usage.monthChars)}</span>
          {limit > 0 ? ` / ${number(limit)}` : ""} ký tự
        </span>
        <span>
          {usage.estimatedCostUsd > 0
            ? `~$${usage.estimatedCostUsd}`
            : usage.freeTierRemaining !== null
              ? `còn ${number(usage.freeTierRemaining)} miễn phí`
              : "chưa tính phí"}
        </span>
      </p>

      {limit > 0 ? (
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-line">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${tone}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}

      <p className="mt-1 font-mono text-[11px] text-muted">
        Hôm nay {number(usage.todayChars)}
        {usage.dailyCharLimit > 0 ? ` / ${number(usage.dailyCharLimit)}` : ""} ký tự ·{" "}
        {number(usage.monthRequests)} lượt gọi
      </p>
    </div>
  );
}

/** Ba ô chi phí trên form -> đúng hình dạng backend nhận. */
const toCost = (draft: ModelDraft): ModelCost => ({
  amount: Number(draft.costAmount) || 0,
  unit: draft.costUnit,
  freeTierAmount:
    draft.freeTierAmount.trim() === "" ? null : Number(draft.freeTierAmount) || 0,
});

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

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs font-semibold text-muted">Đơn vị tính chi phí</span>
          <AdminSelect
            ariaLabel="Đơn vị tính chi phí"
            value={draft.costUnit}
            onChange={(value) =>
              onChange({ ...draft, costUnit: value as ModelCost["unit"] })
            }
            options={COST_UNIT_OPTIONS}
            className="w-full"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">Đơn giá (USD)</span>
          <AdminInput
            ariaLabel="Đơn giá"
            value={draft.costAmount}
            onChange={(value) => onChange({ ...draft, costAmount: value })}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted">
          Hạn mức miễn phí mỗi tháng
        </span>
        <AdminInput
          ariaLabel="Hạn mức miễn phí mỗi tháng"
          value={draft.freeTierAmount}
          onChange={(value) => onChange({ ...draft, freeTierAmount: value })}
        />
        <span className="text-[11px] text-muted">
          Tính bằng đơn vị cơ sở: ký tự, giây hoặc token. Ví dụ Google TTS Chirp 3 HD điền
          1000000. Để trống nếu không có.
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted">
          Nhà cung cấp credential (để xác minh được)
        </span>
        <AdminSelect
          ariaLabel="Nhà cung cấp credential"
          value={draft.credentialProvider}
          onChange={(value) => onChange({ ...draft, credentialProvider: value })}
          options={[
            { id: "", label: "Không gắn — chỉ khai báo thủ công" },
            ...VERIFIABLE_PROVIDERS.map((item) => ({ id: item.id, label: item.label })),
          ]}
          className="w-full"
        />
      </label>

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
  kind,
  addLabel = "Thêm model",
}: {
  kind: ModelKind;
  addLabel?: string;
}) {
  const toast = useToast();
  const [models, setModels] = useState<AiModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [modelDraft, setModelDraft] = useState(emptyModelDraft);
  const [editing, setEditing] = useState<AiModel | null>(null);
  const [editDraft, setEditDraft] = useState(emptyModelDraft);
  const [configuring, setConfiguring] = useState<AiModel | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AiModel | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [usage, setUsage] = useState<Record<string, ModelUsage>>({});
  const [configDraft, setConfigDraft] = useState<ModelConfig | null>(null);
  /** Trạng thái khoá của các nhà cung cấp, để thẻ model biết bước tiếp theo là gì. */
  const [credentials, setCredentials] = useState<CredentialStatusView[]>([]);
  const [keyModal, setKeyModal] = useState<CredentialStatusView | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, keys] = await Promise.all([
        fetchAiModels(kind),
        // Lỗi đọc khoá không được làm hỏng danh mục model: thẻ vẫn hiện, chỉ là không biết
        // trạng thái khoá.
        fetchCredentials().catch(() => [] as CredentialStatusView[]),
      ]);
      setModels(list);
      setCredentials(keys);
      setApiError(null);

      // Chỉ model giọng đọc mới đếm ký tự; lỗi ở đây không được làm hỏng cả trang.
      if (kind === "voice") {
        const entries = await Promise.all(
          list.map(async (model) => {
            try {
              return [model.id, await fetchModelUsage(model.id)] as const;
            } catch {
              return null;
            }
          }),
        );

        setUsage(
          Object.fromEntries(entries.filter((entry) => entry !== null)) as Record<
            string,
            ModelUsage
          >,
        );
      }
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Không gọi được API");
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  /** Model dùng được và model chưa mở, tách hẳn hai nhóm. */
  const ready = models.filter((model) => model.comingSoon !== true);
  const locked = models.filter((model) => model.comingSoon === true);

  const credentialOf = (model: AiModel): CredentialStatusView | undefined =>
    credentials.find((item) => item.provider === model.credentialProvider);

  const replace = (saved: AiModel) =>
    setModels((current) => current.map((item) => (item.id === saved.id ? saved : item)));

  const toggleModel = async (model: AiModel) => {
    try {
      const saved = await setAiModelEnabled(model.id, !model.enabled);
      replace(saved);
      toast(
        `${saved.name} đã ${saved.enabled ? "bật" : "tắt"} trên toàn hệ thống`,
        saved.enabled ? "success" : "warning",
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : "Không đổi được trạng thái", "danger");
    }
  };

  const removeModel = async (model: AiModel) => {
    setSaving(true);
    try {
      await deleteAiModel(model.id);
      setModels((current) => current.filter((item) => item.id !== model.id));
      toast(`Đã gỡ ${model.name} khỏi danh mục`, "warning");
      setRemoveTarget(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Không gỡ được model", "danger");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (model: AiModel) => {
    setEditing(model);
    setEditDraft({
      name: model.name,
      vendor: model.vendor,
      latency: model.latency,
      capability: model.capability,
      badge: model.badge,
      credentialProvider: model.credentialProvider ?? "",
      costAmount: String(model.cost.amount),
      costUnit: model.cost.unit,
      freeTierAmount:
        model.cost.freeTierAmount === null ? "" : String(model.cost.freeTierAmount),
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (editDraft.name.trim() === "" || editDraft.vendor.trim() === "") {
      toast("Tên model và nhà cung cấp không được để trống", "warning");
      return;
    }

    setSaving(true);
    try {
      const saved = await updateAiModel(editing.id, {
        name: editDraft.name.trim(),
        vendor: editDraft.vendor.trim(),
        latency: editDraft.latency.trim() || editing.latency,
        capability: editDraft.capability.trim() || editing.capability,
        badge: editDraft.badge,
        credentialProvider: editDraft.credentialProvider || null,
        cost: toCost(editDraft),
      });

      replace(saved);
      toast(`Đã cập nhật ${saved.name}`);
      setEditing(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Không lưu được thay đổi", "danger");
    } finally {
      setSaving(false);
    }
  };

  const openConfigure = (model: AiModel) => {
    setConfiguring(model);
    setConfigDraft(model.config);
  };

  const saveConfigure = async () => {
    if (!configuring || !configDraft) return;

    setSaving(true);
    try {
      const saved = await updateAiModel(configuring.id, { config: configDraft ?? undefined });

      replace(saved);
      toast(`Đã lưu tham số cho ${saved.name}`);
      setConfiguring(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Không lưu được tham số", "danger");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Gọi thật sang nhà cung cấp bằng credential đang lưu.
   * Thay cho nút "Benchmark" cũ vốn chỉ sinh số ngẫu nhiên phía client.
   */
  const verifyModel = async (model: AiModel) => {
    setVerifying(model.id);

    try {
      const saved = await verifyAiModel(model.id);
      replace(saved);
      toast(`${saved.name}: ${saved.verificationNote}`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Xác minh thất bại", "danger");
      void load();
    } finally {
      setVerifying(null);
    }
  };

  const addModel = async () => {
    if (modelDraft.name.trim() === "" || modelDraft.vendor.trim() === "") {
      toast("Cần nhập tên model và nhà cung cấp", "warning");
      return;
    }

    setSaving(true);
    try {
      const created = await createAiModel({
        kind,
        name: modelDraft.name.trim(),
        vendor: modelDraft.vendor.trim(),
        badge: modelDraft.badge,
        latency: modelDraft.latency.trim(),
        capability: modelDraft.capability.trim(),
        credentialProvider: modelDraft.credentialProvider || null,
        cost: toCost(modelDraft),
      });

      setModels((current) => [created, ...current]);
      setModelDraft(emptyModelDraft);
      setAddOpen(false);
      toast(`Đã thêm ${created.name} — đang tắt, xác minh với nhà cung cấp rồi mới bật`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Không thêm được model", "danger");
    } finally {
      setSaving(false);
    }
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

      {apiError ? (
        <AdminCard className="border-danger/40 bg-danger/5">
          <p className="text-sm text-ink">
            <strong className="font-bold">Không đọc được danh mục model.</strong> {apiError}
          </p>
        </AdminCard>
      ) : loading ? (
        <AdminCard>
          <p className="py-6 text-center text-sm text-muted">Đang tải danh mục model...</p>
        </AdminCard>
      ) : models.length === 0 ? (
        <AdminCard>
          <p className="py-6 text-center text-sm text-muted">Chưa có model nào.</p>
        </AdminCard>
      ) : null}

      {ready.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {ready.map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              usage={usage[model.id]}
              credential={credentialOf(model)}
              verifying={verifying === model.id}
              onVerify={() => void verifyModel(model)}
              onToggle={() => void toggleModel(model)}
              onAddKey={() => setKeyModal(credentialOf(model) ?? null)}
              onEdit={() => openEdit(model)}
              onConfigure={() => openConfigure(model)}
              onRemove={() => setRemoveTarget(model)}
            />
          ))}
        </div>
      ) : null}

      {/* Model chưa mở không đứng ngang hàng với model dùng được: gom xuống cuối, thu gọn,
          để danh sách phía trên chỉ còn những thứ quản trị viên thao tác được. */}
      {locked.length > 0 ? (
        <details className="rounded-card border border-line bg-surface p-4">
          <summary className="cursor-pointer text-sm font-semibold text-muted">
            Sắp ra mắt ({locked.length})
          </summary>

          <ul className="mt-3 flex flex-col gap-2">
            {locked.map((model) => (
              <li
                key={model.id}
                className="flex flex-wrap items-center gap-2 border-t border-line pt-2 text-sm first:border-0 first:pt-0"
              >
                <span className="font-semibold text-ink">{model.name}</span>
                <span className="text-xs text-muted">{model.vendor}</span>
                <span className="ml-auto font-mono text-xs text-muted">{model.costLabel}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {keyModal ? (
        <CredentialUploadModal
          view={keyModal}
          open
          onClose={() => setKeyModal(null)}
          onSaved={(next) => {
            setCredentials((current) =>
              current.map((item) => (item.provider === next.provider ? next : item)),
            );
            toast(`Đã lưu khoá ${next.label} — giờ bấm Xác minh trên thẻ model`);
          }}
        />
      ) : null}

      <AdminModal
        open={configuring !== null}
        onClose={() => setConfiguring(null)}
        title={`Cấu hình ${configuring?.name ?? ""}`}
        description="Tham số riêng của loại model này, áp dụng cho mọi request đi qua nó."
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setConfiguring(null)}>
              Huỷ
            </AdminButton>
            <AdminButton variant="primary" onClick={() => void saveConfigure()} disabled={saving}>
              Lưu thay đổi
            </AdminButton>
          </>
        }
      >
        {configuring && configDraft ? (
          <ModelConfigForm
            kind={configuring.kind}
            config={configDraft}
            onChange={setConfigDraft}
          />
        ) : null}
      </AdminModal>

      <AdminModal
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        title={`Gỡ ${removeTarget?.name ?? ""} khỏi danh mục?`}
        description="Model sẽ biến mất khỏi mọi lựa chọn trong hệ thống. Thao tác được ghi vào nhật ký kiểm toán."
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setRemoveTarget(null)}>
              Huỷ
            </AdminButton>
            <AdminButton
              variant="danger"
              disabled={saving}
              onClick={() => {
                if (removeTarget) void removeModel(removeTarget);
              }}
            >
              {saving ? "Đang gỡ..." : "Gỡ model"}
            </AdminButton>
          </>
        }
      >
        <p className="text-sm text-muted">
          Định danh: <span className="font-mono text-ink">{removeTarget?.id}</span>
          {removeTarget?.kind === "voice" ? (
            <>
              <br />
              Model giọng đọc đang có giọng tham chiếu sẽ{" "}
              <span className="font-bold text-ink">không</span> gỡ được — hệ thống báo lỗi
              và giữ nguyên.
            </>
          ) : null}
        </p>
      </AdminModal>

      <AdminModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={addLabel}
        description="Model mới mặc định tắt. Gắn nhà cung cấp và xác minh xong mới bật được."
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setAddOpen(false)}>
              Huỷ
            </AdminButton>
            <AdminButton variant="primary" onClick={() => void addModel()} disabled={saving}>
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
            <AdminButton variant="primary" onClick={() => void saveEdit()} disabled={saving}>
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

/**
 * Thẻ một model, với **đúng một hành động chính** tuỳ trạng thái.
 *
 * Backend bắt buộc thứ tự: có khoá nhà cung cấp → xác minh → mới bật được. Trước đây giao
 * diện bày cả năm nút ngang hàng nên quản trị viên hay bấm Bật trước rồi bị từ chối mà
 * không hiểu vì sao. Nay mỗi lúc chỉ có một nút sáng, đúng bước tiếp theo.
 *
 * Sửa · Cấu hình · Gỡ là việc hiếm nên nằm trong menu `⋯`.
 */
function ModelCard({
  model,
  usage,
  credential,
  verifying,
  onVerify,
  onToggle,
  onAddKey,
  onEdit,
  onConfigure,
  onRemove,
}: {
  model: AiModel;
  usage: ModelUsage | undefined;
  credential: CredentialStatusView | undefined;
  verifying: boolean;
  onVerify: () => void;
  onToggle: () => void;
  onAddKey: () => void;
  onEdit: () => void;
  onConfigure: () => void;
  onRemove: () => void;
}) {
  const verified = model.verifiedAt !== null;
  const needsKey = model.credentialProvider !== null && credential?.configured !== true;

  return (
    <AdminCard className="flex flex-col">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn border border-line bg-subtle font-display text-sm font-bold text-ink">
          {model.vendor.charAt(0)}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-bold text-ink">{model.name}</p>
          {/* `badge` là nhãn do người nhập tự gõ, không phải định tuyến thật — để chữ
              thường, không tô màu như một trạng thái hệ thống. */}
          <p className="truncate text-xs text-muted">
            {model.vendor} · {model.badge}
          </p>
        </div>

        <AdminRowMenu
          label={`Thao tác khác với ${model.name}`}
          items={[
            { label: "Sửa thông tin", icon: <Pencil size={16} />, onClick: onEdit },
            { label: "Cấu hình tham số", icon: <Settings2 size={16} />, onClick: onConfigure },
            {
              label: "Gỡ khỏi danh mục",
              icon: <Trash2 size={16} />,
              danger: true,
              onClick: onRemove,
            },
          ]}
        />
      </div>

      {/* Dòng trạng thái: model này có đang đi vào sản phẩm hay không. Danh mục liệt kê
          được bao nhiêu model cũng được, nhưng chỉ cái có giọng dùng tới mới chạy thật. */}
      <p className="mt-3 text-xs font-semibold text-muted">
        {model.usedByVoices > 0 ? (
          <span className="text-mint">Đang dùng cho {model.usedByVoices} giọng</span>
        ) : model.enabled ? (
          "Đang bật · chưa có giọng nào dùng"
        ) : (
          "Chưa nối vào sản phẩm"
        )}
      </p>

      <dl className="mt-3 flex flex-col gap-2 border-t border-line pt-3 text-xs">
        <div className="flex items-center gap-2">
          <Timer size={14} className="shrink-0 text-muted" />
          <dt className="text-muted">Độ trễ</dt>
          <dd className="ml-auto font-mono font-bold text-ink">{model.latency}</dd>
        </div>
        <div className="flex items-center gap-2">
          <Wallet size={14} className="shrink-0 text-muted" />
          <dt className="text-muted">Chi phí</dt>
          <dd className="ml-auto font-mono font-bold text-ink">{model.costLabel}</dd>
        </div>
      </dl>

      {usage ? <UsageLine usage={usage} /> : null}

      <ModelStatusLine model={model} credential={credential} needsKey={needsKey} />

      <div className="mt-4 flex items-center gap-2">
        {needsKey ? (
          <AdminButton variant="primary" onClick={onAddKey} className="flex-1">
            <KeyRound size={14} />
            Dán khoá
          </AdminButton>
        ) : !verified && model.credentialProvider ? (
          <AdminButton
            variant="primary"
            onClick={onVerify}
            disabled={verifying}
            className="flex-1"
          >
            <BadgeCheck size={14} />
            {verifying ? "Đang gọi..." : "Xác minh"}
          </AdminButton>
        ) : (
          <div className="flex flex-1 items-center gap-2.5">
            <ToggleSwitch
              checked={model.enabled}
              onChange={onToggle}
              label={`Bật tắt ${model.name}`}
            />
            <span className="text-xs text-muted">
              {model.enabled ? "Đang bật" : "Đang tắt"}
            </span>
          </div>
        )}
      </div>
    </AdminCard>
  );
}

/** Một dòng nói rõ đang thiếu gì — thay cho hai badge rời rạc trước đây. */
function ModelStatusLine({
  model,
  credential,
  needsKey,
}: {
  model: AiModel;
  credential: CredentialStatusView | undefined;
  needsKey: boolean;
}) {
  if (!model.credentialProvider) {
    return (
      <p className="mt-3 rounded-btn bg-subtle px-2.5 py-1.5 text-[11px] text-muted">
        Khai báo thủ công · chưa gắn nhà cung cấp nào
      </p>
    );
  }

  if (needsKey) {
    return (
      <p className="mt-3 flex items-start gap-1.5 rounded-btn bg-amber/10 px-2.5 py-1.5 text-[11px] text-amber">
        <ShieldAlert size={13} className="mt-px shrink-0" />
        <span>Chưa có khoá {credential?.label ?? model.credentialProvider}</span>
      </p>
    );
  }

  if (model.verifiedAt === null) {
    return (
      <p className="mt-3 flex items-start gap-1.5 rounded-btn bg-amber/10 px-2.5 py-1.5 text-[11px] text-amber">
        <ShieldAlert size={13} className="mt-px shrink-0" />
        <span>Đã có khoá, chưa xác minh với nhà cung cấp</span>
      </p>
    );
  }

  return (
    <p className="mt-3 flex items-start gap-1.5 rounded-btn bg-mint/10 px-2.5 py-1.5 text-[11px] text-mint">
      <BadgeCheck size={13} className="mt-px shrink-0" />
      <span className="font-mono">
        {model.verificationNote}
        {model.lastLatencyMs ? ` · ${model.lastLatencyMs}ms` : ""}
      </span>
    </p>
  );
}
