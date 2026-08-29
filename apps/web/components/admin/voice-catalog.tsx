"use client";

import { Pause, Pencil, Play, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  VOICE_CATALOG,
  VOICE_GENDER_LABEL,
  VOICE_MODELS,
  type VoiceEntry,
  type VoiceGender,
} from "@/config/admin/models.config";
import {
  AdminButton,
  AdminCard,
  AdminInput,
  AdminSelect,
  ToggleSwitch,
} from "@/components/admin/primitives";
import { AdminModal } from "@/components/admin/admin-modal";
import { useToast } from "@/components/admin/toast";

type GenderFilter = VoiceGender | "all";

const MODEL_NAME = new Map(VOICE_MODELS.map((model) => [model.id, model.name]));

const emptyDraft = {
  personaName: "",
  originName: "",
  providerVoiceId: "",
  modelId: VOICE_MODELS[0]?.id ?? "",
  gender: "female" as VoiceGender,
  region: "Miền Bắc",
  speed: "1.0",
};

type VoiceDraft = typeof emptyDraft;

const formatSpeed = (speed: number) => `${speed.toFixed(2).replace(/0$/, "")}x`;

/** Form thông tin giọng, dùng chung cho modal Thêm mới và modal Sửa. */
function VoiceForm({
  draft,
  onChange,
}: {
  draft: VoiceDraft;
  onChange: (next: VoiceDraft) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">Tên persona</span>
          <AdminInput
            ariaLabel="Tên persona"
            value={draft.personaName}
            onChange={(value) => onChange({ ...draft, personaName: value })}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">Tên gốc nhà cung cấp</span>
          <AdminInput
            ariaLabel="Tên gốc"
            value={draft.originName}
            onChange={(value) => onChange({ ...draft, originName: value })}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted">ID giọng của nhà cung cấp</span>
        <AdminInput
          ariaLabel="ID giọng của nhà cung cấp"
          value={draft.providerVoiceId}
          onChange={(value) => onChange({ ...draft, providerVoiceId: value })}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted">Model</span>
        <AdminSelect
          ariaLabel="Model"
          value={draft.modelId}
          onChange={(value) => onChange({ ...draft, modelId: value })}
          options={VOICE_MODELS.map((item) => ({ id: item.id, label: item.name }))}
          className="w-full"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">Giới tính</span>
          <AdminSelect
            ariaLabel="Giới tính"
            value={draft.gender}
            onChange={(value) => onChange({ ...draft, gender: value })}
            options={[
              { id: "female" as VoiceGender, label: "Nữ" },
              { id: "male" as VoiceGender, label: "Nam" },
            ]}
            className="w-full"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">Vùng miền</span>
          <AdminInput
            ariaLabel="Vùng miền"
            value={draft.region}
            onChange={(value) => onChange({ ...draft, region: value })}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">Tốc độ mặc định</span>
          <AdminInput
            ariaLabel="Tốc độ mặc định"
            value={draft.speed}
            onChange={(value) => onChange({ ...draft, speed: value })}
          />
        </label>
      </div>
    </div>
  );
}

/**
 * Danh mục giọng đọc dạng Bento Grid 3 cột.
 * Mỗi thẻ chia 3 tầng: định danh + nghe thử · đặc tính kỹ thuật · số liệu + trạng thái.
 */
export function VoiceCatalog() {
  const toast = useToast();
  const [voices, setVoices] = useState<VoiceEntry[]>(VOICE_CATALOG);
  const [query, setQuery] = useState("");
  const [model, setModel] = useState("all");
  const [gender, setGender] = useState<GenderFilter>("all");
  const [playing, setPlaying] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [editing, setEditing] = useState<VoiceEntry | null>(null);
  const [editDraft, setEditDraft] = useState(emptyDraft);
  const [removeTarget, setRemoveTarget] = useState<VoiceEntry | null>(null);

  const filtered = useMemo(
    () =>
      voices.filter((voice) => {
        const keyword = query.trim().toLowerCase();
        const matchQuery =
          keyword === "" ||
          voice.personaName.toLowerCase().includes(keyword) ||
          voice.originName.toLowerCase().includes(keyword) ||
          voice.providerVoiceId.toLowerCase().includes(keyword) ||
          voice.region.toLowerCase().includes(keyword);

        return (
          matchQuery &&
          (model === "all" || voice.modelId === model) &&
          (gender === "all" || voice.gender === gender)
        );
      }),
    [voices, query, model, gender],
  );

  const enabledCount = voices.filter((voice) => voice.enabled).length;

  const togglePreview = (voice: VoiceEntry) => {
    if (playing === voice.id) {
      setPlaying(null);
      return;
    }

    setPlaying(voice.id);
    window.setTimeout(() => setPlaying(null), voice.durationSec * 100);
  };

  const toDraft = (voice: VoiceEntry): VoiceDraft => ({
    personaName: voice.personaName,
    originName: voice.originName,
    providerVoiceId: voice.providerVoiceId,
    modelId: voice.modelId,
    gender: voice.gender,
    region: voice.region,
    speed: String(voice.speed),
  });

  const validate = (value: VoiceDraft) => {
    if (value.personaName.trim() === "" || value.providerVoiceId.trim() === "") {
      toast("Cần nhập tên persona và ID giọng của nhà cung cấp", "warning");
      return false;
    }
    return true;
  };

  const addVoice = () => {
    if (!validate(draft)) return;

    const created: VoiceEntry = {
      id: `v-${Date.now()}`,
      personaName: draft.personaName.trim(),
      originName: draft.originName.trim() || draft.personaName.trim(),
      providerVoiceId: draft.providerVoiceId.trim(),
      modelId: draft.modelId,
      gender: draft.gender,
      region: draft.region.trim() || "Chưa phân loại",
      speed: Number(draft.speed) || 1,
      usageCount: 0,
      supportsTimepoints: draft.modelId === "google-wavenet",
      costPerMillionUsd: 0,
      durationSec: 14,
      enabled: false,
    };

    setVoices((current) => [created, ...current]);
    setDraft(emptyDraft);
    setAddOpen(false);
    toast(`Đã thêm giọng ${created.personaName} — đang tắt, bật khi kiểm tra xong`);
  };

  const saveEdit = () => {
    if (!editing || !validate(editDraft)) return;

    setVoices((current) =>
      current.map((item) =>
        item.id === editing.id
          ? {
              ...item,
              personaName: editDraft.personaName.trim(),
              originName: editDraft.originName.trim() || item.originName,
              providerVoiceId: editDraft.providerVoiceId.trim(),
              modelId: editDraft.modelId,
              gender: editDraft.gender,
              region: editDraft.region.trim() || item.region,
              speed: Number(editDraft.speed) || item.speed,
              // Đổi model thì khả năng lấy timestamp cũng đổi theo.
              supportsTimepoints:
                editDraft.modelId === "google-wavenet" ||
                editDraft.modelId === "elevenlabs-turbo",
            }
          : item,
      ),
    );
    toast(`Đã cập nhật giọng ${editDraft.personaName.trim()}`);
    setEditing(null);
  };

  return (
    <AdminCard>
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h2 className="font-display text-base font-bold text-ink">Danh mục giọng đọc</h2>
          <p className="mt-0.5 text-xs text-muted">
            {enabledCount}/{voices.length} giọng đang bật cho người dùng
          </p>
        </div>

        <AdminInput
          ariaLabel="Tìm giọng đọc"
          value={query}
          onChange={setQuery}
          placeholder="Tìm persona, tên gốc, vùng miền..."
          icon={<Search size={15} className="shrink-0 text-muted" />}
          className="w-full sm:w-60"
        />

        <AdminSelect
          ariaLabel="Lọc theo model"
          value={model}
          onChange={setModel}
          options={[
            { id: "all", label: "Mọi model" },
            ...VOICE_MODELS.map((item) => ({ id: item.id, label: item.name })),
          ]}
        />

        <AdminSelect
          ariaLabel="Lọc theo giới tính"
          value={gender}
          onChange={setGender}
          options={[
            { id: "all", label: "Nam & Nữ" },
            { id: "female", label: "Nữ" },
            { id: "male", label: "Nam" },
          ]}
        />

        <AdminButton variant="primary" onClick={() => setAddOpen(true)}>
          <Plus size={14} />
          Thêm giọng
        </AdminButton>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 py-10 text-center text-sm text-muted">
          Không có giọng nào khớp bộ lọc.
        </p>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((voice) => (
            <article
              key={voice.id}
              className="flex flex-col rounded-card border border-line bg-canvas p-4"
            >
              {/* Tầng 1 — định danh và nghe thử */}
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[15px] font-bold text-ink">
                    {voice.personaName}{" "}
                    <span className="font-medium text-muted">({voice.originName})</span>
                  </h3>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted">
                    {MODEL_NAME.get(voice.modelId) ?? voice.modelId}
                  </p>
                </div>

                <AdminButton
                  variant="ghost"
                  className="h-9 w-9 shrink-0 px-0"
                  onClick={() => {
                    setEditing(voice);
                    setEditDraft(toDraft(voice));
                  }}
                >
                  <Pencil size={18} />
                </AdminButton>

                <AdminButton
                  variant="ghost"
                  className="h-9 w-9 shrink-0 px-0"
                  onClick={() => setRemoveTarget(voice)}
                >
                  <Trash2 size={18} />
                </AdminButton>

                <button
                  type="button"
                  onClick={() => togglePreview(voice)}
                  aria-label={`Nghe thử giọng ${voice.personaName}`}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    playing === voice.id
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-line text-muted hover:border-brand/50 hover:text-brand"
                  }`}
                >
                  {playing === voice.id ? (
                    <Pause size={16} fill="currentColor" />
                  ) : (
                    <Play size={16} fill="currentColor" />
                  )}
                </button>
              </div>

              {/* Tầng 2 — đặc tính kỹ thuật và tốc độ */}
              <p className="mt-4 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                <span>{voice.region}</span>
                <span aria-hidden className="text-line">
                  •
                </span>
                <span>{VOICE_GENDER_LABEL[voice.gender]}</span>
                <span aria-hidden className="text-line">
                  •
                </span>
                <span className="font-mono font-bold text-amber">
                  {formatSpeed(voice.speed)}
                </span>
              </p>

              {/* Tầng 3 — số liệu và trạng thái */}
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
                <p className="font-mono text-[11px] text-muted">
                  Đã tạo: {voice.usageCount.toLocaleString("vi-VN")} lượt
                </p>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      voice.enabled
                        ? "bg-mint/12 text-mint"
                        : "bg-subtle text-muted"
                    }`}
                  >
                    {voice.enabled ? "Đang bật" : "Đang tắt"}
                  </span>

                  <ToggleSwitch
                    checked={voice.enabled}
                    label={`Bật tắt giọng ${voice.personaName}`}
                    onChange={(next) => {
                      setVoices((current) =>
                        current.map((item) =>
                          item.id === voice.id ? { ...item, enabled: next } : item,
                        ),
                      );
                      toast(
                        `${next ? "Đã bật" : "Đã tắt"} giọng ${voice.personaName}`,
                        next ? "success" : "warning",
                      );
                    }}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <AdminModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Thêm giọng đọc mới"
        description="Giọng mới mặc định tắt — bật sau khi nghe thử và kiểm tra chi phí."
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setAddOpen(false)}>
              Huỷ
            </AdminButton>
            <AdminButton variant="primary" onClick={addVoice}>
              Thêm giọng
            </AdminButton>
          </>
        }
      >
        <VoiceForm draft={draft} onChange={setDraft} />
      </AdminModal>

      <AdminModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Sửa giọng ${editing?.personaName ?? ""}`}
        description="Đổi model sẽ tự cập nhật lại khả năng lấy timestamp cho karaoke."
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
        <VoiceForm draft={editDraft} onChange={setEditDraft} />
      </AdminModal>

      <AdminModal
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        title={`Gỡ giọng ${removeTarget?.personaName ?? ""}?`}
        description="Giọng sẽ biến mất khỏi Studio. Dự án đã dùng giọng này vẫn giữ audio đã render."
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setRemoveTarget(null)}>
              Huỷ
            </AdminButton>
            <AdminButton
              variant="danger"
              onClick={() => {
                if (!removeTarget) return;
                setVoices((current) => current.filter((item) => item.id !== removeTarget.id));
                toast(`Đã gỡ giọng ${removeTarget.personaName}`, "warning");
                setRemoveTarget(null);
              }}
            >
              Gỡ giọng
            </AdminButton>
          </>
        }
      >
        <p className="text-sm text-muted">
          Hành động này được ghi vào nhật ký kiểm toán ở mức{" "}
          <span className="font-bold text-amber">WARNING</span>.
        </p>
      </AdminModal>
    </AdminCard>
  );
}
