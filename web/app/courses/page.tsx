import type { Metadata } from 'next';
import { PublicPage } from '@/components/shell/SiteChrome';
import { CourseCatalogue } from '@/components/public/CourseCatalogue';

export const metadata: Metadata = {
  title: 'Courses',
  description: 'Online courses in technology, education, leadership, young startups and agriculture.',
};

export default function CoursesPage() {
  return (
    <PublicPage>
      <div className="mx-auto max-w-6xl px-4 py-14 md:px-12 md:py-20">
        <CourseCatalogue />
      </div>
    </PublicPage>
  );
}
