"use client";

import {
  ArrowLeft,
  Coins,
  Film,
  Link2,
  Loader2,
  PenLine,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
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
import { StatusScreen } from "@/components/layout/status-screen";

const MODE_LABEL: Record<ProjectMode, string> = {
  link: "Từ link sản phẩm",
  manual: "Tự viết nội dung",
};

/**
 * Danh sách dự án video.
 *
 * Hai lối vào tách bạch theo tài liệu thiết kế: từ link sản phẩm và tự viết nội dung.
 * Chúng khác nhau hoàn toàn ở đầu vào nhưng dùng chung mọi thứ phía sau, nên cùng dẫn tới
 * một màn hình dựng video.
 */
export default function StudioPage() {
  const { t, user, authLoading, openAuth } = useApp();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<ProjectMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
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
  }, [user]);

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
        sourceUrl: creating === "link" ? sourceUrl.trim() : undefined,
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
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={16} />
        {t(L("Về trang chủ", "Back home"))}
      </Link>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
            {t(L("Dự án của bạn", "Your projects"))}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t(
              L(
                "Dán link sản phẩm để AI dựng sẵn, hoặc tự viết nội dung theo ý bạn.",
                "Paste a product link, or write the script yourself.",
              ),
            )}
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-btn border border-mint/30 bg-mint/10 px-3 py-1.5 text-sm font-semibold text-mint">
          <Coins size={15} />
          {user.credits} credits
        </span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setCreating("link")}
          className="flex items-center gap-3 rounded-card border border-brand/40 bg-brand/[0.06] p-4 text-left transition-colors hover:border-brand"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-brand text-[#10151e]">
            <Link2 size={20} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-ink">
              {t(L("Từ link sản phẩm", "From a product link"))}
            </span>
            <span className="block text-xs text-muted">
              {t(
                L(
                  "Dán link Shopee, TikTok Shop hoặc Lazada",
                  "Paste a Shopee, TikTok Shop or Lazada link",
                ),
              )}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setCreating("manual")}
          className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 text-left transition-colors hover:border-brand/45"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-subtle text-ink">
            <PenLine size={20} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-ink">
              {t(L("Tự viết nội dung", "Write it yourself"))}
            </span>
            <span className="block text-xs text-muted">
              {t(
                L(
                  "Tải ảnh lên và tự soạn lời thoại từng cảnh",
                  "Upload images and write each scene",
                ),
              )}
            </span>
          </span>
        </button>
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

            {creating === "link" ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted">
                  {t(L("Link sản phẩm", "Product link"))}
                </span>
                <input
                  required
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder="https://shopee.vn/..."
                  className="h-11 rounded-btn border border-line bg-canvas px-3.5 text-sm text-ink outline-none focus:border-brand/50"
                />
              </label>
            ) : null}

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

      {error ? (
        <p className="mt-4 rounded-card border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-ink">
          {error}
        </p>
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
                  "Bắt đầu bằng một trong hai lối vào phía trên.",
                  "Start with one of the two options above.",
                ),
              )}
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
  );
}
