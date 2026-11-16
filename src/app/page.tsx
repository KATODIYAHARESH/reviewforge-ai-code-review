import { LandingHero } from "@/components/landing-hero";
import { HowItWorks, SiteFooter } from "@/components/site-footer";
import { ReviewWorkspace } from "@/components/review-workspace";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <LandingHero />
      <main className="flex-1 pt-4">
        <ReviewWorkspace />
      </main>
      <HowItWorks />
      <SiteFooter />
    </div>
  );
}
