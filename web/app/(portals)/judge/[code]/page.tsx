'use client';

// Blind grading terminal: anonymised summary and documents, weighted rubric, required comment,
// conflict-of-interest recusal, submit with confirm, then the other judges' average (FR-B2.5).
// Documents open in an in-page viewer showing the anonymised copy only (FR-B2.2, NFR-SEC.9).

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Clock, ExternalLink, EyeOff, FileText, FileX, Presentation, RefreshCw, ShieldAlert, Users } from 'lucide-react';
import { Badge, Button, buttonClass, Checkbox, Field, Select, Textarea } from '@/components/ui';
import { Modal, useToast } from '@/components/ui/client';
import { Async, PageHead, Panel, Skeleton, SkeletonPanel, StatusPill } from '@/components/dash';
import { ConfirmDialog, FormError } from '@/components/console/ConsoleKit';
import { ApiError } from '@/lib/api/http';
import { errorMessage, useApi } from '@/lib/api/hooks';
import { judging } from '@/lib/api/services';
import type { DocumentLink, EntryDocument, GradingEntry, MyScore, RecusalReason } from '@/lib/api/services/core/judging';
import { useT } from '@/lib/i18n';
import type { RubricCriterion } from '@/lib/types';
import { cx, date, usd, dateLocale, fmtDate } from '@/lib/format';

const REASONS: RecusalReason[] = ['knows_team', 'financial_interest', 'advised_team', 'other'];

export default function GradingTerminal() {
  const t = useT();
  const { code } = useParams<{ code: string }>();
  const entry = useApi(() => judging.getEntry({ params: { code } }), [code]);

  return (
    <>
      <Link href="/judge" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={16} aria-hidden /> {t('judge.queue.title')}
      </Link>
      <Async state={entry} skeleton={<div className="space-y-6"><Skeleton className="h-10 w-64" /><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"><SkeletonPanel rows={6} /><SkeletonPanel rows={4} /></div></div>}>
        {e => <Terminal key={e.code} entry={e} />}
      </Async>
    </>
  );
}

function Terminal({ entry }: { entry: GradingEntry }) {
  const t = useT();
  const router = useRouter();
  const rubric = useApi(() => judging.getRubric({ params: { cycleId: entry.cycle.id } }), [entry.cycle.id]);
  const [mine, setMine] = useState<MyScore | undefined>(entry.submitted);
  const [scores, setScores] = useState<Record<string, number>>(entry.submitted?.scores ?? entry.draft?.scores ?? {});
  const [comment, setComment] = useState(entry.submitted?.comment ?? entry.draft?.comment ?? '');
  const [draftAt, setDraftAt] = useState(entry.draft?.savedAt);
  const [confirm, setConfirm] = useState(false);
  const [coi, setCoi] = useState(false);
  const [reason, setReason] = useState<RecusalReason | ''>('');
  const [details, setDetails] = useState('');
  const [coiOk, setCoiOk] = useState(false);
  const [docs, setDocs] = useState<EntryDocument[]>(entry.documents);
  const [checking, setChecking] = useState(false);
  /** the document viewer: `frame` is the first link (the iframe keeps it), `link` the freshest one */
  const [viewer, setViewer] = useState<{ d: EntryDocument; frame?: string; link?: DocumentLink; error?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast, toastNode } = useToast();

  const submitted = !!mine;
  const peers = useApi(() => judging.getPeerAverage({ params: { code: entry.code } }), [entry.code, submitted], { enabled: submitted });

  const criteria: RubricCriterion[] = rubric.data ?? [];
  const scored = criteria.filter(r => scores[r.id] !== undefined).length;
  const total = criteria.reduce((s, r) => s + (scores[r.id] ?? 0) * r.weight, 0);
  const len = comment.trim().length;
  const ready = criteria.length > 0 && scored === criteria.length && len >= judging.MIN_COMMENT;

  useEffect(() => { setError(null); }, [scores, comment]);

  const saveDraft = async () => {
    setBusy(true);
    try {
      const d = await judging.saveDraft({ params: { code: entry.code }, body: { scores, comment } });
      setDraftAt(d.savedAt);
      toast(t('judge.draftSaved'));
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const out = await judging.submitScore({ params: { code: entry.code }, body: { scores, comment } });
      setMine(out);
      setConfirm(false);
      toast(t('judge.queue.submittedToast', { code: entry.code }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { setError(errorMessage(e)); setConfirm(false); } finally { setBusy(false); }
  };

  const recuse = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      await judging.recuse({ params: { code: entry.code }, body: { reason, details: details.trim() || undefined, confirmed: coiOk } });
      router.push(`/judge?recused=${encodeURIComponent(entry.code)}`);
    } catch (e) { setError(errorMessage(e)); setBusy(false); }
  };

  const refreshDocs = useCallback(async (quiet = false) => {
    setChecking(true);
    try { setDocs((await judging.getEntry({ params: { code: entry.code } })).documents); }
    catch (e) { if (!quiet) toast(errorMessage(e)); }
    finally { setChecking(false); }
  }, [entry.code, toast]);

  // Anonymised copies are prepared in the background after submission: look again every 30 seconds
  const preparing = docs.some(d => d.status === 'pending');
  useEffect(() => {
    if (!preparing) return;
    const id = setTimeout(() => { refreshDocs(true); }, 30_000);
    return () => clearTimeout(id);
  }, [preparing, docs, refreshDocs]);

  const openDoc = async (d: EntryDocument) => {
    setViewer({ d });
    try {
      const link = await judging.getDocumentLink({ params: { code: entry.code, kind: d.kind } });
      setViewer(v => (v?.d.kind === d.kind ? { d, frame: link.url, link } : v));
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      const status = code === 'redaction_pending' ? 'pending' as const : code === 'redaction_unavailable' ? 'unavailable' as const : null;
      const error = status === 'pending' ? t('ai.docs.errorPending') : status === 'unavailable' ? t('ai.docs.errorUnavailable') : errorMessage(e);
      setViewer(v => (v?.d.kind === d.kind ? { d, error } : v));
      if (status) setDocs(list => list.map(x => (x.kind === d.kind ? { ...x, status } : x)));
    }
  };

  // Links expire after 5 minutes: renew the "new tab" link shortly before, the open viewer keeps working
  const viewerKind = viewer?.d.kind;
  const linkExpiresAt = viewer?.link?.expiresAt;
  useEffect(() => {
    if (!viewerKind || !linkExpiresAt) return;
    const id = setTimeout(async () => {
      try {
        const link = await judging.getDocumentLink({ params: { code: entry.code, kind: viewerKind } });
        setViewer(v => (v?.d.kind === viewerKind && v.link ? { ...v, link } : v));
      } catch {}
    }, Math.max(5_000, Date.parse(linkExpiresAt) - Date.now() - 20_000));
    return () => clearTimeout(id);
  }, [viewerKind, linkExpiresAt, entry.code]);

  return (
    <>
      <PageHead title={entry.code}
        meta={<><StatusPill status={submitted ? 'submitted' : draftAt ? 'in_progress' : 'pending'} /><span>{entry.cycle.name} · {entry.sector}</span></>}
        actions={!submitted && <Button variant="danger" onClick={() => setCoi(true)}><ShieldAlert size={17} /> {t('judge.coi.declare')}</Button>} />

      <p role="note" className="mb-6 flex items-center gap-2 text-sm text-muted">
        <EyeOff size={16} className="shrink-0" aria-hidden /> {t('judge.blindNote')}
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title={t('judge.summary')}>
            <p className="text-[15px] leading-relaxed">{entry.summary}</p>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-xl bg-surface p-3"><dt className="text-muted">{t('console.comp.sector')}</dt><dd className="font-semibold">{entry.sector}</dd></div>
              <div className="rounded-xl bg-surface p-3"><dt className="text-muted">{t('judge.funding')}</dt><dd className="font-display text-lg font-bold tabular-nums">{usd(entry.fundingRequested)}</dd></div>
              <div className="col-span-2 rounded-xl bg-surface p-3 sm:col-span-1"><dt className="text-muted">{t('judge.region')}</dt><dd className="font-semibold">{entry.cycle.region}</dd></div>
            </dl>
          </Panel>

          <Panel title={t('judge.documents')}>
            {docs.length === 0 ? (
              <p className="flex items-start gap-2 text-sm text-muted"><FileX size={16} className="mt-0.5 shrink-0" aria-hidden /> {t('ai.docs.none')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {docs.map(d => {
                  const Icon = d.kind === 'pitch_deck' ? Presentation : FileText;
                  return (
                    <li key={d.kind} className="flex items-center gap-3 rounded-xl border border-line p-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-muted"><Icon size={18} aria-hidden /></span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{t(`judge.doc.${d.kind}`)}</div>
                        <div className="truncate font-mono text-xs text-muted">{d.name} · {d.sizeMb.toFixed(1)} MB</div>
                      </div>
                      {d.scan !== 'clean' ? <Badge tone="gold">{t('judge.scanPending')}</Badge>
                        : d.status === 'ready' ? <Button variant="ghost" size="sm" onClick={() => openDoc(d)}>{t('judge.view')}<span className="sr-only">: {t(`judge.doc.${d.kind}`)}</span></Button>
                        : d.status === 'pending' ? <Badge tone="gold" dot>{t('ai.docs.pending')}</Badge>
                        : <Badge>{t('ai.docs.unavailable')}</Badge>}
                    </li>
                  );
                })}
              </ul>
            )}
            {preparing && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-surface p-3 text-sm">
                <Clock size={16} className="shrink-0 text-muted" aria-hidden />
                <span className="min-w-0 flex-1 text-muted">{t('ai.docs.pendingNote')}</span>
                <Button variant="ghost" size="sm" className="bg-bg" disabled={checking} onClick={() => refreshDocs()}>
                  <RefreshCw size={15} className={cx(checking && 'animate-spin')} aria-hidden /> {t('ai.docs.checkAgain')}
                </Button>
              </div>
            )}
            {docs.some(d => d.status === 'unavailable') && <p className="mt-3 text-sm text-muted">{t('ai.docs.unavailableNote')}</p>}
          </Panel>

          <Panel title={t('judge.rubric')} action={<span className="text-sm text-muted">{t('judge.scale')}</span>}>
            <Async state={rubric} skeleton={<div className="space-y-5">{[0, 1, 2].map(i => <Skeleton key={i} className="h-16" />)}</div>}>
              {list => (
                <div className="flex flex-col gap-7">
                  {list.map(r => (
                    <fieldset key={r.id} disabled={submitted}>
                      <legend className="w-full">
                        <span className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-bold">{r.label}</span>
                          <span className="text-sm text-muted tabular-nums">{t('judge.weight', { pct: Math.round(r.weight * 100) })}</span>
                        </span>
                        <span className="mt-0.5 block text-sm text-muted">{r.hint}</span>
                      </legend>
                      <div className="mt-3 grid grid-cols-5 gap-1.5 sm:grid-cols-10">
                        {Array.from({ length: judging.SCORE_MAX }, (_, i) => i + 1).map(n => {
                          const on = scores[r.id] === n;
                          return (
                            <label key={n} className={cx('relative grid h-10 cursor-pointer place-items-center rounded-xl border text-sm font-bold tabular-nums transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand',
                              on ? 'border-brand bg-brand text-white' : 'border-line hover:bg-surface', submitted && 'cursor-default opacity-80')}>
                              <input type="radio" className="sr-only" name={`score-${r.id}`} value={n} checked={on}
                                onChange={() => setScores(s => ({ ...s, [r.id]: n }))} aria-label={`${r.label}: ${n} / 10`} />
                              {n}
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  ))}
                </div>
              )}
            </Async>
          </Panel>

          <Panel>
            <Field label={t('judge.comment')} htmlFor="comment" hint={t('judge.commentHint')}>
              <Textarea id="comment" value={comment} onChange={e => setComment(e.target.value)} disabled={submitted} aria-describedby="comment-count" className="min-h-36" />
            </Field>
            <p id="comment-count" aria-live="polite" className={cx('mt-2 text-sm font-semibold tabular-nums', len >= judging.MIN_COMMENT ? 'text-ok' : 'text-muted')}>
              {len >= judging.MIN_COMMENT ? t('judge.commentOk', { n: len }) : t('judge.commentMore', { n: len, more: judging.MIN_COMMENT - len })}
            </p>
          </Panel>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <Panel>
            <div className="text-sm text-muted">{t('judge.yourScore')}</div>
            <div className="mt-1 font-display text-5xl font-extrabold tabular-nums" aria-live="polite">{(mine?.weighted ?? total).toFixed(1)}<span className="text-xl text-muted"> / 10</span></div>
            <div className="mt-1 text-sm text-muted">{t('judge.criteriaScored', { n: scored, total: criteria.length })}</div>
            <ul className="mt-5 flex flex-col gap-2 text-sm">
              {criteria.map(r => (
                <li key={r.id} className="flex justify-between gap-3">
                  <span className="text-muted">{r.label}</span>
                  {scores[r.id] === undefined ? <span className="text-subtle">{t('judge.notScored')}</span> : <span className="font-semibold tabular-nums">{scores[r.id]}</span>}
                </li>
              ))}
            </ul>

            {submitted ? (
              <div className="mt-6 rounded-2xl bg-ok-light p-4 text-ink dark:bg-ok/20">
                <div className="flex items-center gap-2 font-bold"><CheckCircle2 size={18} className="text-ok" aria-hidden /> {t('judge.submittedTitle')}</div>
                <p className="mt-1 text-sm">{t('judge.locked', { date: date(mine!.submittedAt.slice(0, 10)) })}</p>
                <Button href="/judge" variant="ghost" size="sm" className="mt-3 bg-bg">{t('judge.backToQueue')}</Button>
              </div>
            ) : (
              <div className="mt-6 flex flex-col gap-2">
                <FormError message={error} />
                <Button disabled={!ready || busy} onClick={() => setConfirm(true)}>{t('judge.submit')}</Button>
                <Button variant="ghost" disabled={busy} onClick={saveDraft}>{t('judge.saveDraft')}</Button>
                <p className="text-center text-xs text-muted">
                  {!ready ? t('judge.readyHint', { n: judging.MIN_COMMENT }) : draftAt ? t('judge.draftAt', { date: date(draftAt.slice(0, 10)) }) : ''}
                </p>
              </div>
            )}
          </Panel>

          <Panel>
            <div className="flex items-center gap-2 text-sm font-semibold"><Users size={16} aria-hidden /> {t('judge.peers')}</div>
            {!submitted ? <p className="mt-1 text-sm text-muted">{t('judge.peersHidden')}</p> : (
              <Async state={peers} skeleton={<Skeleton className="mt-2 h-8 w-24" />}>
                {p => (
                  <div className="mt-2">
                    <span className="font-display text-3xl font-bold tabular-nums">{p.average.toFixed(1)}</span>
                    <span className="ml-2 text-sm text-muted">{t('judge.peersCount', { n: p.judges })}</span>
                  </div>
                )}
              </Async>
            )}
          </Panel>
        </aside>
      </div>

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} busy={busy} title={t('judge.confirmTitle')} confirmLabel={t('judge.submit')} onConfirm={submit}>
        {t('judge.confirmBody', { score: total.toFixed(1), code: entry.code })}
      </ConfirmDialog>

      <Modal open={coi} onClose={() => setCoi(false)} title={t('judge.coi.title')}
        footer={<>
          <Button variant="ghost" onClick={() => setCoi(false)} disabled={busy}>{t('ui.cancel')}</Button>
          <Button variant="danger" disabled={!reason || !coiOk || (reason === 'other' && !details.trim()) || busy} onClick={recuse}>{t('judge.coi.recuse')}</Button>
        </>}>
        <p className="mb-5 text-muted">{t('judge.coi.body')}</p>
        <div className="flex flex-col gap-5">
          <Field label={t('judge.coi.reason')} htmlFor="coi-reason">
            <Select id="coi-reason" value={reason} onChange={e => setReason(e.target.value as RecusalReason)}>
              <option value="">{t('judge.coi.choose')}</option>
              {REASONS.map(r => <option key={r} value={r}>{t(`judge.coi.${r}`)}</option>)}
            </Select>
          </Field>
          {reason === 'other' && (
            <Field label={t('judge.coi.details')} htmlFor="coi-details">
              <Textarea id="coi-details" value={details} maxLength={500} onChange={e => setDetails(e.target.value)} className="min-h-20" />
            </Field>
          )}
          <Checkbox label={t('judge.coi.confirm')} checked={coiOk} onChange={e => setCoiOk(e.target.checked)} />
          <FormError message={coi ? error : null} />
        </div>
      </Modal>

      <Modal wide open={!!viewer} onClose={() => setViewer(null)} title={viewer ? t(`judge.doc.${viewer.d.kind}`) : ''}>
        {viewer && (
          <div className="flex flex-col gap-4">
            <p className="flex items-start gap-2 text-sm text-muted"><EyeOff size={16} className="mt-0.5 shrink-0" aria-hidden /> {t('ai.docs.notice')}</p>
            {viewer.error ? (
              <div role="alert" className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-line bg-surface p-8 text-center">
                <div>
                  <FileX size={32} className="mx-auto text-subtle" aria-hidden />
                  <div className="mt-3 font-mono text-sm font-semibold">{viewer.d.name}</div>
                  <p className="mt-2 max-w-sm text-sm text-muted">{viewer.error}</p>
                </div>
              </div>
            ) : viewer.frame ? (
              <iframe src={viewer.frame} title={t('ai.docs.frameTitle', { kind: t(`judge.doc.${viewer.d.kind}`), code: entry.code })}
                className="h-[65vh] w-full rounded-2xl border border-line bg-surface" />
            ) : (
              <Skeleton className="h-[65vh] w-full rounded-2xl" />
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="truncate font-mono text-xs text-muted">{viewer.d.name}</span>
              {viewer.link && (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{t('judge.linkExpires', { time: fmtDate(new Date(viewer.link.expiresAt), { hour: '2-digit', minute: '2-digit' }) })}</Badge>
                  <a href={viewer.link.url} target="_blank" rel="noopener noreferrer" className={buttonClass('ghost', 'sm')}>
                    <ExternalLink size={15} aria-hidden /> {t('ai.docs.openTab')}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
      {toastNode}
    </>
  );
}
