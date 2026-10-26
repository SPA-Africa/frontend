import type { Metadata } from 'next';
import { PublicPage } from '@/components/shell/SiteChrome';
import { CourseDetail } from '@/components/public/CourseCatalogue';

// Rendered on the client from the catalog service, so new and updated courses show without a rebuild.
export const metadata: Metadata = { title: 'Course' };

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <PublicPage>
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-12 md:py-16">
        <CourseDetail slug={slug} />
      </div>
    </PublicPage>
  );
}
