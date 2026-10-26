import type { Metadata } from 'next';
import { PublicPage } from '@/components/shell/SiteChrome';
import { CoachingCatalogue } from '@/components/public/CoachingCatalogue';

export const metadata: Metadata = {
  title: 'For organisations',
  description: 'Capacity building, leadership training and coaching for organisations.',
};

export default function CoachingPage() {
  return (
    <PublicPage>
      <CoachingCatalogue />
    </PublicPage>
  );
}
