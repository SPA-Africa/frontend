'use client';

// Profile and settings: details, pillars, language, data saver, consent and data rights.

import { useEffect, useState } from 'react';
import { Check, Download, ShieldCheck, Trash2 } from 'lucide-react';
import { Avatar, Badge, Button, Checkbox, Field, Input, Select, Textarea } from '@/components/ui';
import { Modal, useToast } from '@/components/ui/client';
import { PageHead, Panel, Skeleton, ErrorState, pillarIcon } from '@/components/dash';
import { Switch } from '@/components/learner/bits';
import { errorMessage, useApi } from '@/lib/api/hooks';
import { profile } from '@/lib/api/services';
import type { Language, LearnerConsents, LearnerProfile, ProfileUpdate } from '@/lib/api/services/core/profile';
import { useI18n } from '@/lib/i18n';
import type { PillarId } from '@/lib/types';
import { cx, date } from '@/lib/format';

const PILLARS: PillarId[] = ['technology', 'education', 'leadership', 'young_startups', 'agriculture'];
const LANGS: { id: Language; native: string }[] = [{ id: 'en', native: 'English' }, { id: 'fr', native: 'Français' }, { id: 'rw', native: 'Ikinyarwanda' }];
const COUNTRIES = ['Rwanda', 'Burundi', 'DR Congo', 'Kenya', 'Uganda', 'Tanzania', 'Other'];
const CONSENTS: (keyof LearnerConsents)[] = ['dataProcessing', 'aiRecommendations', 'emailUpdates', 'smsUpdates', 'analytics', 'shareWithPartners', 'showInPublicResults'];

type Details = Required<Pick<ProfileUpdate, 'name' | 'email' | 'phone' | 'country' | 'city' | 'bio' | 'gender' | 'pillars'>>;
const detailsOf = (p: LearnerProfile): Details => ({ name: p.name, email: p.email, phone: p.phone, country: p.country, city: p.city, bio: p.bio, gender: p.gender, pillars: p.pillars });

export default function ProfilePage() {
  const { t, setLocale } = useI18n();
  const me = useApi(() => profile.get(), []);
  const { toast, toastNode } = useToast();
  const [f, setF] = useState<Details | null>(null);
  const [saving, setSaving] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [delConfirm, setDelConfirm] = useState('');
  const [delReason, setDelReason] = useState('');
  const [delAck, setDelAck] = useState(false);

  useEffect(() => { if (me.data && !f) setF(detailsOf(me.data)); }, [me.data, f]);

  if (me.error) return <><PageHead title={t('nav.profile')} /><ErrorState error={me.error} onRetry={me.reload} /></>;
  if (!me.data || !f) {
    return (
      <>
        <PageHead title={t('nav.profile')} />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"><Skeleton className="h-[560px] rounded-[var(--radius-card)]" /><Skeleton className="h-80 rounded-[var(--radius-card)]" /></div>
      </>
    );
  }

  const p = me.data;
  const dirty = JSON.stringify(f) !== JSON.stringify(detailsOf(p));
  const set = <K extends keyof Details>(k: K, v: Details[K]) => setF(x => x && { ...x, [k]: v });
  const togglePillar = (id: PillarId) => set('pillars', f.pillars.includes(id) ? f.pillars.filter(x => x !== id) : [...f.pillars, id]);

  const run = async <R,>(fn: () => Promise<R>, ok: string, after?: (r: R) => void) => {
    try { const r = await fn(); after?.(r); toast(ok); return true; } catch (e) { toast(errorMessage(e)); return false; }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) { toast(t('learner.profile.nameRequired')); return; }
    setSaving(true);
    await run(() => profile.update({ body: f }), t('learner.profile.saved'), next => { me.setData(next); setF(detailsOf(next)); });
    setSaving(false);
  };
  const instant = (body: ProfileUpdate, ok: string) => run(() => profile.update({ body }), ok, next => me.setData(d => d && { ...d, ...pick(next, body) }));
  const pick = (next: LearnerProfile, body: ProfileUpdate) => Object.fromEntries(Object.keys(body).map(k => [k, next[k as keyof LearnerProfile]])) as Partial<LearnerProfile>;
  const setLanguage = async (l: Language) => {
    if (await instant({ language: l }, t('learner.profile.languageSet', { lang: LANGS.find(x => x.id === l)!.native }))) setLocale(l);
  };
  const setConsent = (k: keyof LearnerConsents, v: boolean) =>
    run(() => profile.updateConsents({ body: { [k]: v } }), t('learner.profile.prefSaved'), consents => me.setData(d => d && { ...d, consents }));

  const requestDeletion = async () => {
    const ok = await run(() => profile.requestDeletion({ body: { reason: delReason || undefined } }), t('learner.profile.delReceived'),
      req => me.setData(d => d && { ...d, deletionRequest: req }));
    if (ok) { setDelOpen(false); setDelConfirm(''); setDelReason(''); setDelAck(false); }
  };

  return (
    <>
      <PageHead title={t('nav.profile')} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Panel>
            <form onSubmit={save}>
              <div className="mb-6 flex items-center gap-4">
                <Avatar name={f.name || '?'} size={56} />
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold">{f.name}</h2>
                  <p className="truncate text-sm text-muted">{f.email}</p>
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t('learner.profile.name')} htmlFor="name"><Input id="name" autoComplete="name" value={f.name} onChange={e => set('name', e.target.value)} /></Field>
                <Field label={t('learner.profile.email')} htmlFor="email" hint={t('learner.profile.emailHint')}><Input id="email" type="email" autoComplete="email" value={f.email} onChange={e => set('email', e.target.value)} /></Field>
                <Field label={t('learner.profile.phone')} htmlFor="phone" optional hint={t('learner.profile.phoneHint')}><Input id="phone" type="tel" autoComplete="tel" value={f.phone} onChange={e => set('phone', e.target.value)} /></Field>
                <Field label={t('learner.profile.country')} htmlFor="country">
                  <Select id="country" value={f.country} onChange={e => set('country', e.target.value)}>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c === 'Other' ? t('learner.profile.otherCountry') : c}</option>)}
                  </Select>
                </Field>
                <Field label={t('learner.profile.city')} htmlFor="city"><Input id="city" autoComplete="address-level2" value={f.city} onChange={e => set('city', e.target.value)} /></Field>
                <Field label={t('learner.profile.gender')} htmlFor="gender" hint={t('learner.profile.genderHint')}>
                  <Select id="gender" value={f.gender} onChange={e => set('gender', e.target.value as Details['gender'])}>
                    {(['female', 'male', 'prefer_not'] as const).map(g => <option key={g} value={g}>{t(`learner.profile.gender.${g}`)}</option>)}
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label={t('learner.profile.bio')} htmlFor="bio" optional><Textarea id="bio" value={f.bio} onChange={e => set('bio', e.target.value)} /></Field>
                </div>
              </div>

              <fieldset className="mt-8">
                <legend className="font-bold">{t('learner.profile.pillars')}</legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {PILLARS.map(id => {
                    const on = f.pillars.includes(id);
                    const Icon = pillarIcon[id];
                    return (
                      <button key={id} type="button" aria-pressed={on} onClick={() => togglePillar(id)}
                        className={cx('flex items-center gap-3 rounded-2xl border p-3 text-left transition', on ? 'border-brand bg-brand-light/50 dark:bg-brand/10' : 'border-line hover:bg-surface')}>
                        <span className={cx('grid size-9 shrink-0 place-items-center rounded-xl', on ? 'bg-brand text-white' : 'bg-surface text-muted')}><Icon size={18} /></span>
                        <span className="flex-1 font-semibold">{t(`pillar.${id}`)}</span>
                        {on && <Check size={18} className="text-brand" />}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={!dirty || saving}>{saving ? t('learner.profile.saving') : t('ui.saveChanges')}</Button>
                {dirty && <Button type="button" variant="ghost" onClick={() => setF(detailsOf(p))}>{t('learner.profile.discard')}</Button>}
              </div>
            </form>
          </Panel>

          <Panel title={t('learner.profile.privacy')}>
            <div className="-my-4 divide-y divide-line">
              {CONSENTS.map(k => (
                <Switch key={k} id={`c-${k}`} label={t(`learner.profile.consent.${k}`)} description={t(`learner.profile.consent.${k}.d`)}
                  checked={p.consents[k]} disabled={k === 'dataProcessing'} onChange={v => setConsent(k, v)} />
              ))}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-4">
              {p.exportRequestedAt
                ? <Badge tone="info" dot>{t('learner.profile.exportRequested', { date: date(p.exportRequestedAt.slice(0, 10)) })}</Badge>
                : <Button variant="ghost" size="sm" onClick={() => run(() => profile.requestExport(), t('learner.profile.exportOk'), r => me.setData(d => d && { ...d, exportRequestedAt: r.requestedAt }))}>
                  <Download size={16} /> {t('learner.profile.export')}
                </Button>}
            </div>
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel title={t('learner.profile.language')}>
            <div className="grid gap-2" role="radiogroup" aria-label={t('learner.profile.language')}>
              {LANGS.map(l => (
                <button key={l.id} type="button" role="radio" aria-checked={p.language === l.id} onClick={() => setLanguage(l.id)}
                  className={cx('flex items-center justify-between rounded-xl border px-4 py-3 text-left transition', p.language === l.id ? 'border-brand bg-brand-light/50 dark:bg-brand/10' : 'border-line hover:bg-surface')}>
                  <span className="font-semibold">{l.native}</span>
                  {p.language === l.id && <Check size={18} className="text-brand" />}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title={t('learner.profile.dataSaver')}>
            <div className="-my-4">
              <Switch id="datasaver" label={t('learner.profile.dataSaverLabel')} description={t('learner.profile.dataSaverText')}
                checked={p.dataSaver} onChange={v => instant({ dataSaver: v }, v ? t('learner.profile.dataSaverOn') : t('learner.profile.dataSaverOff'))} />
            </div>
          </Panel>

          <Panel title={t('learner.profile.deleteTitle')} className="border-brand/25">
            {p.deletionRequest ? (
              <div className="space-y-3">
                <Badge tone="gold" dot>{t('learner.profile.delPending', { date: date(p.deletionRequest.requestedAt.slice(0, 10)) })}</Badge>
                <p className="text-sm text-muted">{t('learner.profile.delPendingText', { date: date(p.deletionRequest.dueBy.slice(0, 10)) })}</p>
                <Button variant="ghost" size="sm" onClick={() => run(() => profile.cancelDeletion(), t('learner.profile.delCancelled'), () => me.setData(d => d && { ...d, deletionRequest: null }))}>
                  {t('learner.profile.delCancel')}
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted">{t('learner.profile.deleteText')}</p>
                <Button variant="danger" size="sm" className="mt-4" onClick={() => setDelOpen(true)}><Trash2 size={16} /> {t('learner.profile.deleteRequest')}</Button>
              </>
            )}
          </Panel>
          <p className="flex items-start gap-2 px-1 text-sm text-muted"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-ok" /> {t('learner.profile.law')}</p>
        </aside>
      </div>

      <Modal open={delOpen} onClose={() => setDelOpen(false)} title={t('learner.profile.delModalTitle')}
        footer={<>
          <Button variant="ghost" onClick={() => setDelOpen(false)}>{t('learner.profile.keep')}</Button>
          <Button onClick={requestDeletion} disabled={delConfirm.trim().toUpperCase() !== 'DELETE' || !delAck}><Trash2 size={16} /> {t('learner.profile.sendRequest')}</Button>
        </>}>
        <div className="space-y-4">
          <p className="text-muted">{t('learner.profile.delModalText')}</p>
          <Field label={t('learner.profile.why')} htmlFor="del-reason" optional>
            <Select id="del-reason" value={delReason} onChange={e => setDelReason(e.target.value)}>
              <option value="">{t('learner.profile.chooseReason')}</option>
              {(['finished', 'privacy', 'data', 'other'] as const).map(r => <option key={r} value={r}>{t(`learner.profile.reason.${r}`)}</option>)}
            </Select>
          </Field>
          <Field label={t('learner.profile.typeDelete')} htmlFor="del-confirm">
            <Input id="del-confirm" value={delConfirm} onChange={e => setDelConfirm(e.target.value)} autoComplete="off" />
          </Field>
          <Checkbox label={t('learner.profile.delAck')} checked={delAck} onChange={e => setDelAck(e.target.checked)} />
        </div>
      </Modal>
      {toastNode}
    </>
  );
}
