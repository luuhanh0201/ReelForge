"use client";

import {
  Coins,
  Film,
  Hammer,
  Languages,
  Link2,
  Loader2,
  PenLine,
  Plus,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useApp } from "@/lib/app-provider";
import {
  ASPECT_OPTIONS,
  createProject,
  deleteProject,
  fetchProjects,
  type AspectRatio,
  type Project,
  type ProjectMode,
} from "@/lib/studio/projects-api";
import { L } from "@/lib/i18n";
import { AuthModal } from "@/components/auth/auth-modal";
import { SiteHeader } from "@/components/layout/site-header";
import { TourProvider } from "@/components/tour/tour-provider";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { StatusScreen } from "@/components/layout/status-screen";

const MODE_LABEL: Record<ProjectMode, string> = {
  link: "Từ link sản phẩm",
  manual: "Tự viết nội dung",
};

/**
 * Ba lối vào tạo dự án.
 *
 * Lối nào **chưa chạy được thì khoá lại và nói thẳng**, thay vì để người dùng bấm vào rồi
 * gặp một màn hình trống. Vẫn liệt kê các bước của luồng: người dùng biết sản phẩm sẽ đi
 * tới đâu, và biết cái họ cần có phải chờ hay không.
 *
 * Đầu vào khác nhau nhưng mọi thứ phía sau — kịch bản, phụ đề, lồng tiếng, xuất video —
 * dùng chung, nên cả ba cùng dẫn tới một màn hình dựng.
 */
interface EntryPoint {
  id: ProjectMode | "translate";
  icon: LucideIcon;
  title: { vi: string; en: string };
  hint: { vi: string; en: string };
  ready: boolean;
}

const ENTRY_POINTS: EntryPoint[] = [
  {
    id: "manual",
    icon: PenLine,
    title: L("Tự viết nội dung", "Write it yourself"),
    hint: L(
      "Tải ảnh lên và tự soạn lời thoại từng cảnh",
      "Upload images and write each scene",
    ),
    // Luồng: tải ảnh → viết lời thoại → lồng tiếng → xuất MP4.
    ready: true,
  },
  {
    id: "link",
    icon: Link2,
    title: L("Từ link sản phẩm", "From a product link"),
    hint: L(
      "Dán link Shopee, TikTok Shop hoặc Lazada",
      "Paste a Shopee, TikTok Shop or Lazada link",
    ),
    // Luồng dự kiến: dán link + đặt tên → AI phân tích → người dùng kiểm tra và sửa lần
    // cuối → xuất. Chưa có `CrawlerModule` nên chưa mở.
    ready: false,
  },
  {
    id: "translate",
    icon: Languages,
    title: L("Biên dịch video", "Translate a video"),
    hint: L(
      "Tải video lên, dịch phụ đề sang ngôn ngữ khác",
      "Upload a video and translate its subtitles",
    ),
    // Luồng dự kiến: nhận video → tách phụ đề → chọn ngôn ngữ nguồn và đích → dịch →
    // người dùng sửa lần cuối → xuất. Chưa có bộ nhận dạng tiếng nói lẫn bộ dịch.
    ready: false,
  },
];

export default function StudioPage() {
  return (
    <ToastProvider>
      <ProjectList />
    </ToastProvider>
  );
}

function ProjectList() {
  const { t, user, authLoading, openAuth } = useApp();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  /** Lỗi thao tác báo bằng thông báo nổi; không đẩy nội dung trang xuống. */
  const setError = useCallback(
    (message: string) => toast(message, "danger"),
    [toast],
  );
  const [creating, setCreating] = useState<ProjectMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    fetchProjects()
      .then((items) => {
        if (!cancelled) setProjects(items);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "Không đọc được danh sách dự án",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [setError, user]);

  if (authLoading) {
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
          onPrimary={() => openAuth("signin", "/studio")}
        />
        <AuthModal />
      </>
    );
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!creating) return;

    setBusy(true);
    try {
      const project = await createProject({
        mode: creating,
        title: title.trim() || undefined,
        aspectRatio,
      });

      router.push(`/studio/${project.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tạo được dự án");
      setBusy(false);
    }
  };

  const handleDelete = async (project: Project) => {
    setBusy(true);
    try {
      await deleteProject(project.id);
      setProjects((current) => current.filter((item) => item.id !== project.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không xoá được dự án");
    } finally {
      setBusy(false);
    }
  };

  return (
    // Cùng bộ máy tour với phòng dựng, chỉ khác khu vực. Trang này chưa có tour nào được
    // xuất bản nên không hiện gì — quản trị viên soạn xong là chạy, không cần sửa mã.
    <TourProvider tourKey="dashboard">
      {/* Header chung của site: logo, ngôn ngữ, theme, số credit và menu tài khoản. */}
      <SiteHeader />

      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="mr-auto">
            <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
              {t(L("Dự án của bạn", "Your projects"))}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {t(
                L(
                  "Tự viết nội dung để bắt đầu ngay. Tạo từ link và biên dịch video đang được phát triển.",
                  "Write your own script to start now. Link import and video translation are in development.",
                ),
              )}
            </p>
          </div>

          <span
            data-tour="dashboard.credits"
            className="inline-flex items-center gap-1.5 rounded-btn border border-mint/30 bg-mint/10 px-3 py-1.5 text-sm font-semibold text-mint"
          >
            <Coins size={15} />
            {user.credits} credits
          </span>
        </div>

          <div
          data-tour="dashboard.entries"
          className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {ENTRY_POINTS.map((entry) => {
            const Icon = entry.icon;

            const body = (
              <span className="flex items-center gap-3 pr-2">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-btn ${
                    entry.ready ? "bg-brand text-[#10151e]" : "bg-subtle text-muted"
                  }`}
                >
                  <Icon size={20} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">
                    {t(entry.title)}
                  </span>
                  <span className="block text-xs leading-snug text-muted">
                    {t(entry.hint)}
                  </span>
                </span>
              </span>
            );

            if (!entry.ready) {
              return (
                <div
                  key={entry.id}
                  aria-disabled="true"
                  title={t(
                    L(
                      "Tính năng đang phát triển, chưa dùng được",
                      "This feature is still in development",
                    ),
                  )}
                  className="relative flex cursor-not-allowed flex-col rounded-card border border-dashed border-line bg-surface p-4 opacity-65"
                >
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-btn bg-amber/15 px-2 py-0.5 text-[10px] font-bold text-amber">
                    <Hammer size={10} />
                    {t(L("Đang phát triển", "In development"))}
                  </span>
                  {body}
                </div>
              );
            }

            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setCreating("manual")}
                className="flex flex-col rounded-card border border-brand/40 bg-brand/[0.06] p-4 text-left transition-colors hover:border-brand"
              >
                {body}
              </button>
            );
          })}
        </div>

        {creating ? (
          <form
            onSubmit={(event) => void handleCreate(event)}
            className="mt-4 rounded-card border border-line bg-surface p-4"
          >
            <p className="text-sm font-bold text-ink">{MODE_LABEL[creating]}</p>

            <div className="mt-3 flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted">
                  {t(L("Tên dự án", "Project name"))}
                </span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={t(L("Ví dụ: Máy lọc không khí Gen4", "e.g. Air purifier Gen4"))}
                  className="h-11 rounded-btn border border-line bg-canvas px-3.5 text-sm text-ink outline-none focus:border-brand/50"
                />
              </label>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted">
                  {t(L("Khổ video", "Aspect ratio"))}
                </span>
                <div className="flex flex-wrap gap-2">
                  {ASPECT_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setAspectRatio(option.id)}
                      className={`rounded-btn border px-3 py-2 text-left text-xs transition-colors ${
                        aspectRatio === option.id
                          ? "border-brand bg-brand/10 text-ink"
                          : "border-line bg-canvas text-muted hover:border-brand/40"
                      }`}
                    >
                      <span className="block font-bold">{option.label}</span>
                      <span className="block text-[11px] text-muted">{option.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-btn bg-brand px-5 text-sm font-bold text-[#10151e] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {t(L("Tạo dự án", "Create project"))}
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(null)}
                  className="inline-flex h-11 items-center justify-center rounded-btn border border-line bg-subtle px-4 text-sm font-semibold text-muted transition-colors hover:text-ink"
                >
                  {t(L("Huỷ", "Cancel"))}
                </button>
              </div>
            </div>
          </form>
        ) : null}

        <div className="mt-8">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Loader2 size={16} className="animate-spin text-brand" />
              {t(L("Đang tải dự án...", "Loading projects..."))}
            </p>
          ) : projects.length === 0 ? (
            <div className="rounded-card border border-dashed border-line bg-surface p-10 text-center">
              <Film size={28} className="mx-auto text-muted" />
              <p className="mt-3 text-sm font-semibold text-ink">
                {t(L("Chưa có dự án nào", "No projects yet"))}
              </p>
              <p className="mt-1 text-xs text-muted">
                {t(
                  L(
                    "Bắt đầu bằng lối vào Tự viết nội dung phía trên.",
                    "Start with \"Write it yourself\" above.",
                  ),
                )}
              </p>
            </div>
          ) : (
            <ul data-tour="dashboard.projects" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <li
                  key={project.id}
                  className="flex flex-col rounded-card border border-line bg-surface p-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-btn bg-subtle px-2 py-0.5 font-mono text-[11px] font-bold text-muted">
                      {project.aspectRatio}
                    </span>
                    <span className="text-[11px] text-muted">
                      {MODE_LABEL[project.mode]}
                    </span>
                  </div>

                  <Link
                    href={`/studio/${project.id}`}
                    className="mt-2 font-display text-base font-bold text-ink transition-colors hover:text-brand"
                  >
                    {project.title}
                  </Link>

                  <p className="mt-1 text-xs text-muted">
                    {project.lines.length > 0
                      ? `${project.lines.length} cảnh · ${project.lines.length * 10} giây`
                      : t(L("Chưa có kịch bản", "No script yet"))}
                  </p>

                  <div className="mt-auto flex items-center gap-2 pt-4">
                    <Link
                      href={`/studio/${project.id}`}
                      className="inline-flex h-9 flex-1 items-center justify-center rounded-btn border border-line bg-subtle text-sm font-semibold text-ink transition-colors hover:border-brand/45"
                    >
                      {t(L("Mở", "Open"))}
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleDelete(project)}
                      disabled={busy}
                      title={t(L("Xoá dự án", "Delete project"))}
                      aria-label={t(L("Xoá dự án", "Delete project"))}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-btn border border-line bg-subtle text-muted transition-colors hover:border-danger/45 hover:text-danger disabled:opacity-45"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </TourProvider>
  );
}
