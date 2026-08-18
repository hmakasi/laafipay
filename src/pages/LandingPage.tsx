import { LandingHeader } from '@/pages/landing/LandingHeader';
import { HeroSection } from '@/pages/landing/HeroSection';
import { FeaturesSection } from '@/pages/landing/FeaturesSection';
import { HowItWorksSection } from '@/pages/landing/HowItWorksSection';
import { ValuePropsSection } from '@/pages/landing/ValuePropsSection';
import { PricingSection } from '@/pages/landing/PricingSection';
import { AboutContactSection } from '@/pages/landing/AboutContactSection';
import { LandingFooter } from '@/pages/landing/LandingFooter';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <ValuePropsSection />
        <PricingSection />
        <AboutContactSection />
      </main>
      <LandingFooter />
    </div>
  );
}
