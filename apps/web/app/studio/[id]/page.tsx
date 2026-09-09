"use client";

import { Loader2, MonitorSmartphone } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ImageMap } from "@repo/render-core";
import type { SubtitleStyle } from "@repo/shared";
import { useApp } from "@/lib/app-provider";
import {
  addLine,
  applyScriptTemplate,
  deleteAsset,
  duplicateLine,
  fetchAssets,
  fetchProject,
  fetchScriptTemplates,
  fetchVoices,
  MAX_LINES,
  removeLine,
  reorderLines,
  replaceLines,
  updateLine,
  updateProject,
  uploadAsset,
  type AspectRatio,
  type MediaAssetView,
  type Project,
  type ProjectLine,
  type ScriptTemplateOption,
  type StudioVoice,
} from "@/lib/studio/projects-api";
import { buildPreviewConfig, loadImages } from "@/lib/studio/preview";
import { pickRenderPath } from "@/lib/studio/render-path";
import { useHistory } from "@/lib/studio/use-history";
import { useHotkeys } from "@/lib/studio/use-hotkeys";
import { usePlayback } from "@/lib/studio/use-playback";
import { AuthModal } from "@/components/auth/auth-modal";
import { StatusScreen } from "@/components/layout/status-screen";
import { ScenePanel } from "@/components/studio/scene-panel";
import { Stage } from "@/components/studio/stage";
import { SubtitlePanel, type PanelTab } from "@/components/studio/subtitle-panel";
import { Timeline } from "@/components/studio/timeline";
import { TopBar, type SaveState } from "@/components/studio/top-bar";

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
  voiceId: string | null;
  voiceSpeed: number;
}

/**
 * Phòng dựng video — bố cục dock 4 phân vùng, chiếm trọn màn hình.
 *
 * Trang này không cuộn: mỗi phân vùng tự cuộn phần của nó. Cả trang cuộn được thì kim
 * playhead và khung xem trước sẽ trôi khỏi tầm mắt đúng lúc người dùng cần nhìn cả hai.
 */
export default function StudioEditorPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { user, authLoading, openAuth } = useApp();

  const [project, setProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<MediaAssetView[]>([]);
  const [templates, setTemplates] = useState<ScriptTemplateOption[]>([]);
  const [voices, setVoices] = useState<StudioVoice[]>([]);
  const [images, setImages] = useState<ImageMap>(new Map());

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
  const [error, setError] = useState<string | null>(null);

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
    ])
      .then(([loadedProject, loadedAssets, loadedTemplates, loadedVoices]) => {
        if (cancelled) return;

        setProject(loadedProject);
        setAssets(loadedAssets);
        setTemplates(loadedTemplates);
        setVoices(loadedVoices);
        setDuration(Math.max(30, loadedProject.lines.length * 10 || 30));
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Không mở được dự án");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, user]);

  const sceneDurations = useMemo(
    () => project?.lines.map((line) => line.durationMs) ?? [],
    [project],
  );

  const totalMs = useMemo(
    () => sceneDurations.reduce((sum, value) => sum + value, 0),
    [sceneDurations],
  );

  const playback = usePlayback(totalMs);

  const config = useMemo(
    () =>
      project
        ? buildPreviewConfig(project, assets, project.subtitleStyle, sceneDurations)
        : null,
    [project, assets, sceneDurations],
  );

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
    if (!assetUrls) return;

    let cancelled = false;

    void loadImages(assetUrls.split("|")).then((loaded) => {
      if (!cancelled) setImages(loaded);
    });

    return () => {
      cancelled = true;
    };
  }, [assetUrls]);

  const snapshot = useCallback((): Snapshot | null => {
    const current = projectRef.current;
    if (!current) return null;

    return {
      lines: current.lines.map((line) => ({ ...line, emphasis: [...line.emphasis] })),
      subtitleStyle: { ...current.subtitleStyle },
      voiceId: current.voiceId,
      voiceSpeed: current.voiceSpeed,
    };
  }, []);

  /** Gọi máy chủ kèm đèn báo lưu. `track` = có ghi vào ngăn xếp hoàn tác hay không. */
  const run = useCallback(
    async (task: () => Promise<Project>, track = true) => {
      const before = track ? snapshot() : null;

      setBusy(true);
      setSaveState("saving");
      setError(null);

      try {
        const updated = await task();
        setProject(updated);
        setSaveState("saved");
        if (before) history.push(before);
      } catch (cause) {
        setSaveState("error");
        setError(cause instanceof Error ? cause.message : "Không lưu được thay đổi");
      } finally {
        setBusy(false);
      }
    },
    [history, snapshot],
  );

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
    [projectId],
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

  const handleExport = useCallback(() => {
    const path = pickRenderPath();

    if (path.kind === "unsupported") {
      setError(path.reason);
      return;
    }

    setError(
      "Máy này đủ điều kiện xuất video. Bộ xuất MP4 (WebCodecs) là bước tiếp theo của hệ thống, hiện chưa bật.",
    );
  }, []);

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
        <p className="text-sm text-muted">{error ?? "Không tìm thấy dự án"}</p>
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

  const patchLine = (patch: Partial<ProjectLine>) => {
    if (!line) return;
    const next = [...project.lines];
    next[line.index] = { ...line, ...patch };
    setProject({ ...project, lines: next });
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

      <main className="hidden h-screen w-full flex-col overflow-hidden bg-canvas lg:flex">
        <TopBar
          title={project.title}
          aspectRatio={project.aspectRatio}
          saveState={saveState}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          onTitleChange={(title) => setProject({ ...project, title })}
          onTitleCommit={(title) =>
            void run(() => updateProject(projectId, { title }), false)
          }
          onAspectChange={(aspectRatio: AspectRatio) =>
            void run(() => updateProject(projectId, { aspectRatio }), false)
          }
          onUndo={handleUndo}
          onRedo={handleRedo}
          onExport={handleExport}
        />

        {error ? (
          <p
            role="alert"
            className="shrink-0 border-b border-line bg-subtle px-4 py-2 text-xs text-ink"
          >
            {error}
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-2 font-semibold text-muted underline"
            >
              Đóng
            </button>
          </p>
        ) : null}

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
                playback={playback}
                showSafeZone={showSafeZone}
                showCaption={showCaption}
                showImage={showImage}
                onToggleSafeZone={() => setShowSafeZone((value) => !value)}
                onSubtitleYChange={(positionY) =>
                  setProject({
                    ...project,
                    subtitleStyle: { ...project.subtitleStyle, positionY },
                  })
                }
                onSubtitleYCommit={(positionY) =>
                  void run(() =>
                    updateProject(projectId, {
                      subtitleStyle: { ...project.subtitleStyle, positionY },
                    }),
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
            busy={busy}
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
          onSelect={setActiveIndex}
          onDurationChange={(index, durationMs) =>
            void run(() => updateLine(projectId, index, { durationMs }))
          }
          onMusicVolumeChange={setMusicVolume}
          onToggleImage={() => setShowImage((value) => !value)}
          onToggleCaption={() => setShowCaption((value) => !value)}
        />
      </main>
    </>
  );
}
