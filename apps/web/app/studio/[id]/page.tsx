"use client";

import { Loader2, MonitorSmartphone } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ImageMap } from "@repo/render-core";
import { LAYOUTS, type Crop, type FrameLayout, type FrameLayouts, type SubtitleStyle } from "@repo/shared";
import { useApp } from "@/lib/app-provider";
import {
  addLine,
  applyScriptTemplate,
  deleteAsset,
  duplicateLine,
  fetchAssets,
  fetchProject,
  fetchScriptTemplates,
  fetchVoiceClips,
  fetchVoices,
  autobuildProject,
  importProductLink,
  MAX_LINES,
  removeLine,
  reorderLines,
  replaceLines,
  synthesizeVoice,
  updateLine,
  updateProject,
  uploadAsset,
  type AspectRatio,
  type MediaAssetView,
  type AutobuildStepReport,
  type Project,
  type ProjectLine,
  type ScriptTemplateOption,
  type StudioVoice,
  type TtsQuota,
  type VoiceClipView,
} from "@/lib/studio/projects-api";
import { buildPreviewConfig, loadMedia } from "@/lib/studio/preview";
import { useExport } from "@/lib/studio/use-export";
import { useHistory } from "@/lib/studio/use-history";
import { useHotkeys } from "@/lib/studio/use-hotkeys";
import { usePlayback } from "@/lib/studio/use-playback";
import { VoiceTrack } from "@/lib/studio/use-voice-playback";
import { AuthModal } from "@/components/auth/auth-modal";
import { StatusScreen } from "@/components/layout/status-screen";
import { ScenePanel } from "@/components/studio/scene-panel";
import { Stage } from "@/components/studio/stage";
import { SubtitlePanel, type PanelTab } from "@/components/studio/subtitle-panel";
import { AutobuildOverlay } from "@/components/studio/autobuild-overlay";
import { Timeline } from "@/components/studio/timeline";
import { TopBar, type SaveState } from "@/components/studio/top-bar";
import { TourProvider } from "@/components/tour/tour-provider";
import { ToastProvider, useToast } from "@/components/ui/toast";

/**
 * Ảnh chụp trạng thái cho hoàn tác.
 *
 * Chỉ gồm những gì người dùng **sửa được**: danh sách cảnh, kiểu phụ đề, giọng đọc. Tên
 * dự án và khổ video không nằm ở đây vì chúng có ô riêng, hoàn tác chúng cùng lúc với một
 * lần sửa thoại sẽ khiến người dùng không đoán được nút Undo làm gì.
 */
interface Snapshot {
  lines: ProjectLine[];
  subtitleStyle: Partial<SubtitleStyle>;
  /** Bố cục xem trước của cả ba khổ; kéo nhầm phụ đề phải hoàn tác lại được. */
  frameLayouts: Project["frameLayouts"];
  voiceId: string | null;
  voiceSpeed: number;
}

/**
 * Ghi bố cục vừa kéo vào **đúng khổ đang mở**, giữ nguyên hai khổ còn lại.
 *
 * Đây là chỗ duy nhất biết cách gộp, nên không có đường nào vô tình ghi đè bố cục của một
 * khổ khác — lỗi mà người dùng chỉ phát hiện sau khi đã đổi khổ và thấy công kéo biến mất.
 */
const mergeLayout = (project: Project, patch: Partial<FrameLayout>): FrameLayouts => ({
  ...project.frameLayouts,
  [project.aspectRatio]: {
    subtitleY: null,
    fontScale: null,
    ...project.frameLayouts[project.aspectRatio],
    ...patch,
  },
});

/** Cùng nguyên tắc, cho khung cắt ảnh của một cảnh. */
const mergeCrop = (
  project: Project,
  line: ProjectLine | undefined,
  crop: Crop,
): NonNullable<ProjectLine["crop"]> => ({
  ...line?.crop,
  [project.aspectRatio]: crop,
});

/**
 * Phòng dựng video — bố cục dock 4 phân vùng, chiếm trọn màn hình.
 *
 * Trang này không cuộn: mỗi phân vùng tự cuộn phần của nó. Cả trang cuộn được thì kim
 * playhead và khung xem trước sẽ trôi khỏi tầm mắt đúng lúc người dùng cần nhìn cả hai.
 */
/**
 * Bọc trang bằng `ToastProvider` rồi mới tới nội dung.
 *
 * Thông báo phải nổi lên trên toàn bộ bố cục dock, nên nhà cung cấp phải nằm **ngoài**
 * phần dựng bố cục — đặt bên trong thì lớp toast cũng bị mấy khung cuộn cắt mất.
 */
export default function StudioEditorPage() {
  return (
    <ToastProvider>
      <StudioEditor />
    </ToastProvider>
  );
}

function StudioEditor() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, authLoading, openAuth, refreshUser } = useApp();

  const [project, setProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<MediaAssetView[]>([]);
  const [templates, setTemplates] = useState<ScriptTemplateOption[]>([]);
  const [voices, setVoices] = useState<StudioVoice[]>([]);
  const [voiceClips, setVoiceClips] = useState<VoiceClipView[]>([]);
  const [quota, setQuota] = useState<TtsQuota | null>(null);
  const [synthesizing, setSynthesizing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [autobuilding, setAutobuilding] = useState(false);
  const [autobuildSteps, setAutobuildSteps] = useState<AutobuildStepReport[] | null>(null);
  /** Đã khởi động lần dựng tự động hay chưa — chống chạy hai lần trong cùng một phiên mở. */
  const autobuildStarted = useRef(false);
  const [voiceMuted, setVoiceMuted] = useState(false);

  /**
   * Thời lượng của cảnh đang được kéo trên thước.
   *
   * Giữ ở đây thay vì chỉ trong `Timeline` để **khung xem trước đổi theo tay người dùng**:
   * mọi mốc thời gian phía sau đều suy ra từ danh sách thời lượng, nên chỉ cần ghi đè một
   * phần tử là cả timeline dịch theo đúng.
   */
  const [dragDuration, setDragDuration] = useState<
    { index: number; durationMs: number } | null
  >(null);

  /**
   * Ảnh chụp trạng thái ngay trước cú kéo đang diễn ra.
   *
   * Kéo sinh ra hàng chục lần cập nhật rồi mới tới một lần lưu; chụp lúc lưu là chụp đúng
   * kết quả vừa kéo, và nút Hoàn tác sẽ không đưa về đâu được. Ghi lần đổi đầu tiên của
   * mỗi cú kéo, và tiêu thụ nó khi thả tay.
   */
  const dragUndo = useRef<Snapshot | null>(null);
  const [images, setImages] = useState<ImageMap>(new Map());
  // Hàm tua video; thay mỗi khi nạp lại media, nên giữ trong state chứ không phải ref.
  const [seekMedia, setSeekMedia] = useState<(timeMs: number) => void>(() => () => undefined);

  const [activeIndex, setActiveIndex] = useState(0);
  const [tab, setTab] = useState<PanelTab>("content");
  const [duration, setDuration] = useState(30);
  const [showSafeZone, setShowSafeZone] = useState(true);
  const [showCaption, setShowCaption] = useState(true);
  const [showImage, setShowImage] = useState(true);
  const [musicVolume, setMusicVolume] = useState(35);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const toast = useToast();

  /**
   * Lỗi **lúc mở dự án** vẫn là state, vì nó làm cả trang không dùng được.
   *
   * Một thông báo tự tắt sau hai giây không hợp ở đây: người dùng nhìn vào màn hình trống
   * và cần biết vì sao, kể cả khi họ quay lại sau mười phút.
   */
  const [loadError, setLoadError] = useState<string | null>(null);

  /**
   * Lỗi của từng thao tác thì không còn là state của trang.
   *
   * Trước đây nó là một dải chèn giữa thanh đỉnh và khung hình, và mỗi lần hiện lên là
   * **đẩy cả canvas trượt xuống** đúng lúc người dùng đang canh chỉnh.
   */
  const setError = useCallback(
    (message: string | null) => {
      if (message) toast(message, "danger");
    },
    [toast],
  );

  /**
   * Dựng tự động cả video: đọc link, viết kịch bản, gán hình, chọn giọng, lồng tiếng.
   *
   * Máy chủ chạy cả chuỗi trong một lệnh gọi và **không bao giờ ném lỗi giữa chừng** — bước
   * hỏng chỉ là một dòng trong `steps`. Vì vậy chỗ này không bắt lỗi từng bước, chỉ bắt lỗi
   * mạng và lỗi quyền.
   *
   * Mọi bước trót lọt thì đóng lớp phủ luôn; có bước cần người dùng xử lý thì giữ lại để họ
   * đọc, vì một toast hai giây sẽ tắt trước khi họ kịp hiểu phải làm gì.
   */
  const runAutobuild = useCallback(async () => {
    setAutobuilding(true);
    setAutobuildSteps(null);
    setSaveState("saving");

    try {
      const result = await autobuildProject(projectId);
      setProject(result.project);
      setAutobuildSteps(result.steps);
      setDuration(Math.max(30, result.project.lines.length * 10 || 30));

      const [loadedAssets, voice] = await Promise.all([
        fetchAssets(projectId),
        fetchVoiceClips(projectId),
      ]);
      setAssets(loadedAssets);
      setVoiceClips(voice.items);
      setQuota(voice.quota);
      setSaveState("saved");

      const needsAttention = result.steps.some((item) => item.needsUser);

      if (!needsAttention) {
        setAutobuildSteps(null);
        toast("Đã dựng xong, bạn xem lại rồi bấm Xuất MP4", "success");
      }
    } catch (cause) {
      setSaveState("error");
      setAutobuildSteps(null);
      setError(cause instanceof Error ? cause.message : "Không dựng được video");
    } finally {
      setAutobuilding(false);
    }
  }, [projectId, setError, toast]);


  const history = useHistory<Snapshot>();
  /**
   * Bản dự án của lần render đã commit gần nhất, để `snapshot()` đọc được mà không phải
   * đưa `project` vào deps của mọi callback.
   *
   * Cập nhật trong effect nên nó luôn là trạng thái **trước** thay đổi đang xảy ra — đúng
   * thứ ngăn xếp hoàn tác cần. Vì vậy không được dùng ref này để lấy giá trị **vừa** đổi;
   * chỗ nào cần giá trị mới thì nhận thẳng qua tham số.
   */
  const projectRef = useRef<Project | null>(null);
  useEffect(() => {
    projectRef.current = project;
  });

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    Promise.all([
      fetchProject(projectId),
      fetchAssets(projectId),
      fetchScriptTemplates(),
      fetchVoices(),
      fetchVoiceClips(projectId),
    ])
      .then(([loadedProject, loadedAssets, loadedTemplates, loadedVoices, voice]) => {
        if (cancelled) return;

        setProject(loadedProject);
        setAssets(loadedAssets);
        setTemplates(loadedTemplates);
        setVoices(loadedVoices);
        setVoiceClips(voice.items);
        setQuota(voice.quota);
        setDuration(Math.max(30, loadedProject.lines.length * 10 || 30));

        // Vào từ màn hình tạo dự án (`?autobuild=1`) thì dựng luôn, đúng một lần. Tham số
        // được xoá khỏi URL trước khi chạy: tải lại trang giữa chừng mà dựng lại từ đầu thì
        // vừa tốn hạn mức lồng tiếng vừa ghi đè thứ người dùng đang sửa.
        if (searchParams.get("autobuild") === "1" && !autobuildStarted.current) {
          autobuildStarted.current = true;
          router.replace(`/studio/${projectId}`, { scroll: false });
          void runAutobuild();
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setLoadError(cause instanceof Error ? cause.message : "Không mở được dự án");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, router, runAutobuild, searchParams, user]);

  /** Khung cắt của **khổ đang mở**, xếp theo chỉ số cảnh để khung xem trước tra thẳng. */
  const crops = useMemo(
    () => project?.lines.map((line) => line.crop?.[project.aspectRatio]) ?? [],
    [project],
  );

  const sceneDurations = useMemo(
    () =>
      project?.lines.map((line, position) =>
        dragDuration?.index === position ? dragDuration.durationMs : line.durationMs,
      ) ?? [],
    [project, dragDuration],
  );

  const totalMs = useMemo(
    () => sceneDurations.reduce((sum, value) => sum + value, 0),
    [sceneDurations],
  );

  const playback = usePlayback(totalMs);

  const config = useMemo(
    () =>
      project
        ? buildPreviewConfig(
            project,
            assets,
            project.subtitleStyle,
            sceneDurations,
            voiceClips,
          )
        : null,
    [project, assets, sceneDurations, voiceClips],
  );

  /** Mốc bắt đầu từng cảnh — cùng công thức với `buildPreviewConfig`, dùng để phát tiếng. */
  const sceneStartMs = useMemo(() => {
    const starts: number[] = [];

    sceneDurations.forEach((_, index) => {
      starts.push(index === 0 ? 0 : starts[index - 1]! + sceneDurations[index - 1]!);
    });

    return starts;
  }, [sceneDurations]);

  /**
   * Chỉ tải lại ảnh khi **tập URL** đổi.
   *
   * Nếu phụ thuộc vào `config` thì mỗi lần kéo thanh cỡ chữ sẽ tải lại toàn bộ ảnh, và
   * khung xem trước chớp trắng suốt lúc chỉnh.
   */
  const assetUrls = useMemo(
    () => (config ? config.scenes.map((scene) => scene.assetUrl).join("|") : ""),
    [config],
  );

  useEffect(() => {
    if (!config || !assetUrls) return;

    let cancelled = false;
    let mounted: HTMLElement[] = [];

    void loadMedia(config).then((loaded) => {
      if (cancelled) {
        for (const element of loaded.elements) element.remove();
        return;
      }

      // GIF chỉ chạy hoạt ảnh khi nằm trong DOM, và video cũng cần được gắn để giải mã.
      for (const element of loaded.elements) document.body.append(element);
      mounted = loaded.elements;

      setImages(loaded.frames);
      setSeekMedia(() => loaded.seek);
    });

    return () => {
      cancelled = true;
      for (const element of mounted) element.remove();
    };
    // Chỉ nạp lại khi **tập tài nguyên** đổi; đổi cỡ chữ phụ đề không được tải lại video.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetUrls]);

  const snapshot = useCallback((): Snapshot | null => {
    const current = projectRef.current;
    if (!current) return null;

    return {
      lines: current.lines.map((line) => ({ ...line, emphasis: [...line.emphasis] })),
      subtitleStyle: { ...current.subtitleStyle },
      frameLayouts: { ...current.frameLayouts },
      voiceId: current.voiceId,
      voiceSpeed: current.voiceSpeed,
    };
  }, []);

  /**
   * Gọi máy chủ kèm đèn báo lưu. `track` = có ghi vào ngăn xếp hoàn tác hay không.
   *
   * `before` dành cho các thao tác **kéo**: lúc thả tay thì trạng thái trên màn hình đã là
   * trạng thái mới rồi, chụp tại đó sẽ cho một bước hoàn tác không đưa được về đâu cả. Nơi
   * gọi tự chụp từ trước khi kéo và truyền vào đây.
   */
  const run = useCallback(
    async (
      task: () => Promise<Project>,
      track = true,
      before?: Snapshot | null,
    ) => {
      const previous = track ? (before !== undefined ? before : snapshot()) : null;

      setBusy(true);
      setSaveState("saving");
      setError(null);

      try {
        const updated = await task();
        setProject(updated);
        setSaveState("saved");
        if (previous) history.push(previous);
      } catch (cause) {
        setSaveState("error");
        setError(cause instanceof Error ? cause.message : "Không lưu được thay đổi");
      } finally {
        setBusy(false);
      }
    },
    [history, setError, snapshot],
  );

  /** Chụp trạng thái ở lần đổi **đầu tiên** của một cú kéo; các lần sau bỏ qua. */
  const beginDrag = useCallback(() => {
    dragUndo.current ??= snapshot();
  }, [snapshot]);

  /**
   * Lấy và xoá ảnh chụp của cú kéo vừa xong.
   *
   * Trả `undefined` khi không có cú kéo nào — chẳng hạn nút "Đặt lại khung ảnh" — để `run`
   * tự chụp như mọi thao tác bấm một phát khác.
   */
  const endDrag = useCallback((): Snapshot | undefined => {
    const before = dragUndo.current;
    dragUndo.current = null;
    return before ?? undefined;
  }, []);

  /** Khôi phục cả ảnh chụp trong hai lệnh, thay vì sửa lại từng cảnh một. */
  const restore = useCallback(
    async (target: Snapshot) => {
      setBusy(true);
      setSaveState("saving");
      setError(null);

      try {
        await replaceLines(projectId, target.lines);
        const updated = await updateProject(projectId, {
          subtitleStyle: target.subtitleStyle,
          frameLayouts: target.frameLayouts,
          voiceId: target.voiceId,
          voiceSpeed: target.voiceSpeed,
        });
        setProject(updated);
        setSaveState("saved");
      } catch (cause) {
        setSaveState("error");
        setError(cause instanceof Error ? cause.message : "Không khôi phục được");
      } finally {
        setBusy(false);
      }
    },
    [projectId, setError],
  );

  const handleUndo = useCallback(() => {
    const current = snapshot();
    if (!current) return;

    const previous = history.undo(current);
    if (previous) void restore(previous);
  }, [history, restore, snapshot]);

  const handleRedo = useCallback(() => {
    const current = snapshot();
    if (!current) return;

    const next = history.redo(current);
    if (next) void restore(next);
  }, [history, restore, snapshot]);

  /**
   * Lồng tiếng cho cả video.
   *
   * Không đưa vào `run()` vì thao tác này đổi **thời lượng các cảnh**, tức đổi cả timeline;
   * gộp chung vào ngăn xếp hoàn tác sẽ khiến một lần Ctrl+Z vừa gỡ tiếng vừa đổi độ dài mà
   * người dùng không đoán được.
   */
  const handleSynthesize = useCallback(
    async (force: boolean) => {
      setSynthesizing(true);
      setSaveState("saving");
      setError(null);
      playback.pause();

      try {
        const result = await synthesizeVoice(projectId, force);
        setProject(result.project);
        setVoiceClips(result.clips);
        setQuota(result.quota);
        setSaveState("saved");
      } catch (cause) {
        setSaveState("error");
        setError(cause instanceof Error ? cause.message : "Không lồng tiếng được");
      } finally {
        setSynthesizing(false);
      }
    },
    [playback, projectId, setError],
  );

  const { state: exportState, start: startExport } = useExport({
    onError: setError,
    // Số credit hiện ở header; không làm mới thì người dùng vừa bị trừ tiền mà màn hình
    // vẫn báo số cũ, và họ sẽ nghĩ hệ thống đếm sai.
    onBalanceChange: () => void refreshUser(),
  });

  const handleExport = useCallback(() => {
    const current = projectRef.current;
    if (!current || exportState.running) return;

    // Tên file lấy từ tên dự án; ký tự không hợp lệ trên Windows sẽ làm hỏng lượt tải.
    const safeName =
      current.title.replace(/[\\/:*?"<>|]+/g, "-").trim().slice(0, 60) || "reelforge";

    void startExport(projectId, safeName);
  }, [exportState.running, projectId, startExport]);

  /**
   * Đóng tab giữa lúc đang encode là mất cả video lẫn credit đã giữ chỗ.
   *
   * Trình duyệt không cho tuỳ biến nội dung hộp thoại này, nhưng nó vẫn buộc người dùng
   * dừng lại một nhịp — đủ để họ nhận ra mình đang bỏ dở việc gì.
   */
  useEffect(() => {
    if (!exportState.running) return;

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);

    return () => window.removeEventListener("beforeunload", warn);
  }, [exportState.running]);

  const lines = project?.lines ?? [];

  useHotkeys({
    playPause: playback.toggle,
    prevScene: () => setActiveIndex((index) => Math.max(0, index - 1)),
    nextScene: () =>
      setActiveIndex((index) => Math.min(Math.max(0, lines.length - 1), index + 1)),
    seekBack: () => playback.nudge(-500),
    seekForward: () => playback.nudge(500),
    addScene: () => {
      if (!busy && lines.length < MAX_LINES) {
        void run(() => addLine(projectId, "Nội dung cảnh mới"));
      }
    },
    undo: handleUndo,
    redo: handleRedo,
    // Mọi thay đổi đã tự lưu ngay khi xảy ra; Ctrl+S chỉ để người dùng yên tâm.
    save: () => setSaveState("saved"),
    export: handleExport,
  });

  if (authLoading || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 size={22} className="animate-spin text-brand" />
      </main>
    );
  }

  if (!user) {
    return (
      <>
        <StatusScreen
          status="forbidden"
          onPrimary={() => openAuth("signin", `/studio/${projectId}`)}
        />
        <AuthModal />
      </>
    );
  }

  if (!project) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4">
        <p className="text-sm text-muted">{loadError ?? "Không tìm thấy dự án"}</p>
        <Link
          href="/studio"
          className="rounded-btn border border-line bg-subtle px-4 py-2 text-sm font-semibold text-ink"
        >
          Về danh sách dự án
        </Link>
      </main>
    );
  }

  const line = project.lines[activeIndex];

  /**
   * Cỡ chữ đang có hiệu lực ở khổ này.
   *
   * Xếp theo đúng thứ tự mà `buildRenderConfig` dùng, để thanh trượt trong panel và khung
   * xem trước không bao giờ hiển thị hai con số khác nhau.
   */
  const fontScale =
    project.frameLayouts[project.aspectRatio]?.fontScale ??
    project.subtitleStyle.fontScale ??
    LAYOUTS[project.aspectRatio].fontScale;

  /** Kéo: đổi ngay trên màn hình. Dùng chung cho khung xem trước và thanh trượt cỡ chữ. */
  const changeLayout = (patch: Partial<FrameLayout>) => {
    beginDrag();
    setProject({ ...project, frameLayouts: mergeLayout(project, patch) });
  };

  const commitLayout = (patch: Partial<FrameLayout>) =>
    void run(
      () => updateProject(projectId, { frameLayouts: mergeLayout(project, patch) }),
      true,
      endDrag(),
    );

  const patchLine = (patch: Partial<ProjectLine>) => {
    if (!line) return;
    const next = [...project.lines];
    next[line.index] = { ...line, ...patch };
    setProject({ ...project, lines: next });
  };

  /**
   * Đọc lại link sản phẩm. Không ghi đè những trường người dùng đã sửa — máy chủ chỉ điền
   * vào chỗ còn trống.
   *
   * Không đi qua `run`: sản phẩm không nằm trong ảnh chụp hoàn tác, và kết quả cần tải lại
   * cả thư viện ảnh chứ không chỉ dự án.
   */
  const handleReimport = async () => {
    setImporting(true);
    setSaveState("saving");

    try {
      const result = await importProductLink(projectId);
      setProject(result.project);
      setAssets(await fetchAssets(projectId));
      setSaveState("saved");

      if (result.crawl.status === "failed") {
        toast("Sàn chưa trả dữ liệu cho link này, bạn điền tay giúp nhé", "warning");
      } else {
        toast(
          result.importedImages > 0
            ? `Đã đọc lại link · thêm ${result.importedImages} ảnh`
            : "Đã đọc lại link",
          "success",
        );
      }
    } catch (cause) {
      setSaveState("error");
      setError(cause instanceof Error ? cause.message : "Không đọc được link");
    } finally {
      setImporting(false);
    }
  };

  const handleUpload = async (file: File) => {
    setBusy(true);
    setSaveState("saving");
    setError(null);

    try {
      const uploaded = await uploadAsset(projectId, file);
      setAssets((current) => [...current, uploaded]);

      // Ảnh mới gắn luôn vào cảnh đang chọn nếu cảnh đó còn trống — đỡ một thao tác.
      if (line && !line.assetId) {
        setProject(await updateLine(projectId, line.index, { assetId: uploaded.id }));
      }
      setSaveState("saved");
    } catch (cause) {
      setSaveState("error");
      setError(cause instanceof Error ? cause.message : "Không tải được ảnh");
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveAsset = async (assetId: string) => {
    try {
      await deleteAsset(projectId, assetId);
      setAssets((current) => current.filter((item) => item.id !== assetId));
      // Cảnh nào đang dùng ảnh vừa xoá thì phải trở lại trạng thái "thiếu ảnh", nếu không
      // giao diện vẫn báo đủ trong khi khung xem trước đã trống.
      setProject((current) =>
        current
          ? {
              ...current,
              lines: current.lines.map((item) =>
                item.assetId === assetId ? { ...item, assetId: null } : item,
              ),
            }
          : current,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không xoá được ảnh");
    }
  };

  return (
    <>
      {/* Phòng dựng cần bề ngang thật; dưới 1024px thì mọi phân vùng đều bị bóp méo. */}
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center lg:hidden">
        <MonitorSmartphone size={28} className="text-brand" />
        <h1 className="font-display text-lg font-bold text-ink">
          Phòng dựng cần màn hình rộng
        </h1>
        <p className="max-w-[320px] text-sm leading-relaxed text-muted">
          Bốn phân vùng của trang dựng video chỉ vừa từ 1024px trở lên. Hãy mở dự án này
          trên máy tính — việc xuất file cũng cần máy tính.
        </p>
        <Link
          href="/studio"
          className="rounded-btn border border-line bg-subtle px-4 py-2 text-sm font-semibold text-ink"
        >
          Về danh sách dự án
        </Link>
      </main>

      {/*
        Tour chỉ bật khi phòng dựng đã dựng thật: dưới 1024px giao diện này không render nên
        mọi neo đều không tồn tại, và tour sẽ bỏ qua từng bước cho tới hết một cách vô ích.
      */}
      <TourProvider
        tourKey="studio"
        enabled={Boolean(project)}
        preparers={{ openTab: (value) => setTab((value ?? "content") as PanelTab) }}
      >
        <main className="hidden h-screen w-full flex-col overflow-hidden bg-canvas lg:flex">
        {/* Phát tiếng khớp playhead; component này không vẽ gì, xem ghi chú ở `VoiceTrack`. */}
        <VoiceTrack
          clips={voiceClips}
          sceneStartMs={sceneStartMs}
          playback={playback}
          muted={voiceMuted}
        />

        <TopBar
          title={project.title}
          aspectRatio={project.aspectRatio}
          resolution={project.resolution}
          credits={user.credits}
          saveState={saveState}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          playback={playback}
          onTitleCommit={(title) =>
            void run(() => updateProject(projectId, { title }), false)
          }
          onAspectChange={(aspectRatio: AspectRatio) =>
            void run(() => updateProject(projectId, { aspectRatio }), false)
          }
          onResolutionChange={(resolution) =>
            void run(() => updateProject(projectId, { resolution }), false)
          }
          onUndo={handleUndo}
          onRedo={handleRedo}
          onExport={handleExport}
          onRunVoice={() => void handleSynthesize(false)}
          onOpenSubtitle={() => setTab("subtitle")}
          onAutobuild={() => void runAutobuild()}
          exporting={exportState.running}
          exportPercent={exportState.percent}
          exportStage={exportState.stage}
        />

        <div className="flex min-h-0 flex-1">
          <ScenePanel
            lines={project.lines}
            activeIndex={activeIndex}
            busy={busy}
            maxLines={MAX_LINES}
            onSelect={setActiveIndex}
            onAdd={() => void run(() => addLine(projectId, "Nội dung cảnh mới"))}
            onDuplicate={(index) => void run(() => duplicateLine(projectId, index))}
            onRemove={(index) => {
              setActiveIndex(0);
              void run(() => removeLine(projectId, index));
            }}
            onReorder={(from, to) => {
              const order = project.lines.map((item) => item.index);
              const [moved] = order.splice(from, 1);
              if (moved === undefined) return;
              order.splice(to, 0, moved);
              setActiveIndex(to);
              void run(() => reorderLines(projectId, order));
            }}
          />

          <div className="min-w-0 flex-1">
            {config ? (
              <Stage
                config={config}
                images={images}
                seekMedia={seekMedia}
                playback={playback}
                showSafeZone={showSafeZone}
                showCaption={showCaption}
                showImage={showImage}
                onToggleSafeZone={() => setShowSafeZone((value) => !value)}
                crops={crops}
                onLayoutChange={changeLayout}
                onLayoutCommit={commitLayout}
                onCropChange={(index, crop) => {
                  beginDrag();
                  setProject({
                    ...project,
                    lines: project.lines.map((item) =>
                      item.index === index
                        ? { ...item, crop: mergeCrop(project, item, crop) }
                        : item,
                    ),
                  });
                }}
                onCropCommit={(index, crop) =>
                  void run(
                    () =>
                      updateLine(projectId, index, {
                        crop: mergeCrop(project, project.lines[index], crop),
                      }),
                    true,
                    endDrag(),
                  )
                }
              />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center">
                <p className="max-w-[260px] text-sm leading-relaxed text-muted">
                  Chưa có gì để xem trước. Chọn một mẫu kịch bản ở cột phải, rồi tải ảnh
                  sản phẩm lên.
                </p>
              </div>
            )}
          </div>

          <SubtitlePanel
            tab={tab}
            onTabChange={setTab}
            project={project}
            line={line}
            assets={assets}
            templates={templates}
            voices={voices}
            duration={duration}
            subtitle={project.subtitleStyle}
            fontScale={fontScale}
            onLayoutChange={changeLayout}
            onLayoutCommit={commitLayout}
            busy={busy}
            importing={importing}
            onProductChange={(patch) =>
              setProject({ ...project, product: { ...project.product, ...patch } })
            }
            onProductCommit={(product) =>
              // Sản phẩm không nằm trong ảnh chụp hoàn tác, nên không đẩy vào lịch sử.
              void run(() => updateProject(projectId, { product }), false)
            }
            onReimport={() => void handleReimport()}
            onDurationChange={setDuration}
            onApplyTemplate={(code) =>
              void run(() => applyScriptTemplate(projectId, code, duration))
            }
            onLineTextChange={(text) => patchLine({ text })}
            onLineTextCommit={(text) => {
              if (!line || text.trim() === "") return;
              void run(() => updateLine(projectId, line.index, { text }));
            }}
            onEmphasisChange={(emphasis) => {
              if (!line) return;
              void run(() => updateLine(projectId, line.index, { emphasis }));
            }}
            onSubtitleChange={(patch) =>
              setProject({
                ...project,
                subtitleStyle: { ...project.subtitleStyle, ...patch },
              })
            }
            onSubtitleCommit={(subtitleStyle) =>
              void run(() => updateProject(projectId, { subtitleStyle }))
            }
            onAssignAsset={(assetId) => {
              if (!line) return;
              void run(() => updateLine(projectId, line.index, { assetId }));
            }}
            onUploadAsset={(file) => void handleUpload(file)}
            onDeleteAsset={(assetId) => void handleRemoveAsset(assetId)}
            onVoiceChange={(voiceId) =>
              void run(() => updateProject(projectId, { voiceId }))
            }
            onSpeedChange={(voiceSpeed) => setProject({ ...project, voiceSpeed })}
            onSpeedCommit={(voiceSpeed) =>
              void run(() => updateProject(projectId, { voiceSpeed }))
            }
            quota={quota}
            voicedLines={project.lines.filter((item) => item.voiceClipId).length}
            synthesizing={synthesizing}
            onSynthesize={(force) => void handleSynthesize(force)}
          />
        </div>

        <Timeline
          lines={project.lines}
          assets={assets}
          activeIndex={activeIndex}
          playback={playback}
          totalMs={totalMs}
          musicVolume={musicVolume}
          showImage={showImage}
          showCaption={showCaption}
          voiceClips={voiceClips}
          voiceMuted={voiceMuted}
          onToggleVoiceMuted={() => setVoiceMuted((value) => !value)}
          onSelect={setActiveIndex}
          onDurationPreview={setDragDuration}
          onDurationChange={(index, durationMs) =>
            void run(() => updateLine(projectId, index, { durationMs }))
          }
          onMusicVolumeChange={setMusicVolume}
            onToggleImage={() => setShowImage((value) => !value)}
            onToggleCaption={() => setShowCaption((value) => !value)}
          />
        </main>

        <AutobuildOverlay
          running={autobuilding}
          steps={autobuildSteps}
          onClose={() => setAutobuildSteps(null)}
        />
      </TourProvider>
    </>
  );
}
