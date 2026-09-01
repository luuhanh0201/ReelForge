import { loadLandingConfig } from "@/lib/landing-config";
import { LandingConfigProvider } from "@/lib/landing-config-provider";
import { AuthModal } from "@/components/auth/auth-modal";
import { GeminiCursor } from "@/components/effects/gemini-cursor";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { FaqSection } from "@/components/sections/faq-section";
import { FeaturesSection } from "@/components/sections/features-section";
import { FinalCtaSection } from "@/components/sections/final-cta-section";
import { HeroSection } from "@/components/sections/hero-section";
import { PricingSection } from "@/components/sections/pricing-section";
import { SandboxSection } from "@/components/sections/sandbox-section";
import { VoicesSection } from "@/components/sections/voices-section";

export default async function LandingPage() {
  // API hỏng thì trả null và toàn trang chạy bằng nội dung tĩnh — trang bán hàng
  // không được phụ thuộc sống còn vào admin API.
  const config = await loadLandingConfig();

  return (
    <LandingConfigProvider config={config}>
      {/* Màu chủ đạo do CMS quyết định, ghi đè token ở phạm vi landing. */}
      <div
        style={
          config
            ? ({
                "--color-brand": config.theme.brandHex,
                "--spotlight-color": config.theme.brandHex,
              } as React.CSSProperties)
            : undefined
        }
      >
        {config?.theme.spotlightCursor === false ? null : <GeminiCursor />}
        <SiteHeader />
        <main>
          <HeroSection />
          <SandboxSection />
          <FeaturesSection />
          <VoicesSection />
          <PricingSection />
          <FaqSection />
          <FinalCtaSection />
        </main>
        <SiteFooter />
        <AuthModal />
      </div>
    </LandingConfigProvider>
  );
}
