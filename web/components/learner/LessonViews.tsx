'use client';

// Lesson bodies for the course player. Content comes from lms.getLessonContent.

import { useEffect, useRef, useState } from 'react';
import { Download, FileText, Pause, Play, RotateCcw, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { Async, Skeleton } from '@/components/dash';
import { API_MODE } from '@/lib/api/config';
import { useApi } from '@/lib/api/hooks';
import { lms } from '@/lib/api/services';
import type { LessonContent } from '@/lib/api/services/core/lms';
import { useT } from '@/lib/i18n';
import { cx } from '@/lib/format';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
type Quality = '360p' | '480p' | '720p';

export function LessonBody({ courseId, lessonId, dataSaver, resumeAt, onToast }: {
  courseId: string; lessonId: string; dataSaver: boolean; resumeAt?: number; onToast: (m: string) => void;
}) {
  const content = useApi(() => lms.getLessonContent({ params: { courseId, lessonId } }), [courseId, lessonId]);
  return (
    <Async state={content} skeleton={<Skeleton className="aspect-video w-full rounded-[var(--radius-card)]" />}>
      {c => c.type === 'video' ? <VideoLesson courseId={courseId} content={c} dataSaver={dataSaver} resumeAt={resumeAt} />
        : c.type === 'reading' ? <ReadingLesson content={c} />
        : c.type === 'pdf' ? <PdfLesson content={c} onToast={onToast} />
        : null}
    </Async>
  );
}

/* ---------- video (FR-A2.5 resume, NFR-BW.3 quality) ---------- */
function VideoLesson({ courseId, content, dataSaver, resumeAt }: {
  courseId: string; content: Extract<LessonContent, { type: 'video' }>; dataSaver: boolean; resumeAt?: number;
}) {
  const t = useT();
  const duration = content.durationSec;
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [quality, setQuality] = useState<Quality>(dataSaver ? '360p' : '480p');
  const [resumeShown, setResumeShown] = useState(!!resumeAt && resumeAt > 5 && resumeAt < duration);
  const lastSaved = useRef(0);

  const save = (seconds: number) => {
    lastSaved.current = seconds;
    lms.saveVideoPosition({ params: { courseId, lessonId: content.lessonId }, body: { seconds } }).catch(() => {});
  };

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setPos(v => Math.min(duration, v + 1)), 1000);
    return () => clearInterval(id);
  }, [playing, duration]);
  useEffect(() => {
    if (pos >= duration) setPlaying(false);
    if (playing && pos - lastSaved.current >= 15) save(pos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);

  const play = (from?: number) => { if (from !== undefined) setPos(from); setResumeShown(false); setPlaying(true); };
  const pause = () => { setPlaying(false); save(pos); };
  const source = content.sources.find(s => s.quality === quality);

  return (
    <div>
      <div className="relative aspect-video overflow-hidden rounded-[var(--radius-card)] bg-ink text-bg dark:bg-surface-2 dark:text-ink">
        <div className="absolute inset-0 grid place-items-center">
          <button type="button" onClick={() => (playing ? pause() : play())} aria-label={playing ? t('learner.player.pause') : t('learner.player.play')}
            className="grid size-16 place-items-center rounded-full bg-brand text-white shadow-lg transition hover:scale-105 hover:bg-brand-dark sm:size-20">
            {playing ? <Pause size={30} /> : <Play size={30} className="translate-x-0.5" />}
          </button>
        </div>
        {resumeShown && resumeAt && (
          <button type="button" onClick={() => play(resumeAt)}
            className="fade-in absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-bg px-3.5 py-2 text-sm font-semibold text-ink shadow-md">
            <RotateCcw size={15} className="text-brand" /> {t('learner.player.resumeFrom', { time: fmt(resumeAt) })}
          </button>
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 px-4 pb-3 pt-6">
          <span className="text-xs font-semibold tabular-nums opacity-90">{fmt(pos)}</span>
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-current/25" role="progressbar" aria-label={t('learner.player.position')}
            aria-valuemin={0} aria-valuemax={duration} aria-valuenow={pos} aria-valuetext={fmt(pos)}>
            <div className="absolute inset-y-0 left-0 rounded-full bg-brand transition-[width]" style={{ width: `${(pos / duration) * 100}%` }} />
          </div>
          <span className="text-xs font-semibold tabular-nums opacity-90">{fmt(duration)}</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-muted">{dataSaver ? t('learner.player.dataSaverOn') : t('learner.player.size', { mb: source?.sizeMb ?? 0 })}</span>
        <div className="inline-flex items-center gap-2 font-semibold">
          <Settings2 size={16} className="text-brand" />
          <span id="quality-label">{t('learner.player.quality')}</span>
          <span className="inline-flex rounded-full bg-surface p-1" role="radiogroup" aria-labelledby="quality-label">
            {content.sources.map(s => (
              <button key={s.quality} type="button" role="radio" aria-checked={quality === s.quality} onClick={() => setQuality(s.quality)}
                className={cx('h-7 rounded-full px-3 text-xs font-semibold transition', quality === s.quality ? 'bg-bg text-ink shadow-sm' : 'text-muted hover:text-ink')}>{s.quality}</button>
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------- reading ---------- */
function ReadingLesson({ content }: { content: Extract<LessonContent, { type: 'reading' }> }) {
  return (
    <article className="max-w-prose space-y-6 text-[17px] leading-relaxed">
      <p className="text-lg text-muted">{content.intro}</p>
      {content.sections.map(s => (
        <section key={s.heading}>
          <h3 className="mb-2 text-xl font-bold">{s.heading}</h3>
          {s.body && <p>{s.body}</p>}
          {s.list && (
            <ul className="mt-2 space-y-2">
              {s.list.map(item => <li key={item} className="flex gap-3"><span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-gold" />{item}</li>)}
            </ul>
          )}
        </section>
      ))}
    </article>
  );
}

/* ---------- pdf ---------- */
function PdfLesson({ content, onToast }: { content: Extract<LessonContent, { type: 'pdf' }>; onToast: (m: string) => void }) {
  const t = useT();
  const download = () => {
    if (API_MODE === 'live') window.open(content.downloadUrl, '_blank', 'noopener');
    else onToast(t('learner.player.downloadStarted'));
  };
  return (
    <div className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-bg p-6 sm:flex-row sm:items-center">
      <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-brand-light text-brand dark:bg-brand/15"><FileText size={30} /></span>
      <div className="min-w-0 flex-1">
        <div className="break-all font-bold">{content.fileName}</div>
        <div className="text-sm text-muted">PDF · {content.sizeMb} MB · {t('learner.player.pages', { n: content.pages })}</div>
      </div>
      <Button onClick={download} className="self-start sm:self-center"><Download size={18} /> {t('ui.download')}</Button>
    </div>
  );
}
