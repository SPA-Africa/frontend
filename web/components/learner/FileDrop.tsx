'use client';

// Pitch document upload with the pre-signed flow (SRS FR-A3.3 to FR-A3.6):
// 1. check type and size on the device, 2. ask the API for an upload URL, 3. upload straight to storage
// with progress, 4. confirm, 5. poll the virus scan until it is clean.

import { useEffect, useId, useRef, useState } from 'react';
import { FileUp, Loader2, ShieldAlert, ShieldCheck, Trash2, UploadCloud } from 'lucide-react';
import { errorMessage } from '@/lib/api/hooks';
import { pitch } from '@/lib/api/services';
import type { PitchFile, PitchFileKind, PitchRules } from '@/lib/api/services/core/pitch';
import { useT } from '@/lib/i18n';
import { cx } from '@/lib/format';

export function FileDrop({ entryId, kind, rule, value, onChange, onRemove, disabled }: {
  entryId: string;
  kind: PitchFileKind;
  rule: PitchRules['files'][PitchFileKind];
  value?: PitchFile;
  onChange: (f: PitchFile) => void;
  onRemove: () => Promise<void>;
  disabled?: boolean;
}) {
  const t = useT();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upload, setUpload] = useState<{ name: string; share: number } | null>(null);
  const [removing, setRemoving] = useState(false);
  const label = t(`learner.pitch.file.${kind}`);
  const types = rule.exts.map(e => e.toUpperCase()).join(t('learner.pitch.or'));

  // poll the scan while it is pending
  const latest = useRef(onChange);
  latest.current = onChange;
  useEffect(() => {
    if (value?.scan !== 'pending' || !value.uploadId) return;
    const timer = setInterval(async () => {
      try {
        const f = await pitch.getUpload({ params: { id: entryId, uploadId: value.uploadId! } });
        if (f.scan !== 'pending') latest.current(f);
      } catch {}
    }, 1500);
    return () => clearInterval(timer);
  }, [entryId, value?.scan, value?.uploadId]);

  const accept = async (file: File | undefined) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!rule.exts.includes(ext)) { setError(t('learner.pitch.wrongType', { types })); return; }
    if (file.size > rule.maxMb * 1024 * 1024) { setError(t('learner.pitch.tooLarge', { size: (file.size / 1024 / 1024).toFixed(1), max: rule.maxMb })); return; }
    setError(null);
    setUpload({ name: file.name, share: 0 });
    try {
      const ticket = await pitch.requestUpload({ params: { id: entryId }, body: { kind, fileName: file.name, sizeBytes: file.size, contentType: file.type } });
      await pitch.uploadFile(ticket, file, share => setUpload({ name: file.name, share }));
      onChange(await pitch.completeUpload({ params: { id: entryId, uploadId: ticket.uploadId } }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUpload(null);
    }
  };

  const remove = async () => {
    setRemoving(true);
    try { await onRemove(); } catch (e) { setError(errorMessage(e)); } finally { setRemoving(false); }
  };

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold">{label}</label>
        <span className="text-xs text-subtle">{t('learner.pitch.limit', { types, max: rule.maxMb })}</span>
      </div>
      {upload ? (
        <div className="rounded-2xl border border-line p-4" aria-live="polite">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-brand"><Loader2 size={18} className="animate-spin" /></span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{upload.name}</div>
              <div className="text-sm text-muted">{t('learner.pitch.uploading', { pct: Math.round(upload.share * 100) })}</div>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={t('learner.pitch.uploadProgress')}
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(upload.share * 100)}>
            <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${upload.share * 100}%` }} />
          </div>
        </div>
      ) : value ? (
        <div className="flex items-center gap-3 rounded-2xl border border-line p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-brand"><FileUp size={18} /></span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{value.name}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm" aria-live="polite">
              <span className="text-muted">{value.sizeMb} MB</span>
              {value.scan === 'pending' && <span className="inline-flex items-center gap-1 text-muted"><Loader2 size={14} className="animate-spin text-gold" /> {t('learner.pitch.scanPending')}</span>}
              {value.scan === 'clean' && <span className="inline-flex items-center gap-1 text-ok"><ShieldCheck size={14} /> {t('learner.pitch.scanClean')}</span>}
              {value.scan === 'infected' && <span className="inline-flex items-center gap-1 text-brand"><ShieldAlert size={14} /> {t('learner.pitch.scanInfected')}</span>}
            </div>
          </div>
          {!disabled && (
            <button type="button" onClick={remove} disabled={removing} aria-label={t('learner.pitch.removeFile', { name: value.name })}
              className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface hover:text-brand disabled:opacity-40">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); if (!disabled) setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={e => { e.preventDefault(); setOver(false); if (!disabled) accept(e.dataTransfer.files[0]); }}
          className={cx('flex flex-col items-center rounded-2xl border-2 border-dashed px-4 py-7 text-center transition',
            over ? 'border-brand bg-brand-light/40 dark:bg-brand/10' : 'border-line', disabled && 'opacity-50')}>
          <UploadCloud size={26} className="text-brand" />
          <p className="mt-2 text-[15px]">
            {t('learner.pitch.dragHere')}{' '}
            <button type="button" disabled={disabled} onClick={() => input.current?.click()} className="font-semibold text-brand underline-offset-4 hover:underline">{t('learner.pitch.chooseFile')}</button>
          </p>
        </div>
      )}
      <input id={id} ref={input} type="file" className="sr-only" accept={rule.exts.map(e => '.' + e).join(',')} disabled={disabled || !!upload}
        onChange={e => { accept(e.target.files?.[0]); e.target.value = ''; }} />
      {error && <p className="mt-1.5 text-sm text-brand" role="alert">{error}</p>}
    </div>
  );
}
