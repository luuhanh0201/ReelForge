import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppProvider } from "@/lib/app-provider";
import { SITE, STORAGE_KEYS } from "@/config/site.config";

/**
 * Be Vietnam Pro self-host: file woff2 nằm trong repo (app/fonts), đã subset
 * latin + latin-ext + vietnamese. Không gọi ra Google Fonts ở build lẫn runtime.
 */
const beVietnamPro = localFont({
  src: [
    { path: "./fonts/BeVietnamPro-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/BeVietnamPro-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/BeVietnamPro-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/BeVietnamPro-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-body",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: `${SITE.brand} — Biến Sản Phẩm Thành Video Bán Hàng Trong 30 Giây`,
  description:
    "ReelForge tự động phân tích link Shopee, TikTok Shop, Lazada rồi dựng video ngắn có phụ đề và giọng đọc AI, xuất 1080p không watermark.",
};

export const viewport: Viewport = {
  themeColor: "#10151e",
};

/** Đặt theme trước khi paint để tránh nháy màu khi tải trang. */
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('${STORAGE_KEYS.theme}');
    var theme = stored === 'light' || stored === 'dark' ? stored : 'dark';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  } catch (error) {
    document.documentElement.classList.add('dark');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${beVietnamPro.variable} font-sans`}>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
