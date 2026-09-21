/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Các mục menu cũ đã gộp lại (AI, Landing Page, khoá nhà cung cấp, thiết bị đăng nhập). Giữ redirect để link cũ, bookmark và ảnh chụp
   * màn hình trong tài liệu không dẫn tới trang trắng.
   */
  async redirects() {
    return [
      { source: "/admin/script-models", destination: "/admin/ai?tab=script", permanent: false },
      { source: "/admin/voice-models", destination: "/admin/ai?tab=voice", permanent: false },
      { source: "/admin/video-models", destination: "/admin/ai?tab=video", permanent: false },
      { source: "/admin/orchestrator", destination: "/admin/ai", permanent: false },
      { source: "/admin/api-keys", destination: "/admin/ai?tab=keys", permanent: false },
      { source: "/admin/landing-cms", destination: "/admin/landing", permanent: false },
      { source: "/admin/landing-content", destination: "/admin/landing?tab=content", permanent: false },
      { source: "/admin/landing-theme", destination: "/admin/landing?tab=theme", permanent: false },
      { source: "/admin/landing-voice", destination: "/admin/landing?tab=voice", permanent: false },
      { source: "/admin/landing-showcase", destination: "/admin/landing?tab=showcase", permanent: false },
      { source: "/admin/sessions", destination: "/admin/users?tab=devices", permanent: false },
    ];
  },
};

export default nextConfig;
