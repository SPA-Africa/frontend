'use client';

// Book a training in five steps (FR-C4): topics, package, details, review with a server-priced
// estimate, confirmation. Recommendations from the needs assessment can be accepted or changed.

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock, Globe, Receipt, Sparkles, Users } from 'lucide-react';
import { Badge, Button, Field, Input, Select, Textarea } from '@/components/ui';
import { useToast } from '@/components/ui/client';
import { Async, ErrorState, PageHead, Panel, Skeleton, SkeletonPanel, StatusPill } from '@/components/dash';
import { ORG_TODAY, Stepper, useOrgLabels } from '@/components/org/bits';
import { errorMessage, useApi } from '@/lib/api/hooks';
import { assessment, capacity } from '@/lib/api/services';
import type { AssessmentResult } from '@/lib/api/services/ai/assessment';
import type { BookingRequest, CapacitySettings, CreateBookingResult, DeliveryMode, PackageView } from '@/lib/api/services/core/capacity';
import type { CatalogueTopic } from '@/lib/types';
import { useT } from '@/lib/i18n';
import { cx, date, rwf } from '@/lib/format';

const KINDS: CatalogueTopic['kind'][] = ['Capacity Building', 'Leadership Training', 'Coaching'];
const MODES: DeliveryMode[] = ['In-person', 'Virtual', 'Hybrid'];

export default function BookPage() {
  return <Suspense fallback={<SkeletonPanel rows={6} />}><Loader /></Suspense>;
}

function Loader() {
  const t = useT();
  const topics = useApi(() => capacity.listCatalogue(), []);
  const pkgs = useApi(() => capacity.listPackages(), []);
  const settings = useApi(() => capacity.getSettings(), []);
  const latest = useApi(() => assessment.latest(), []);
  const all = [topics, pkgs, settings, latest];
  const failed = all.find(s => s.error);
  const ready = topics.data && pkgs.data && settings.data && latest.data !== undefined;

  return (
    <>
      <PageHead title={t('nav.book')} />
      {failed ? <ErrorState error={failed.error} onRetry={failed.reload} />
        : ready ? <BookFlow topics={topics.data!} packages={pkgs.data!} settings={settings.data!} rec={latest.data ?? null} />
          : <SkeletonPanel rows={6} />}
    </>
  );
}

interface Draft extends Omit<BookingRequest, 'end' | 'notes' | 'overrideReason'> { end: string; notes: string; overrideReason: string }

function BookFlow({ topics, packages, settings, rec }: { topics: CatalogueTopic[]; packages: PackageView[]; settings: CapacitySettings; rec: AssessmentResult | null }) {
  const t = useT();
  const L = useOrgLabels();
  const params = useSearchParams();
  const { toast, toastNode } = useToast();
  const steps = [t('org.book.sTopics'), t('org.book.sPackage'), t('org.book.sDetails'), t('org.book.sReview'), t('org.book.sDone')];

  const topicById = (id: string) => topics.find(x => x.id === id);
  const recTopics = rec?.topics.map(x => x.id).filter(id => topicById(id)) ?? [];
  const recPackage = rec?.packageId;

  const [d, setD] = useState<Draft>(() => {
    const q = (params.get('topics') ?? '').split(',').filter(id => topicById(id));
    const qp = params.get('package');
    const topicIds = q.length ? q : [];
    const packageId = packages.some(p => p.id === qp) ? qp! : recPackage ?? (topicIds.length > 1 ? 'pkg-advanced' : 'pkg-standard');
    return { topicIds, packageId, start: '', end: '', participants: 20, mode: 'In-person', location: 'Kigali', notes: '', overrideReason: '' };
  });
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<CreateBookingResult | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(x => ({ ...x, [k]: v }));

  const pkg = packages.find(p => p.id === d.packageId) ?? packages[0];
  const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every(x => b.includes(x));
  const usingRec = !!rec && sameSet(d.topicIds, recTopics) && d.packageId === recPackage;
  const overriding = !!rec && !usingRec;
  const modes = useMemo(() => MODES.filter(m => d.topicIds.every(id => topicById(id)?.modes.includes(m))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d.topicIds]);

  const estimate = useApi(() => capacity.estimate({
    body: { topicIds: d.topicIds, packageId: d.packageId, mode: d.mode, location: d.mode === 'Virtual' ? 'Online' : d.location },
  }), [step, d.topicIds.join(','), d.packageId, d.mode, d.location], { enabled: step === 3 });

  const stepError = (): string | null => {
    if (step === 0 && !d.topicIds.length) return t('org.book.errTopics');
    if (step === 1 && pkg.maxTopics !== null && d.topicIds.length > pkg.maxTopics) return t('org.book.errTooMany', { pkg: pkg.name, n: pkg.maxTopics });
    if (step === 2) {
      if (!d.start) return t('org.book.errStart');
      if (d.start < ORG_TODAY()) return t('org.book.errPast');
      if (d.end && d.end < d.start) return t('org.book.errEnd');
      if (!d.participants || d.participants < 1) return t('org.book.errPeople');
      if (d.mode !== 'Virtual' && !d.location.trim()) return t('org.book.errLocation');
      if (!modes.includes(d.mode)) return t('org.book.errMode', { mode: L.mode(d.mode) });
    }
    return null;
  };
  const err = stepError();
  const go = (n: number) => { setStep(n); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const next = () => { if (err) { toast(err); return; } go(step + 1); };

  const confirm = async () => {
    setBusy(true);
    try {
      const r = await capacity.createBooking({
        body: {
          topicIds: d.topicIds, packageId: d.packageId, start: d.start, end: d.end || undefined, participants: d.participants,
          mode: d.mode, location: d.mode === 'Virtual' ? 'Online' : d.location, notes: d.notes || undefined,
          overrideReason: overriding ? d.overrideReason || undefined : undefined,
        },
      });
      setDone(r);
      go(4);
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleTopic = (id: string) => set('topicIds', d.topicIds.includes(id) ? d.topicIds.filter(x => x !== id) : [...d.topicIds, id]);
  const useRecommendation = () => { if (rec) setD(x => ({ ...x, topicIds: recTopics, packageId: rec.packageId, overrideReason: '' })); };

  return (
    <>
      <Stepper steps={steps} current={step} />

      {/* 1. topics */}
      {step === 0 && (
        <section className="fade-in space-y-6" aria-labelledby="s1">
          <h2 id="s1" className="sr-only">{steps[0]}</h2>
          {rec && (
            <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-bg p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted"><Sparkles size={15} className="text-gold" aria-hidden="true" /> {t('org.book.fromAssessment')}</div>
                <div className="mt-1 font-bold">{rec.topics.map(x => x.title).join(', ')}</div>
                <div className="text-sm text-muted">{t('org.book.pkgName', { pkg: rec.packageName })}</div>
              </div>
              {usingRec
                ? <Badge tone="ok" dot>{t('org.book.usingRec')}</Badge>
                : <Button size="sm" variant="ghost" onClick={useRecommendation}>{t('org.book.useRec')}</Button>}
            </div>
          )}
          {KINDS.map(kind => {
            const list = topics.filter(x => x.kind === kind);
            if (!list.length) return null;
            return (
              <div key={kind}>
                <h3 className="mb-3 text-sm font-semibold text-muted">{L.kind(kind)}</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {list.map(x => {
                    const on = d.topicIds.includes(x.id);
                    return (
                      <button key={x.id} type="button" aria-pressed={on} onClick={() => toggleTopic(x.id)}
                        className={cx('flex items-start gap-3 rounded-[var(--radius-card)] border bg-bg p-4 text-left transition',
                          on ? 'border-brand ring-4 ring-brand/10' : 'border-line hover:border-brand/30')}>
                        <span className={cx('mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border transition', on ? 'border-brand bg-brand text-white' : 'border-line')}>
                          {on && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-bold">{x.title}</span>
                            {recTopics.includes(x.id) && <Badge tone="gold">{t('org.book.recommended')}</Badge>}
                          </span>
                          <span className="mt-1 block text-sm text-muted">{x.description}</span>
                          <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-subtle">
                            <span className="inline-flex items-center gap-1"><Clock size={12} aria-hidden="true" />{x.duration}</span>
                            <span className="inline-flex items-center gap-1"><Users size={12} aria-hidden="true" />{x.audience}</span>
                            <span className="inline-flex items-center gap-1"><Globe size={12} aria-hidden="true" />{x.languages.join(', ')}</span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* 2. package */}
      {step === 1 && (
        <section className="fade-in" aria-labelledby="s2">
          <h2 id="s2" className="mb-4 text-lg font-bold">{t('org.book.topicsChosen', { n: d.topicIds.length })}</h2>
          <div className="grid gap-4 lg:grid-cols-3" role="radiogroup" aria-label={steps[1]}>
            {packages.map(p => {
              const on = d.packageId === p.id;
              const fits = p.maxTopics === null || d.topicIds.length <= p.maxTopics;
              return (
                <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => set('packageId', p.id)}
                  className={cx('flex flex-col rounded-[var(--radius-card)] border bg-bg p-5 text-left transition',
                    on ? 'border-brand ring-4 ring-brand/10' : 'border-line hover:border-brand/30')}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-xl font-bold">{p.name}</span>
                    {recPackage === p.id && <Badge tone="gold">{t('org.book.recommended')}</Badge>}
                  </div>
                  <div className="mt-3 font-display text-2xl font-bold tabular-nums">{p.price === null ? t('org.pkg.quoted') : rwf(p.price)}</div>
                  <div className="text-sm text-muted">{p.price === null ? t('org.pkg.quotedHint') : t('org.pkg.plusVat', { pct: Math.round(settings.vatRate * 100) })}</div>
                  <ul className="mt-4 space-y-1.5 text-sm">
                    <li className="text-muted">{p.participants} · {p.duration}</li>
                    <li className="text-muted">{p.maxTopics === null ? t('org.pkg.anyTopics') : t('org.pkg.maxTopics', { n: p.maxTopics })}</li>
                    {p.includes.map(i => <li key={i} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-ok" aria-hidden="true" />{i}</li>)}
                  </ul>
                  {!fits && <p className="mt-4 text-sm font-semibold text-brand">{t('org.book.fewerTopics')}</p>}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. details */}
      {step === 2 && (
        <Panel className="fade-in max-w-3xl" title={t('org.book.sDetails')}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('org.book.start')} htmlFor="start"><Input id="start" type="date" min={ORG_TODAY()} value={d.start} onChange={e => set('start', e.target.value)} /></Field>
            <Field label={t('org.book.end')} htmlFor="end" optional hint={t('org.book.endHint')}><Input id="end" type="date" min={d.start || ORG_TODAY()} value={d.end} onChange={e => set('end', e.target.value)} /></Field>
            <Field label={t('org.book.participants')} htmlFor="ppl" hint={pkg.participants}>
              <Input id="ppl" type="number" inputMode="numeric" min={1} value={d.participants || ''} onChange={e => set('participants', Number(e.target.value))} />
            </Field>
            <Field label={t('org.book.mode')} htmlFor="mode">
              <Select id="mode" value={d.mode} onChange={e => set('mode', e.target.value as DeliveryMode)}>
                {MODES.map(m => <option key={m} value={m} disabled={!modes.includes(m)}>{L.mode(m)}{!modes.includes(m) ? ` (${t('org.book.notAvailable')})` : ''}</option>)}
              </Select>
            </Field>
            {d.mode !== 'Virtual' && (
              <div className="sm:col-span-2">
                <Field label={t('org.book.location')} htmlFor="loc"
                  hint={t('org.book.locationHint', { fee: rwf(settings.travelFee.amount), places: settings.travelFee.exemptLocations.filter(x => x !== 'Online').join(', ') })}>
                  <Input id="loc" value={d.location} onChange={e => set('location', e.target.value)} placeholder={t('org.book.locationPh')} />
                </Field>
              </div>
            )}
            <div className="sm:col-span-2">
              <Field label={t('org.book.notes')} htmlFor="notes" optional>
                <Textarea id="notes" value={d.notes} onChange={e => set('notes', e.target.value)} placeholder={t('org.book.notesPh')} />
              </Field>
            </div>
            {overriding && (
              <div className="rounded-2xl bg-surface p-4 sm:col-span-2">
                <Field label={t('org.book.reason')} htmlFor="reason" optional hint={t('org.book.reasonHint')}>
                  <Textarea id="reason" className="min-h-20 bg-bg" value={d.overrideReason} onChange={e => set('overrideReason', e.target.value)} />
                </Field>
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* 4. review */}
      {step === 3 && (
        <section className="fade-in grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]" aria-label={steps[3]}>
          <Panel title={steps[3]}>
            <dl className="divide-y divide-line">
              {([
                [t('org.book.sTopics'), d.topicIds.map(id => topicById(id)?.title).join(', '), 0],
                [t('org.book.sPackage'), pkg.name, 1],
                [t('org.book.dates'), d.end && d.end !== d.start ? `${date(d.start)} ${t('org.to')} ${date(d.end)}` : date(d.start), 2],
                [t('org.book.participants'), String(d.participants), 2],
                [t('org.book.mode'), d.mode === 'Virtual' ? L.mode(d.mode) : `${L.mode(d.mode)}, ${d.location}`, 2],
                ...(d.notes ? [[t('org.book.notes'), d.notes, 2] as const] : []),
                ...(overriding ? [[t('org.book.reasonShort'), d.overrideReason || t('org.book.noReason'), 2] as const] : []),
              ] as const).map(([k, v, s]) => (
                <div key={k} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-6">
                  <dt className="w-40 shrink-0 text-sm text-muted">{k}</dt>
                  <dd className="min-w-0 flex-1 break-words font-semibold">{v}</dd>
                  <button type="button" className="self-start text-sm font-semibold text-brand hover:underline" onClick={() => go(s)}>{t('ui.edit')}</button>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel title={t('org.book.estimate')} className="self-start">
            <Async state={estimate} skeleton={<div className="space-y-3"><Skeleton className="h-5" /><Skeleton className="h-5" /><Skeleton className="h-8" /></div>}>
              {est => est.quoted ? (
                <p className="text-muted">{t('org.book.quoteText')}</p>
              ) : (
                <>
                  <ul className="space-y-3 text-sm">
                    {est.lines.map(l => (
                      <li key={l.description} className="flex justify-between gap-4"><span className="text-muted">{l.description}</span><span className="shrink-0 font-semibold tabular-nums">{rwf(l.unitPrice * l.qty)}</span></li>
                    ))}
                  </ul>
                  <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
                    <div className="flex justify-between"><dt className="text-muted">{t('org.inv.subtotal')}</dt><dd className="tabular-nums">{rwf(est.subtotal)}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted">{t('org.inv.vat', { pct: Math.round(est.vatRate * 100) })}</dt><dd className="tabular-nums">{rwf(est.tax)}</dd></div>
                    <div className="flex items-baseline justify-between pt-2"><dt className="font-bold">{t('org.inv.total')}</dt><dd className="font-display text-2xl font-bold tabular-nums">{rwf(est.total)}</dd></div>
                  </dl>
                  <p className="mt-4 text-sm text-muted">{t('org.book.invoiceNote')}</p>
                </>
              )}
            </Async>
          </Panel>
        </section>
      )}

      {/* 5. confirmation */}
      {step === 4 && done && (
        <Panel className="fade-in mx-auto max-w-xl text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-ok-light text-ok dark:bg-ok/25"><CheckCircle2 size={28} aria-hidden="true" /></span>
          <h2 className="mt-4 text-2xl font-bold">{t('org.book.doneTitle')}</h2>
          <p className="mt-2 text-muted">{t('org.book.doneText')}</p>
          <dl className="mt-6 space-y-3 rounded-2xl bg-surface p-5 text-left text-sm">
            <div className="flex justify-between gap-4"><dt className="text-muted">{t('org.book.reference')}</dt><dd className="font-mono font-bold">{done.booking.id.toUpperCase()}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">{t('ui.status')}</dt><dd><StatusPill status={done.booking.status} /></dd></div>
            {done.invoice ? (
              <div className="flex justify-between gap-4"><dt className="text-muted">{t('org.book.invoiceIssued')}</dt><dd className="font-semibold">{done.invoice.number} · {rwf(done.invoice.totals.total)}</dd></div>
            ) : (
              <div className="flex justify-between gap-4"><dt className="text-muted">{t('org.book.pricing')}</dt><dd className="font-semibold">{t('org.book.quoteComing')}</dd></div>
            )}
          </dl>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {done.invoice && <Button href={`/org/invoices/${done.invoice.id}`}><Receipt size={18} aria-hidden="true" /> {t('org.book.viewInvoice')}</Button>}
            <Button href="/org/bookings" variant="ghost">{t('org.book.seeBookings')}</Button>
          </div>
        </Panel>
      )}

      {step < 4 && (
        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === 0}><ArrowLeft size={18} aria-hidden="true" /> {t('ui.back')}</Button>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            {step < 3
              ? <Button onClick={next} aria-disabled={!!err}>{t('org.book.continue')} <ArrowRight size={18} aria-hidden="true" /></Button>
              : <Button onClick={confirm} disabled={busy || !!estimate.error || estimate.loading}><Check size={18} aria-hidden="true" /> {busy ? t('org.book.sending') : estimate.data?.quoted ? t('org.book.requestQuote') : t('org.book.confirm')}</Button>}
            {step > 0 && step < 3 && err && <p className="text-sm text-muted" aria-live="polite">{err}</p>}
          </div>
        </div>
      )}
      {toastNode}
    </>
  );
}
