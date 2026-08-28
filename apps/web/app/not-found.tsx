import type { Metadata } from "next";
import { AuthModal } from "@/components/auth/auth-modal";
import { NotFoundScreen } from "@/components/layout/not-found-screen";

export const metadata: Metadata = {
  title: "404 — Không tìm thấy trang | ReelForge",
};

/** Hiển thị khi URL không khớp route nào hoặc khi gọi notFound(). */
export default function NotFound() {
  return (
    <>
      <NotFoundScreen />
      <AuthModal />
    </>
  );
}
