'use client';

// Pillars and programmes, plus the eligibility rules that apply to every learner registration.

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Async, PageHead, Panel, PillarTag, Skeleton, SkeletonPanel } from '@/components/dash';
import { Badge, Button, Checkbox, Field, Input } from '@/components/ui';
import { Modal, useToast } from '@/components/ui/client';
import { Toggle } from '@/components/admin/kit';
import { errorMessage, useApi } from '@/lib/api/hooks';
import { governance } from '@/lib/api/services';
import type { Eligibility, ProgrammeRecord } from '@/lib/api/services/core/governance';
import { useT } from '@/lib/i18n';
import type { PillarId } from '@/lib/types';

export default function Programmes() {
  const t = useT();
  const state = useApi(() => governance.getProgrammes(), []);
  const [elig, setElig] = useState<Eligibility | null>(null);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState<PillarId | null>(null);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string>();
  const { toast, toastNode } = useToast();

  useEffect(() => { if (state.data && !elig) setElig(state.data.eligibility); }, [state.data, elig]);

  const saveEligibility = async () => {
    if (!elig) return;
    setSaving(true);
    try {
      const next = await governance.updateEligibility({ body: elig });
      setElig(next);
      toast(next.minimumAge < 15 ? t('admin.programs.savedLowAge') : t('admin.programs.eligibilitySaved'));
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const patchProgramme = (rec: ProgrammeRecord) => state.setData(d => d && ({
    ...d, pillars: d.pillars.map(p => (p.id === rec.pillarId ? { ...p, programmes: p.programmes.some(x => x.id === rec.id) ? p.programmes.map(x => (x.id === rec.id ? rec : x)) : [...p.programmes, rec] } : p)),
  }));

  const toggle = async (rec: ProgrammeRecord, active: boolean) => {
    patchProgramme({ ...rec, active });
    try {
      await governance.updateProgramme({ params: { id: rec.id }, body: { active } });
      toast(t(active ? 'admin.programs.activated' : 'admin.programs.deactivated', { name: rec.name }));
    } catch (e) {
      patchProgramme(rec);
      toast(errorMessage(e));
    }
  };

  const add = async () => {
    if (!adding) return;
    setSaving(true);
    setNameError(undefined);
    try {
      const rec = await governance.createProgramme({ body: { pillarId: adding, name } });
      patchProgramme(rec);
      toast(t('admin.programs.added', { name: rec.name }));
      setAdding(null);
      setName('');
    } catch (e) {
      setNameError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHead title={t('nav.programs')} />

      <Panel title={t('admin.programs.eligibility')}>
        {!elig ? <Skeleton className="h-24 w-full" /> : (
          <form onSubmit={e => { e.preventDefault(); saveEligibility(); }}>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={t('admin.programs.minAge')} htmlFor="min-age" hint={t('admin.programs.minAgeHint')}>
                <Input id="min-age" type="number" min={10} max={30} required value={elig.minimumAge} onChange={e => setElig({ ...elig, minimumAge: Number(e.target.value) })} />
              </Field>
              <Field label={t('admin.programs.youthMax')} htmlFor="youth-max" hint={t('admin.programs.youthMaxHint')}>
                <Input id="youth-max" type="number" min={18} max={40} required value={elig.youthMaxAge} onChange={e => setElig({ ...elig, youthMaxAge: Number(e.target.value) })} />
              </Field>
              <div className="flex items-end pb-3">
                <Checkbox label={t('admin.programs.guardian')} checked={elig.guardianConsentUnder18} onChange={e => setElig({ ...elig, guardianConsentUnder18: e.target.checked })} />
              </div>
            </div>
            <Button type="submit" className="mt-5" disabled={saving}>{t('ui.saveChanges')}</Button>
          </form>
        )}
      </Panel>

      <Async state={state} skeleton={<div className="grid gap-6 lg:grid-cols-2">{[0, 1, 2, 3].map(i => <SkeletonPanel key={i} rows={3} />)}</div>}>
        {d => (
          <div className="grid gap-6 lg:grid-cols-2">
            {d.pillars.map(p => (
              <Panel key={p.id} title={<PillarTag id={p.id} label={t(`pillar.${p.id}`)} className="text-base" />}
                action={<Badge>{t('admin.programs.courses', { n: p.courseCount })}</Badge>}>
                <p className="text-sm text-muted">{p.description}</p>
                <div className="mt-3 text-sm">
                  <span className="text-muted">{t('admin.programs.rep')} </span>
                  {p.reps.length ? <span className="font-semibold">{p.reps.join(', ')}</span> : <Badge tone="gold">{t('admin.programs.noRep')}</Badge>}
                </div>
                <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
                  {p.programmes.map(x => (
                    <li key={x.id} className="px-4 py-3">
                      <Toggle id={x.id} label={x.name} checked={x.active} description={t(x.active ? 'status.active' : 'status.inactive')} onChange={v => toggle(x, v)} />
                    </li>
                  ))}
                </ul>
                <Button variant="ghost" size="sm" className="mt-4" onClick={() => { setAdding(p.id); setNameError(undefined); }}><Plus size={15} /> {t('admin.programs.add')}</Button>
              </Panel>
            ))}
          </div>
        )}
      </Async>

      <Modal open={!!adding} onClose={() => setAdding(null)} title={t('admin.programs.addTitle')}
        footer={<><Button variant="ghost" onClick={() => setAdding(null)}>{t('ui.cancel')}</Button><Button onClick={add} disabled={!name.trim() || saving}>{t('ui.add')}</Button></>}>
        <Field label={t('admin.programs.name')} htmlFor="pg-name" error={nameError} hint={adding ? t('admin.programs.addHint', { pillar: t(`pillar.${adding}`) }) : undefined}>
          <Input id="pg-name" value={name} maxLength={80} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && name.trim()) add(); }} />
        </Field>
      </Modal>
      {toastNode}
    </div>
  );
}
