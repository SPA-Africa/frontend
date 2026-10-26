import { PublicPage } from '@/components/shell/SiteChrome';
import { Hero } from '@/components/landing/Hero';
import { About, PillarBand } from '@/components/landing/About';
import { Values } from '@/components/landing/Values';
import { Pillars } from '@/components/landing/Pillars';
import { Goals } from '@/components/landing/Goals';
import { Timeline } from '@/components/landing/Timeline';
import { BenefitLoop } from '@/components/landing/BenefitLoop';
import { GetInvolved, Partners } from '@/components/landing/Involved';

export default function Home() {
  return (
    <PublicPage>
      <div className="overflow-x-clip">
        <Hero />
        <PillarBand />
        <About />
        <Values />
        <Pillars />
        <Goals />
        <Timeline />
        <BenefitLoop />
        <Partners />
        <GetInvolved />
      </div>
    </PublicPage>
  );
}
