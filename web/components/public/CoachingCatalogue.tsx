'use client';

// Public coaching catalogue (FR-C2): how it works, topics with filters and a detail modal,
// and package cards. Everything comes from the capacity service.

import { useMemo, useState } from 'react';
import { ArrowRight, Check, Clock, Languages, MapPin, Search, Users } from 'lucide-react';
import { Badge, Button, EmptyState, Select } from '@/components/ui';
import { Modal, Tabs } from '@/components/ui/client';
import { Async, Skeleton } from '@/components/dash';
import { useOrgLabels } from '@/components/org/bits';
import { useApi } from '@/lib/api/hooks';
import { capacity } from '@/lib/api/services';
import type { CatalogueTopic } from '@/lib/types';
import { useT } from '@/lib/i18n';
import { cx, rwf } from '@/lib/format';

type Kind = 'all' | CatalogueTopic['kind'];
const kinds: Kind[] = ['all', 'Capacity Building', 'Leadership Training', 'Coaching'];
const modes = ['In-person', 'Virtual', 'Hybrid'] as const;

export function CoachingCatalogue() {
  const t = useT();
  const steps = [
    { title: t('org.coaching.step1'), text: t('org.coaching.step1Text') },
    { title: t('org.coaching.step2'), text: t('org.coaching.step2Text') },
    { title: t('org.coaching.step3'), text: t('org.coaching.step3Text') },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 md:px-12 md:py-20">
      <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-[clamp(34px,5vw,56px)] font-bold leading-[1.05]">{t('org.coaching.title')}</h1>
          <p className="mt-3 text-lg text-muted">{t('org.coaching.lead')}</p>
        </div>
        <Button href="/register/organisation" size="lg" className="self-start md:self-auto">{t('org.coaching.start')} <ArrowRight size={18} aria-hidden="true" /></Button>
      </div>

      <ol className="mb-16 grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-4 rounded-[var(--radius-card)] border border-line bg-bg p-6">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand font-display font-bold text-white">{i + 1}</span>
            <div>
              <h2 className="font-bold">{s.title}</h2>
              <p className="mt-1 text-[15px] text-muted">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <section aria-labelledby="topics" className="mb-20">
        <h2 id="topics" className="mb-6 text-3xl font-bold">{t('org.coaching.topics')}</h2>
        <Topics />
      </section>

      <section aria-labelledby="packages" className="mb-20">
        <h2 id="packages" className="mb-2 text-3xl font-bold">{t('org.coaching.packages')}</h2>
        <p className="mb-8 text-muted">{t('org.coaching.pricesNote')}</p>
        <Packages />
      </section>

      <section className="flex flex-col items-start gap-5 rounded-[var(--radius-card)] bg-brand p-8 text-white md:flex-row md:items-center md:justify-between md:p-12">
        <div className="max-w-xl">
          <h2 className="text-[clamp(26px,3vw,36px)] font-bold leading-tight">{t('org.coaching.ctaTitle')}</h2>
          <p className="mt-2 text-white/85">{t('org.coaching.ctaText')}</p>
        </div>
        <Button href="/register/organisation" variant="subtle" size="lg">{t('org.coaching.register')}</Button>
      </section>
    </div>
  );
}

function Topics() {
  const t = useT();
  const L = useOrgLabels();
  const all = useApi(() => capacity.listCatalogue(), []);
  const [kind, setKind] = useState<Kind>('all');
  const [mode, setMode] = useState('');
  const [lang, setLang] = useState('');
  const [open, setOpen] = useState<CatalogueTopic | null>(null);

  const topics = all.data ?? [];
  const languages = useMemo(() => [...new Set(topics.flatMap(x => x.languages))].sort(), [topics]);
  const list = topics.filter(x =>
    (kind === 'all' || x.kind === kind) &&
    (!mode || x.modes.includes(mode as CatalogueTopic['modes'][number])) &&
    (!lang || x.languages.includes(lang)));
  const reset = () => { setKind('all'); setMode(''); setLang(''); };

  return (
    <>
      <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs<Kind> value={kind} onChange={setKind}
          tabs={kinds.map(k => ({ id: k, label: k === 'all' ? t('ui.all') : L.kind(k), count: k === 'all' ? topics.length : topics.filter(x => x.kind === k).length }))} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="coach-mode" className="sr-only">{t('org.book.mode')}</label>
            <Select id="coach-mode" value={mode} onChange={e => setMode(e.target.value)} className="lg:w-44">
              <option value="">{t('org.coaching.anyMode')}</option>
              {modes.map(m => <option key={m} value={m}>{L.mode(m)}</option>)}
            </Select>
          </div>
          <div>
            <label htmlFor="coach-lang" className="sr-only">{t('org.coaching.language')}</label>
            <Select id="coach-lang" value={lang} onChange={e => setLang(e.target.value)} className="lg:w-44">
              <option value="">{t('org.coaching.anyLanguage')}</option>
              {languages.map(l => <option key={l}>{l}</option>)}
            </Select>
          </div>
        </div>
      </div>

      <Async state={all} skeleton={<div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-60 rounded-[var(--radius-card)]" />)}</div>}>
        {() => (
          <>
            <p className="sr-only" aria-live="polite">{t('org.coaching.shown', { n: list.length })}</p>
            {list.length ? (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {list.map(x => (
                  <button key={x.id} type="button" onClick={() => setOpen(x)} aria-haspopup="dialog"
                    className="group flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-bg p-6 text-left transition duration-300 hover:-translate-y-1 hover:border-brand/35">
                    <div className="mb-4 flex flex-wrap gap-2">
                      <Badge tone={x.kind === 'Coaching' ? 'gold' : 'brand'}>{L.kind(x.kind)}</Badge>
                      {!x.standalone && <Badge>{t('org.coaching.partOfPackage')}</Badge>}
                    </div>
                    <h3 className="text-xl font-bold leading-snug group-hover:text-brand">{x.title}</h3>
                    <p className="mt-2 flex-1 text-[15px] text-muted">{x.description}</p>
                    <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-4 text-sm text-muted">
                      <span className="inline-flex items-center gap-1.5"><Clock size={15} aria-hidden="true" />{x.duration}</span>
                      <span className="inline-flex items-center gap-1.5"><MapPin size={15} aria-hidden="true" />{x.modes.map(L.mode).join(', ')}</span>
                    </div>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">{t('org.coaching.details')} <ArrowRight size={15} aria-hidden="true" className="transition-transform group-hover:translate-x-1" /></span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState icon={<Search size={22} />} title={t('org.coaching.noMatch')} text={t('org.coaching.noMatchText')}
                action={<Button variant="ghost" onClick={reset}>{t('ui.clearFilters')}</Button>} />
            )}
          </>
        )}
      </Async>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.title ?? ''}
        footer={<><Button variant="ghost" onClick={() => setOpen(null)}>{t('ui.close')}</Button><Button href="/register/organisation">{t('org.coaching.bookTeam')}</Button></>}>
        {open && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap gap-2">
              <Badge tone={open.kind === 'Coaching' ? 'gold' : 'brand'}>{L.kind(open.kind)}</Badge>
              {open.standalone ? <Badge tone="ok">{t('org.coaching.standalone')}</Badge> : <Badge>{t('org.coaching.packageOnly')}</Badge>}
            </div>
            <p className="text-muted">{open.description}</p>
            <div>
              <h3 className="mb-3 font-bold">{t('org.coaching.outcomes')}</h3>
              <ul className="flex flex-col gap-2">
                {open.outcomes.map(o => <li key={o} className="flex gap-2.5"><Check size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-brand" />{o}</li>)}
              </ul>
            </div>
            <dl className="grid gap-4 rounded-2xl bg-surface p-5 sm:grid-cols-2">
              {[
                { icon: <Users size={16} />, k: t('org.coaching.audience'), v: open.audience },
                { icon: <Clock size={16} />, k: t('org.coaching.length'), v: open.duration },
                { icon: <MapPin size={16} />, k: t('org.book.mode'), v: open.modes.map(L.mode).join(', ') },
                { icon: <Languages size={16} />, k: t('org.coaching.languages'), v: open.languages.join(', ') },
              ].map(d => (
                <div key={d.k}>
                  <dt className="flex items-center gap-1.5 text-sm text-muted"><span aria-hidden="true" className="text-brand">{d.icon}</span>{d.k}</dt>
                  <dd className="mt-0.5 font-semibold">{d.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </Modal>
    </>
  );
}

function Packages() {
  const t = useT();
  const pkgs = useApi(() => capacity.listPackages(), []);
  const settings = useApi(() => capacity.getSettings(), []);
  const vat = settings.data ? Math.round(settings.data.vatRate * 100) : null;

  return (
    <Async state={pkgs} skeleton={<div className="grid gap-5 lg:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-96 rounded-[var(--radius-card)]" />)}</div>}>
      {list => (
        <div className="grid gap-5 lg:grid-cols-3">
          {list.map(p => {
            const featured = p.name === 'Advanced';
            return (
              <article key={p.id} className={cx('flex flex-col rounded-[var(--radius-card)] bg-bg p-7', featured ? 'border-2 border-brand' : 'border border-line')}>
                <h3 className="text-xl font-bold">{p.name}</h3>
                <p className="mt-4 font-display text-[34px] font-bold leading-none tracking-tight tabular-nums">{p.price === null ? t('org.pkg.quoted') : rwf(p.price)}</p>
                <p className="mt-2 text-sm text-muted">
                  {p.price === null ? t('org.pkg.quotedHint') : vat !== null ? t('org.pkg.perBookingVat', { pct: vat }) : t('org.pkg.perBooking')}
                </p>
                <dl className="mt-6 grid gap-2 border-t border-line pt-5 text-[15px]">
                  <div className="flex justify-between gap-4"><dt className="text-muted">{t('org.book.participants')}</dt><dd className="text-right font-semibold">{p.participants}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-muted">{t('org.coaching.length')}</dt><dd className="text-right font-semibold">{p.duration}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-muted">{t('org.book.sTopics')}</dt><dd className="text-right font-semibold">{p.maxTopics === null ? t('org.pkg.anyNumber') : p.maxTopics}</dd></div>
                  {p.supportHours > 0 && <div className="flex justify-between gap-4"><dt className="text-muted">{t('org.pkg.support')}</dt><dd className="text-right font-semibold">{t('org.pkg.hours', { n: p.supportHours })}</dd></div>}
                </dl>
                <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                  {p.includes.map(i => <li key={i} className="flex gap-2.5 text-[15px]"><Check size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-brand" />{i}</li>)}
                </ul>
                <Button href="/register/organisation" variant={featured ? 'primary' : 'ghost'} className="mt-7 w-full">
                  {p.price === null ? t('org.pkg.askQuote') : t('org.pkg.choose', { pkg: p.name })}
                </Button>
              </article>
            );
          })}
        </div>
      )}
    </Async>
  );
}
