'use client';

import { useParams } from 'next/navigation';
import { CourseEditor } from '@/components/internal/CourseEditor';

export default function EditCourse() {
  const { id } = useParams<{ id: string }>();
  return <CourseEditor key={id} courseId={id} />;
}
