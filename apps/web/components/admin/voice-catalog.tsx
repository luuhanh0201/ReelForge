"use client";

import {
  BadgeCheck,
  CloudDownload,
  Gauge,
  Loader2,
  Pause,
  RefreshCw,
  Pencil,
  Play,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MAX_SAMPLE_CHARS,
  SPEED_STEPS,
  VOICE_GENDER_LABEL,
  nearestSpeedStep,
  type AiModel,
  type VoiceEntry,
  type VoiceGender,
} from "@/config/admin/models.config";
import { fetchAiModels } from "@/lib/admin/ai-models-api";
import {
  createVoice,
  deleteVoice,
  fetchProviderCatalog,
  fetchVoices,
  importVoices,
  setVoiceEnabled,
  previewVoice,
  updateVoice,
  verifyVoice,
  type ProviderVoice,
} from "@/lib/admin/voices-api";
import {
  AdminButton,
  AdminCard,
  AdminInput,
  AdminSelect,
  Pill,
  TablePagination,
  ToggleSwitch,
} from "@/components/admin/primitives";
import { usePagination } from "@/lib/admin/pagination";
import { AdminModal } from "@/components/admin/admin-modal";
import { useToast } from "@/components/admin/toast";

type GenderFilter = VoiceGender | "all";

const DEFAULT_SAMPLE_TEXT =
  "Xin chào, đây là giọng đọc thử của ReelForge. Sản phẩm đang giảm giá năm mươi phần trăm.";

const emptyDraft = {
  personaName: "",
  originName: "",
  providerVoiceId: "",
  modelId: "",
  gender: "female" as VoiceGender,
  region: "Miền Bắc",
  speed: "1.0",
  sampleText: DEFAULT_SAMPLE_TEXT,
};

type VoiceDraft = typeof emptyDraft;

const formatSpeed = (speed: number) => `${speed.toFixed(2).replace(/0$/, "")}x`;

/** Form thông tin giọng, dùng chung cho modal Thêm mới và modal Sửa. */
function VoiceForm({
  draft,
  models,
  catalog,
  lockVoiceId,
  onChange,
}: {
  draft: VoiceDraft;
  models: AiModel[];
  /** Danh mục giọng thật của nhà cung cấp — nguồn duy nhất cho ô chọn ID giọng. */
  catalog: ProviderVoice[];
  /** Khi sửa: giữ nguyên ID hiện tại trong danh sách dù nó đã được nhập. */
  lockVoiceId?: string;
  onChange: (next: VoiceDraft) => void;
}) {
  const options = catalog
    .filter((item) => !item.imported || item.providerVoiceId === lockVoiceId)
    .map((item) => ({
      id: item.providerVoiceId,
      label: `${item.providerVoiceId} · ${item.gender === "male" ? "Nam" : "Nữ"} · $${item.tierCostUsd}/1M`,
    }));
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
        <span className="text-xs font-semibold text-muted">
          Giọng của nhà cung cấp ({options.length} lựa chọn)
        </span>
        {options.length === 0 ? (
          <p className="rounded-btn border border-line bg-subtle px-3 py-2 text-xs text-muted">
            Không còn giọng nào chưa nhập, hoặc chưa đọc được danh mục từ nhà cung cấp.
          </p>
        ) : (
          <AdminSelect
            ariaLabel="Giọng của nhà cung cấp"
            value={draft.providerVoiceId}
            onChange={(value) => onChange({ ...draft, providerVoiceId: value })}
            options={options}
            className="w-full"
          />
        )}
        <span className="text-[11px] text-muted">
          Danh sách lấy trực tiếp từ nhà cung cấp nên không thể gõ sai ID.
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted">Model</span>
        <AdminSelect
          ariaLabel="Model"
          value={draft.modelId}
          onChange={(value) => onChange({ ...draft, modelId: value })}
          options={models.map((item) => ({ id: item.id, label: item.name }))}
          className="w-full"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="flex items-center justify-between text-xs font-semibold text-muted">
          <span>Câu thoại nghe thử</span>
          <span
            className={`font-mono ${
              draft.sampleText.length > MAX_SAMPLE_CHARS ? "text-danger" : "text-muted"
            }`}
          >
            {draft.sampleText.length}/{MAX_SAMPLE_CHARS}
          </span>
        </span>
        <textarea
          aria-label="Câu thoại nghe thử"
          rows={2}
          value={draft.sampleText}
          onChange={(event) => onChange({ ...draft, sampleText: event.target.value })}
          className="w-full resize-none rounded-btn border border-line bg-subtle px-3.5 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-brand/50"
        />
        <span className="text-[11px] text-muted">
          Mỗi lần bấm nghe thử là một lần gọi Google có tính phí theo số ký tự.
        </span>
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
 * Thanh kéo tốc độ ngay trên thẻ, các mức lấy đúng bộ của YouTube.
 *
 * Đổi tốc độ **không tốn ký tự**: audio lưu ở 1.0x, tốc độ áp bằng `playbackRate` của
 * trình duyệt. Nhờ vậy kéo qua lại thoải mái mà không gọi lại nhà cung cấp.
 */
function SpeedSlider({
  voice,
  onChange,
}: {
  voice: VoiceEntry;
  onChange: (speed: number) => void;
}) {
  const current = nearestSpeedStep(voice.speed);
  const index = SPEED_STEPS.indexOf(current as (typeof SPEED_STEPS)[number]);

  return (
    <div className="mt-3 flex items-center gap-2.5">
      <Gauge size={14} className="shrink-0 text-muted" />

      <input
        type="range"
        min={0}
        max={SPEED_STEPS.length - 1}
        step={1}
        value={index < 0 ? SPEED_STEPS.indexOf(1) : index}
        aria-label={`Tốc độ đọc của ${voice.personaName}`}
        aria-valuetext={`${current}x`}
        onChange={(event) => onChange(SPEED_STEPS[Number(event.target.value)] ?? 1)}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-[#ff6b35]"
      />

      <span
        className={`w-12 shrink-0 text-right font-mono text-xs font-bold ${
          current === 1 ? "text-muted" : "text-amber"
        }`}
      >
        {formatSpeed(current)}
      </span>
    </div>
  );
}

/**
 * Danh mục giọng đọc dạng Bento Grid 3 cột.
 * Mỗi thẻ chia 3 tầng: định danh + nghe thử · đặc tính kỹ thuật · số liệu + trạng thái.
 */
export function VoiceCatalog() {
  const toast = useToast();
  const [voices, setVoices] = useState<VoiceEntry[]>([]);
  const [models, setModels] = useState<AiModel[]>([]);
  const [catalog, setCatalog] = useState<ProviderVoice[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [model, setModel] = useState("all");
  const [gender, setGender] = useState<GenderFilter>("all");
  const [playing, setPlaying] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** Gộp nhiều bước kéo thành một lần ghi database. */
  const speedTimers = useRef(new Map<string, number>());

  // Rời trang giữa chừng thì phải tắt tiếng, nếu không audio vẫn chạy tiếp.
  useEffect(() => {
    const timers = speedTimers.current;

    return () => {
      audioRef.current?.pause();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [editing, setEditing] = useState<VoiceEntry | null>(null);
  const [editDraft, setEditDraft] = useState(emptyDraft);
  const [removeTarget, setRemoveTarget] = useState<VoiceEntry | null>(null);

  const load = useCallback(async () => {
    try {
      const [voiceList, modelList] = await Promise.all([
        fetchVoices(),
        fetchAiModels("voice"),
      ]);
      setVoices(voiceList);
      setModels(modelList);
      setApiError(null);

      // Danh mục nhà cung cấp cần credential nên có thể hỏng riêng — không để nó
      // làm chết cả trang.
      try {
        const provider = await fetchProviderCatalog();
        setCatalog(provider.items);
        setCatalogError(null);
      } catch (error) {
        setCatalog([]);
        setCatalogError(
          error instanceof Error ? error.message : "Không đọc được danh mục nhà cung cấp",
        );
      }
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Không gọi được API");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

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

  // Lưới 3 cột nên các mức đều là bội số của 3.
  const pagination = usePagination(filtered, 6);

  const enabledCount = voices.filter((voice) => voice.enabled).length;
  const modelName = useMemo(
    () => new Map(models.map((model) => [model.id, model.name])),
    [models],
  );

  /**
   * Gọi Google tổng hợp thật câu thoại mẫu rồi phát.
   * Trước đây chỗ này chỉ là bộ đếm thời gian, không có âm thanh nào.
   */
  /**
   * Phát audio nghe thử. Bản lưu luôn ở tốc độ 1.0x, tốc độ của giọng được áp bằng
   * `playbackRate` ngay trên trình duyệt — nhờ vậy đổi tốc độ không tốn thêm ký tự nào.
   */
  const togglePreview = async (voice: VoiceEntry, force = false) => {
    audioRef.current?.pause();

    if (playing === voice.id && !force) {
      setPlaying(null);
      return;
    }

    setLoadingPreview(voice.id);

    try {
      const result = await previewVoice(voice.id, force);
      const audio = new Audio(`data:${result.mimeType};base64,${result.audioBase64}`);
      audioRef.current = audio;

      // preservesPitch giữ nguyên cao độ khi kéo giãn thời gian; mặc định đã bật ở
      // Chrome/Firefox/Safari nhưng đặt tường minh cho chắc.
      audio.preservesPitch = true;
      audio.playbackRate = voice.speed;

      audio.onended = () => setPlaying(null);
      audio.onerror = () => {
        setPlaying(null);
        toast("Trình duyệt không phát được file âm thanh", "danger");
      };

      setPlaying(voice.id);
      await audio.play();

      toast(
        result.cached
          ? `${voice.personaName}: phát từ bộ nhớ đệm · ${voice.speed}x · không tốn ký tự`
          : `${voice.personaName}: đã tổng hợp ${result.charCount} ký tự · ${result.latencyMs}ms`,
        result.cached ? "success" : "warning",
      );
    } catch (error) {
      setPlaying(null);
      toast(error instanceof Error ? error.message : "Không nghe thử được", "danger");
    } finally {
      setLoadingPreview(null);
    }
  };

  const toDraft = (voice: VoiceEntry): VoiceDraft => ({
    personaName: voice.personaName,
    originName: voice.originName,
    providerVoiceId: voice.providerVoiceId,
    modelId: voice.modelId,
    gender: voice.gender,
    region: voice.region,
    speed: String(voice.speed),
    sampleText: voice.sampleText,
  });

  const validate = (value: VoiceDraft) => {
    if (value.personaName.trim() === "" || value.providerVoiceId.trim() === "") {
      toast("Cần nhập tên persona và chọn giọng của nhà cung cấp", "warning");
      return false;
    }
    if (value.sampleText.trim() === "") {
      toast("Cần có câu thoại để nghe thử giọng", "warning");
      return false;
    }
    if (value.sampleText.length > MAX_SAMPLE_CHARS) {
      toast(`Câu thoại nghe thử tối đa ${MAX_SAMPLE_CHARS} ký tự`, "warning");
      return false;
    }
    return true;
  };

  const addVoice = async () => {
    if (!validate(draft)) return;

    setSaving(true);
    try {
      // Chi phí và khả năng timepoints là thuộc tính của dòng giọng bên nhà cung cấp,
      // không phải thứ người vận hành tự khai.
      const source = catalog.find(
        (item) => item.providerVoiceId === draft.providerVoiceId.trim(),
      );

      const created = await createVoice({
        personaName: draft.personaName.trim(),
        originName: draft.originName.trim() || draft.personaName.trim(),
        providerVoiceId: draft.providerVoiceId.trim(),
        modelId: draft.modelId,
        gender: source?.gender ?? draft.gender,
        region: draft.region.trim(),
        speed: Number(draft.speed) || 1,
        supportsTimepoints: source?.supportsTimepoints,
        costPerMillionUsd: source?.tierCostUsd,
        sampleText: draft.sampleText.trim(),
      });

      setVoices((current) => [created, ...current]);
      setDraft(emptyDraft);
      setAddOpen(false);
      toast(`Đã thêm giọng ${created.personaName} — đang tắt, bật khi kiểm tra xong`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Không thêm được giọng", "danger");
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editing || !validate(editDraft)) return;

    setSaving(true);
    try {
      const saved = await updateVoice(editing.id, {
        personaName: editDraft.personaName.trim(),
        originName: editDraft.originName.trim() || editing.originName,
        providerVoiceId: editDraft.providerVoiceId.trim(),
        modelId: editDraft.modelId,
        gender: editDraft.gender,
        region: editDraft.region.trim() || editing.region,
        speed: Number(editDraft.speed) || editing.speed,
        sampleText: editDraft.sampleText.trim(),
      });

      setVoices((current) =>
        current.map((item) => (item.id === saved.id ? saved : item)),
      );
      toast(`Đã cập nhật giọng ${saved.personaName}`);
      setEditing(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Không lưu được thay đổi", "danger");
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (voice: VoiceEntry, next: boolean) => {
    try {
      const saved = await setVoiceEnabled(voice.id, next);
      setVoices((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      toast(
        `${next ? "Đã bật" : "Đã tắt"} giọng ${saved.personaName}`,
        next ? "success" : "warning",
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : "Không đổi được trạng thái", "danger");
    }
  };

  const runImport = async () => {
    const modelId = models[0]?.id;
    if (!modelId) {
      toast("Cần có ít nhất một model voice trước khi nhập giọng", "warning");
      return;
    }

    setSaving(true);
    try {
      const result = await importVoices(picked, modelId);
      toast(
        `Đã nhập ${result.imported} giọng${result.skipped > 0 ? `, bỏ qua ${result.skipped}` : ""}`,
      );
      setImportOpen(false);
      setPicked([]);
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Nhập giọng thất bại", "danger");
    } finally {
      setSaving(false);
    }
  };

  /** Hỏi thẳng nhà cung cấp xem ID giọng này có thật không. */
  const verify = async (voice: VoiceEntry) => {
    setVerifying(voice.id);

    try {
      const saved = await verifyVoice(voice.id);
      setVoices((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      toast(`${saved.personaName}: ${saved.verificationNote}`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Xác minh thất bại", "danger");
      void load();
    } finally {
      setVerifying(null);
    }
  };

  /**
   * Đổi tốc độ: cập nhật giao diện ngay, áp luôn vào audio đang phát, và chỉ ghi xuống
   * database sau khi người dùng dừng kéo (gộp nhiều bước kéo thành một lần lưu).
   */
  const changeSpeed = (voice: VoiceEntry, speed: number) => {
    setVoices((current) =>
      current.map((item) => (item.id === voice.id ? { ...item, speed } : item)),
    );

    if (playing === voice.id && audioRef.current) {
      audioRef.current.playbackRate = speed;
    }

    const pending = speedTimers.current.get(voice.id);
    if (pending) window.clearTimeout(pending);

    speedTimers.current.set(
      voice.id,
      window.setTimeout(() => {
        void updateVoice(voice.id, { speed })
          .then((saved) =>
            setVoices((current) =>
              current.map((item) => (item.id === saved.id ? saved : item)),
            ),
          )
          .catch((error: unknown) => {
            toast(
              error instanceof Error ? error.message : "Không lưu được tốc độ",
              "danger",
            );
            void load();
          });
      }, 500),
    );
  };

  const removeVoice = async (voice: VoiceEntry) => {
    setSaving(true);
    try {
      await deleteVoice(voice.id);
      setVoices((current) => current.filter((item) => item.id !== voice.id));
      toast(`Đã gỡ giọng ${voice.personaName}`, "warning");
      setRemoveTarget(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Không gỡ được giọng", "danger");
    } finally {
      setSaving(false);
    }
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
            ...models.map((item) => ({ id: item.id, label: item.name })),
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

        <AdminButton onClick={() => setImportOpen(true)} disabled={catalog.length === 0}>
          <CloudDownload size={14} />
          Nhập từ nhà cung cấp
        </AdminButton>

        <AdminButton
          variant="primary"
          onClick={() => {
            setDraft({
              ...emptyDraft,
              modelId: models[0]?.id ?? "",
              providerVoiceId:
                catalog.find((item) => !item.imported)?.providerVoiceId ?? "",
            });
            setAddOpen(true);
          }}
        >
          <Plus size={14} />
          Thêm giọng
        </AdminButton>
      </div>

      {catalogError && !apiError ? (
        <p className="mt-4 flex items-start gap-2.5 rounded-card border border-amber/40 bg-amber/5 px-4 py-3 text-sm text-ink">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-amber" />
          <span>
            <strong className="font-bold">Chưa đọc được danh mục giọng của nhà cung cấp.</strong>{" "}
            {catalogError} — kiểm tra credential ở trang API Keys.
          </span>
        </p>
      ) : null}

      {apiError ? (
        <p className="mt-5 flex items-start gap-2.5 rounded-card border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-ink">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-danger" />
          <span>
            <strong className="font-bold">Không đọc được danh mục giọng.</strong> {apiError}
          </span>
        </p>
      ) : loading ? (
        <p className="mt-6 py-10 text-center text-sm text-muted">Đang tải danh mục giọng...</p>
      ) : filtered.length === 0 ? (
        <p className="mt-6 py-10 text-center text-sm text-muted">
          {voices.length === 0
            ? "Danh mục chưa có giọng nào."
            : "Không có giọng nào khớp bộ lọc."}
        </p>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pagination.items.map((voice) => (
            <article
              key={voice.id}
              className="flex flex-col rounded-card border border-line bg-canvas p-4"
            >
              {/* Tầng 1 — định danh và nghe thử */}
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3
                      className="truncate text-[15px] font-bold text-ink"
                      title={`${voice.personaName} · ${voice.providerVoiceId}`}
                    >
                      {voice.personaName}
                    </h3>

                    {/*
                      Trạng thái xác minh gói gọn trong một icon; mô tả nằm ở tooltip.
                      Icon lucide render ra <svg> nên không nhận `title` — phải bọc span.
                    */}
                    <span
                      className="shrink-0"
                      title={
                        voice.verificationNote ??
                        (voice.verifiedAt
                          ? "Đã xác minh với nhà cung cấp"
                          : "Chưa xác minh với nhà cung cấp — bấm nút dấu tích để kiểm tra")
                      }
                    >
                      {voice.verifiedAt ? (
                        <BadgeCheck
                          size={15}
                          className="text-mint"
                          aria-label="Đã xác minh với nhà cung cấp"
                        />
                      ) : (
                        <ShieldAlert
                          size={15}
                          className="text-amber"
                          aria-label="Chưa xác minh với nhà cung cấp"
                        />
                      )}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted">
                    {modelName.get(voice.modelId) ?? voice.modelId}
                  </p>
                </div>

                <AdminButton
                  variant="ghost"
                  className="h-9 w-9 shrink-0 px-0"
                  title="Sửa thông tin giọng"
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
                  title="Gỡ giọng khỏi danh mục"
                  onClick={() => setRemoveTarget(voice)}
                >
                  <Trash2 size={18} />
                </AdminButton>

                <AdminButton
                  variant="ghost"
                  className="h-9 w-9 shrink-0 px-0"
                  disabled={verifying === voice.id}
                  title="Xác minh giọng với nhà cung cấp"
                  onClick={() => void verify(voice)}
                >
                  <BadgeCheck size={18} />
                </AdminButton>

                <AdminButton
                  variant="ghost"
                  className="h-9 w-9 shrink-0 px-0"
                  disabled={loadingPreview === voice.id}
                  title="Tạo lại bản nghe thử (gọi lại nhà cung cấp, tốn ký tự)"
                  onClick={() => void togglePreview(voice, true)}
                >
                  <RefreshCw size={17} />
                </AdminButton>

                <button
                  type="button"
                  onClick={() => void togglePreview(voice)}
                  disabled={loadingPreview === voice.id}
                  aria-label={`Nghe thử giọng ${voice.personaName}`}
                  title={playing === voice.id ? "Dừng phát" : "Nghe thử"}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-50 ${
                    playing === voice.id
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-line text-muted hover:border-brand/50 hover:text-brand"
                  }`}
                >
                  {loadingPreview === voice.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : playing === voice.id ? (
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
              </p>

              <SpeedSlider
                voice={voice}
                onChange={(speed) => changeSpeed(voice, speed)}
              />

              <p
                className="mt-3 line-clamp-2 text-xs italic leading-relaxed text-muted"
                title={voice.sampleText}
              >
                &ldquo;{voice.sampleText}&rdquo;
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
                    onChange={(next) => void toggleEnabled(voice, next)}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {!apiError && !loading && filtered.length > 0 ? (
        <div className="-mx-5 -mb-5 mt-5 border-t border-line">
          <TablePagination
            pagination={pagination}
            unit="giọng"
            sizes={[6, 12, 24, 48]}
          />
        </div>
      ) : null}

      <AdminModal
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          setPicked([]);
        }}
        title="Nhập giọng từ nhà cung cấp"
        description="Danh sách lấy trực tiếp từ Google bằng credential đang lưu. Giọng nhập vào được đánh dấu đã xác minh và luôn ở trạng thái tắt."
        width="max-w-2xl"
        footer={
          <>
            <AdminButton
              variant="ghost"
              onClick={() => {
                setImportOpen(false);
                setPicked([]);
              }}
            >
              Huỷ
            </AdminButton>
            <AdminButton
              variant="primary"
              disabled={picked.length === 0 || saving}
              onClick={() => void runImport()}
            >
              {saving ? "Đang nhập..." : `Nhập ${picked.length} giọng`}
            </AdminButton>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <AdminButton
              onClick={() =>
                setPicked(
                  catalog.filter((item) => !item.imported).map((i) => i.providerVoiceId),
                )
              }
            >
              Chọn tất cả chưa nhập
            </AdminButton>
            <AdminButton variant="ghost" onClick={() => setPicked([])}>
              Bỏ chọn
            </AdminButton>
            <p className="ml-auto font-mono text-[11px] text-muted">
              {catalog.filter((item) => !item.imported).length} giọng chưa nhập /{" "}
              {catalog.length} giọng nhà cung cấp có
            </p>
          </div>

          <div className="max-h-[46vh] overflow-y-auto rounded-card border border-line">
            {catalog.map((item) => {
              const checked = picked.includes(item.providerVoiceId);

              return (
                <label
                  key={item.providerVoiceId}
                  className={`flex items-center gap-3 border-b border-line/70 px-3 py-2 last:border-0 ${
                    item.imported ? "opacity-45" : "cursor-pointer hover:bg-subtle/60"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#ff6b35]"
                    disabled={item.imported}
                    checked={checked}
                    onChange={(event) =>
                      setPicked((current) =>
                        event.target.checked
                          ? [...current, item.providerVoiceId]
                          : current.filter((id) => id !== item.providerVoiceId),
                      )
                    }
                  />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-xs text-ink">
                      {item.providerVoiceId}
                    </span>
                    <span className="block text-[11px] text-muted">
                      {item.gender === "male" ? "Nam" : "Nữ"} · ${item.tierCostUsd}/1M ký tự ·{" "}
                      {item.supportsTimepoints ? "có timepoints" : "không timepoints"}
                    </span>
                  </span>

                  {item.imported ? <Pill accent="mint">Đã nhập</Pill> : null}
                </label>
              );
            })}
          </div>
        </div>
      </AdminModal>

      <AdminModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Thêm giọng đọc mới"
        description="Giọng mới mặc định tắt. Phải xác minh với nhà cung cấp rồi mới bật được."
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setAddOpen(false)}>
              Huỷ
            </AdminButton>
            <AdminButton variant="primary" onClick={() => void addVoice()} disabled={saving}>
              {saving ? "Đang lưu..." : "Thêm giọng"}
            </AdminButton>
          </>
        }
      >
        <VoiceForm draft={draft} models={models} catalog={catalog} onChange={setDraft} />
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
            <AdminButton variant="primary" onClick={() => void saveEdit()} disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </AdminButton>
          </>
        }
      >
        <VoiceForm
          draft={editDraft}
          models={models}
          catalog={catalog}
          lockVoiceId={editing?.providerVoiceId}
          onChange={setEditDraft}
        />
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
              disabled={saving}
              onClick={() => {
                if (removeTarget) void removeVoice(removeTarget);
              }}
            >
              {saving ? "Đang gỡ..." : "Gỡ giọng"}
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
