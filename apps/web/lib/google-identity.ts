/** Client id của OAuth client dạng Web application. */
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

const GIS_SRC = "https://accounts.google.com/gsi/client";

interface CodeClient {
  requestCode: () => void;
}

interface CodeResponse {
  code?: string;
  error?: string;
}

interface GoogleIdentity {
  accounts: {
    oauth2: {
      initCodeClient: (config: {
        client_id: string;
        scope: string;
        ux_mode: "popup";
        callback: (response: CodeResponse) => void;
        error_callback?: (error: { type?: string }) => void;
      }) => CodeClient;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

let scriptPromise: Promise<GoogleIdentity> | null = null;

/** Nạp script Google Identity Services đúng một lần cho cả phiên làm việc. */
const loadGoogleIdentity = (): Promise<GoogleIdentity> => {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve(window.google);
  }

  scriptPromise ??= new Promise<GoogleIdentity>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SRC}"]`,
    );

    const handleLoad = () => {
      if (window.google?.accounts?.oauth2) {
        resolve(window.google);
      } else {
        reject(new Error("Không nạp được thư viện đăng nhập của Google"));
      }
    };

    if (existing) {
      existing.addEventListener("load", handleLoad, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Không tải được thư viện Google")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Không tải được thư viện Google")),
      { once: true },
    );
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    // Cho phép thử lại sau khi mạng ổn định thay vì kẹt mãi ở promise hỏng.
    scriptPromise = null;
    throw error;
  });

  return scriptPromise;
};

/**
 * Mở popup Google và trả về authorization code.
 *
 * Dùng luồng code + popup thay vì One Tap để giữ đúng trải nghiệm "một chạm" của
 * AuthModal: người dùng không rời trang, và `code` chỉ đổi được thành token ở backend —
 * nơi giữ client secret.
 */
export const requestGoogleAuthCode = (): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!GOOGLE_CLIENT_ID) {
      reject(
        new Error(
          "Thiếu NEXT_PUBLIC_GOOGLE_CLIENT_ID — chưa cấu hình đăng nhập Google",
        ),
      );
      return;
    }

    loadGoogleIdentity()
      .then((google) => {
        const client = google.accounts.oauth2.initCodeClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: "openid email profile",
          ux_mode: "popup",
          callback: (response) => {
            if (response.code) {
              resolve(response.code);
            } else {
              // Người dùng tự đóng popup cũng rơi vào đây — không phải lỗi hệ thống.
              reject(new Error(response.error ?? "Đăng nhập Google đã bị huỷ"));
            }
          },
          error_callback: (error) => {
            reject(
              new Error(
                error.type === "popup_failed_to_open"
                  ? "Trình duyệt đã chặn cửa sổ đăng nhập Google, hãy cho phép popup rồi thử lại"
                  : "Đăng nhập Google đã bị huỷ",
              ),
            );
          },
        });

        client.requestCode();
      })
      .catch(reject);
  });
