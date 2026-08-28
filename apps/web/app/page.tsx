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

export default function LandingPage() {
  return (
    <>
      <GeminiCursor />
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
    </>
  );
}
