"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchCredentials,
  type CredentialStatusView,
} from "@/lib/admin/credentials-api";
import { CredentialCard } from "./credential-card";

/**
 * Danh sách credential của mọi nhà cung cấp.
 *
 * Danh sách do **máy chủ** khai, không phải hằng số phía client: thêm nhà cung cấp mới ở
 * registry của API là trang này tự có thẻ mới, không phải sửa hai nơi.
 */
export function CredentialsSection() {
  const [items, setItems] = useState<CredentialStatusView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await fetchCredentials());
      setError(null);
    } catch (cause) {
      setItems([]);
      setError(cause instanceof Error ? cause.message : "Không gọi được API");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (loading) {
    return <p className="text-sm text-muted">Đang đọc trạng thái credential...</p>;
  }

  // Lỗi đọc danh sách là **trạng thái của trang**, không phải một sự kiện: người dùng quay
  // lại sau mười phút vẫn cần biết vì sao không thấy thẻ nào.
  if (error) {
    return (
      <p role="alert" className="text-sm font-semibold text-danger">
        {error}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => (
        <CredentialCard
          key={item.provider}
          view={item}
          onChange={(next) =>
            setItems((current) =>
              current.map((entry) =>
                entry.provider === item.provider
                  ? // Gỡ credential thì giữ lại thẻ ở trạng thái chưa cấu hình, không làm
                    // biến mất cả nhà cung cấp khỏi danh sách.
                    (next ?? {
                      ...entry,
                      configured: false,
                      displayHint: null,
                      projectId: null,
                      clientEmailMasked: null,
                      privateKeyIdSuffix: null,
                      status: null,
                      latencyMs: null,
                      lastVerifiedAt: null,
                      keyVersion: null,
                    })
                  : entry,
              ),
            )
          }
        />
      ))}
    </div>
  );
}
