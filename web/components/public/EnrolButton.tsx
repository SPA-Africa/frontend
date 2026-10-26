'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui';
import { useToast } from '@/components/ui/client';
import { errorMessage } from '@/lib/api/hooks';
import { lms } from '@/lib/api/services';
import { useSession } from '@/lib/session';
import { useT } from '@/lib/i18n';

/** Learners are enrolled straight away; everyone else is sent to sign up first and comes back here. */
export function EnrolButton({ courseId, slug, className }: { courseId: string; slug: string; className?: string }) {
  const t = useT();
  const { user } = useSession();
  const router = useRouter();
  const { toast, toastNode } = useToast();
  const [busy, setBusy] = useState(false);
  const target = `/app/learn/${slug}`;
  const learner = user?.role === 'beneficiary';

  const enrol = async () => {
    if (!learner) { router.push(`/register?next=${encodeURIComponent(`/courses/${slug}`)}`); return; }
    setBusy(true);
    try {
      await lms.enrol({ body: { courseId } });
      router.push(target);
    } catch (e) {
      toast(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="lg" onClick={enrol} disabled={busy} className={className}>
        {learner ? t('public.courses.start') : t('public.courses.enrol')} <ArrowRight size={18} aria-hidden="true" />
      </Button>
      {toastNode}
    </>
  );
}
