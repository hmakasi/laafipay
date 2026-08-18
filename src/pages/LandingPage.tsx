import { LandingHeader } from '@/pages/landing/LandingHeader';
import { HeroSection } from '@/pages/landing/HeroSection';
import { FeaturesSection } from '@/pages/landing/FeaturesSection';
import { HowItWorksSection } from '@/pages/landing/HowItWorksSection';
import { PricingSection } from '@/pages/landing/PricingSection';
import { AboutSection } from '@/pages/landing/AboutSection';
import { ContactSection } from '@/pages/landing/ContactSection';
import { LandingFooter } from '@/pages/landing/LandingFooter';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <PricingSection />
        <AboutSection />
        <ContactSection />
      </main>
      <LandingFooter />
    </div>
  );
}
