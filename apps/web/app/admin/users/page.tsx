"use client";

import { Coins, Download, Lock, Pencil, Search, UserPlus, Unlock } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ADMIN_USERS,
  PLAN_LABEL,
  ROLE_LABEL,
  type AdminUser,
  type UserPlan,
  type UserRole,
} from "@/config/admin/accounts.config";
import { usePagination } from "@/lib/admin/pagination";
import {
  AdminButton,
  AdminCard,
  AdminInput,
  AdminPageHeader,
  AdminSelect,
  DataTable,
  Pill,
  StatusBadge,
  TableCell,
  TablePagination,
  TableRow,
} from "@/components/admin/primitives";
import { AdminModal } from "@/components/admin/admin-modal";
import { useToast } from "@/components/admin/toast";

type PlanFilter = UserPlan | "all";
type StatusFilter = "all" | "active" | "suspended";

const PLAN_OPTIONS: { id: PlanFilter; label: string }[] = [
  { id: "all", label: "Tất cả gói" },
  { id: "starter", label: "Starter" },
  { id: "creator-pro", label: "Creator Pro" },
  { id: "agency", label: "Agency" },
];

const STATUS_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Mọi trạng thái" },
  { id: "active", label: "Hoạt động" },
  { id: "suspended", label: "Bị khóa" },
];

const ROLE_OPTIONS: { id: UserRole; label: string }[] = [
  { id: "admin", label: "Admin" },
  { id: "editor", label: "Editor" },
  { id: "viewer", label: "Viewer" },
];

const PLAN_ACCENT = { starter: "info", "creator-pro": "brand", agency: "voice" } as const;

const downloadFile = (filename: string, content: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export default function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[]>(ADMIN_USERS);
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState<PlanFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [creditTarget, setCreditTarget] = useState<AdminUser | null>(null);
  const [creditAmount, setCreditAmount] = useState("10");
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [editRole, setEditRole] = useState<UserRole>("editor");
  const [lockTarget, setLockTarget] = useState<AdminUser | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "" });

  const filtered = useMemo(
    () =>
      users.filter((user) => {
        const keyword = query.trim().toLowerCase();
        const matchQuery =
          keyword === "" ||
          user.name.toLowerCase().includes(keyword) ||
          user.email.toLowerCase().includes(keyword) ||
          user.id.toLowerCase().includes(keyword);

        return (
          matchQuery &&
          (plan === "all" || user.plan === plan) &&
          (status === "all" || user.status === status)
        );
      }),
    [users, query, plan, status],
  );

  const pagination = usePagination(filtered);

  const applyCredits = (delta: number) => {
    if (!creditTarget) return;
    const amount = Number(creditAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast("Số credits phải là số dương", "warning");
      return;
    }

    setUsers((current) =>
      current.map((user) =>
        user.id === creditTarget.id
          ? { ...user, credits: Math.max(0, user.credits + delta * amount) }
          : user,
      ),
    );
    toast(
      `${delta > 0 ? "Đã cộng" : "Đã trừ"} ${amount} credits cho ${creditTarget.name}`,
      delta > 0 ? "success" : "warning",
    );
    setCreditTarget(null);
  };

  const saveRole = () => {
    if (!editTarget) return;
    setUsers((current) =>
      current.map((user) =>
        user.id === editTarget.id ? { ...user, role: editRole } : user,
      ),
    );
    toast(`${editTarget.name} giờ có quyền ${ROLE_LABEL[editRole]}`);
    setEditTarget(null);
  };

  const toggleLock = () => {
    if (!lockTarget) return;
    const nextStatus = lockTarget.status === "active" ? "suspended" : "active";

    setUsers((current) =>
      current.map((user) =>
        user.id === lockTarget.id ? { ...user, status: nextStatus } : user,
      ),
    );
    toast(
      `${nextStatus === "suspended" ? "Đã khóa" : "Đã mở khóa"} tài khoản ${lockTarget.name}`,
      nextStatus === "suspended" ? "warning" : "success",
    );
    setLockTarget(null);
  };

  const addUser = () => {
    if (!newUser.email.includes("@") || newUser.name.trim() === "") {
      toast("Cần nhập đủ họ tên và email hợp lệ", "warning");
      return;
    }

    const created: AdminUser = {
      id: `u-${1053 + users.length}`,
      name: newUser.name.trim(),
      email: newUser.email.trim(),
      plan: "starter",
      role: "viewer",
      status: "active",
      credits: 10,
      creditQuota: 10,
      projects: 0,
      joinedAt: new Date().toISOString().slice(0, 10),
    };

    setUsers((current) => [created, ...current]);
    setNewUser({ name: "", email: "" });
    setAddOpen(false);
    toast(`Đã tạo tài khoản ${created.name} với 10 credits`);
  };

  const exportCsv = () => {
    const header = "ID,Họ tên,Email,Gói,Quyền,Trạng thái,Credits,Dự án,Ngày tham gia";
    const rows = filtered.map((user) =>
      [
        user.id,
        user.name,
        user.email,
        PLAN_LABEL[user.plan],
        ROLE_LABEL[user.role],
        user.status === "active" ? "Hoạt động" : "Bị khóa",
        user.credits,
        user.projects,
        user.joinedAt,
      ].join(","),
    );

    downloadFile("reelforge-users.csv", [header, ...rows].join("\n"), "text/csv;charset=utf-8");
    toast(`Đã xuất ${filtered.length} dòng ra CSV`);
  };

  return (
    <>
      <AdminPageHeader
        title="Quản trị người dùng"
        description="Danh sách KOC, Creator và doanh nghiệp đang dùng ReelForge."
        actions={
          <>
            <AdminButton onClick={exportCsv}>
              <Download size={14} />
              Xuất danh sách
            </AdminButton>
            <AdminButton variant="primary" onClick={() => setAddOpen(true)}>
              <UserPlus size={14} />
              Thêm người dùng
            </AdminButton>
          </>
        }
      />

      <AdminCard padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <AdminInput
            ariaLabel="Tìm theo tên, email hoặc ID"
            value={query}
            onChange={setQuery}
            placeholder="Tìm tên, email, ID tài khoản..."
            icon={<Search size={15} className="shrink-0 text-muted" />}
            className="w-full sm:w-72"
          />
          <AdminSelect ariaLabel="Lọc theo gói" value={plan} onChange={setPlan} options={PLAN_OPTIONS} />
          <AdminSelect
            ariaLabel="Lọc theo trạng thái"
            value={status}
            onChange={setStatus}
            options={STATUS_OPTIONS}
          />
          <p className="ml-auto text-xs text-muted">
            {filtered.length}/{users.length} tài khoản
          </p>
        </div>

        <DataTable
          headers={["Người dùng", "Gói & quyền", "Credits", "Dự án", "Tham gia", "Thao tác"]}
          isEmpty={filtered.length === 0}
        >
          {pagination.items.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-[#10151e]">
                    {user.name.charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                  </div>
                </div>
              </TableCell>

              <TableCell>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill accent={PLAN_ACCENT[user.plan]}>{PLAN_LABEL[user.plan]}</Pill>
                  <span className="text-xs text-muted">{ROLE_LABEL[user.role]}</span>
                </div>
                <StatusBadge
                  className="mt-1.5"
                  status={user.status === "active" ? "up" : "down"}
                  label={user.status === "active" ? "Hoạt động" : "Bị khóa"}
                />
              </TableCell>

              <TableCell className="w-40">
                <p className="font-mono text-sm font-bold text-ink">
                  {user.credits}
                  <span className="text-xs font-medium text-muted">/{user.creditQuota}</span>
                </p>
                <div className="mt-1.5 h-1.5 w-28 overflow-hidden rounded-full bg-subtle">
                  <div
                    className={`h-full rounded-full ${user.credits === 0 ? "bg-danger" : "bg-mint"}`}
                    style={{
                      width: `${Math.min(100, Math.round((user.credits / user.creditQuota) * 100))}%`,
                    }}
                  />
                </div>
              </TableCell>

              <TableCell className="font-mono text-sm">{user.projects}</TableCell>

              <TableCell className="whitespace-nowrap font-mono text-xs text-muted">
                {user.joinedAt}
              </TableCell>

              <TableCell>
                <div className="flex items-center gap-1">
                  <AdminButton
                    variant="ghost"
                    className="w-9 px-0"
                    onClick={() => {
                      setCreditTarget(user);
                      setCreditAmount("10");
                    }}
                  >
                    <Coins size={15} />
                  </AdminButton>
                  <AdminButton
                    variant="ghost"
                    className="w-9 px-0"
                    onClick={() => {
                      setEditTarget(user);
                      setEditRole(user.role);
                    }}
                  >
                    <Pencil size={15} />
                  </AdminButton>
                  <AdminButton
                    variant="ghost"
                    className="w-9 px-0"
                    onClick={() => setLockTarget(user)}
                  >
                    {user.status === "active" ? <Lock size={15} /> : <Unlock size={15} />}
                  </AdminButton>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </DataTable>

        <TablePagination pagination={pagination} unit="người dùng" />
      </AdminCard>

      <AdminModal
        open={creditTarget !== null}
        onClose={() => setCreditTarget(null)}
        title={`Điều chỉnh credits · ${creditTarget?.name ?? ""}`}
        description={`Số dư hiện tại: ${creditTarget?.credits ?? 0} credits.`}
        footer={
          <>
            <AdminButton variant="danger" onClick={() => applyCredits(-1)}>
              Trừ bớt
            </AdminButton>
            <AdminButton variant="primary" onClick={() => applyCredits(1)}>
              Nạp thêm
            </AdminButton>
          </>
        }
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">Số credits</span>
          <AdminInput ariaLabel="Số credits" value={creditAmount} onChange={setCreditAmount} />
        </label>
      </AdminModal>

      <AdminModal
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title={`Phân quyền · ${editTarget?.name ?? ""}`}
        description="Quyền áp dụng ngay sau khi lưu."
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setEditTarget(null)}>
              Huỷ
            </AdminButton>
            <AdminButton variant="primary" onClick={saveRole}>
              Lưu
            </AdminButton>
          </>
        }
      >
        <AdminSelect
          ariaLabel="Chọn quyền"
          value={editRole}
          onChange={setEditRole}
          options={ROLE_OPTIONS}
          className="w-full"
        />
      </AdminModal>

      <AdminModal
        open={lockTarget !== null}
        onClose={() => setLockTarget(null)}
        title={lockTarget?.status === "active" ? "Khóa tài khoản?" : "Mở khóa tài khoản?"}
        description={
          lockTarget?.status === "active"
            ? `${lockTarget?.name} sẽ không thể đăng nhập và mọi job đang chạy sẽ bị dừng.`
            : `${lockTarget?.name} sẽ đăng nhập và dùng credits trở lại bình thường.`
        }
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setLockTarget(null)}>
              Huỷ
            </AdminButton>
            <AdminButton
              variant={lockTarget?.status === "active" ? "danger" : "primary"}
              onClick={toggleLock}
            >
              Xác nhận
            </AdminButton>
          </>
        }
      >
        <p className="text-sm text-muted">
          Hành động này được ghi vào nhật ký kiểm toán ở mức{" "}
          <span className="font-bold text-danger">CRITICAL</span>.
        </p>
      </AdminModal>

      <AdminModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Thêm người dùng thủ công"
        description="Tài khoản mới mặc định gói Starter, quyền Viewer và được tặng 10 credits."
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setAddOpen(false)}>
              Huỷ
            </AdminButton>
            <AdminButton variant="primary" onClick={addUser}>
              Tạo tài khoản
            </AdminButton>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted">Họ tên</span>
            <AdminInput
              ariaLabel="Họ tên"
              value={newUser.name}
              onChange={(value) => setNewUser((current) => ({ ...current, name: value }))}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted">Email</span>
            <AdminInput
              ariaLabel="Email"
              value={newUser.email}
              onChange={(value) => setNewUser((current) => ({ ...current, email: value }))}
            />
          </label>
        </div>
      </AdminModal>
    </>
  );
}
