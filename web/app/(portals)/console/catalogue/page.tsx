'use client';

import { useState } from 'react';
import { Archive, EyeOff, Pencil, Plus, Send } from 'lucide-react';
import { Badge, Button, Checkbox, Field, Input, Select, Textarea } from '@/components/ui';
import { Modal, Tabs, useToast } from '@/components/ui/client';
import { Async, PageHead, Panel, Skeleton, StatusPill } from '@/components/dash';
import { ConfirmDialog, FormError } from '@/components/console/ConsoleKit';
import { errorMessage, useApi } from '@/lib/api/hooks';
import { capacityAdmin } from '@/lib/api/services';
import type { CatalogueEntry, CatalogueEntryInput, CatalogueStatus } from '@/lib/api/services/core/capacityAdmin';
import { useT } from '@/lib/i18n';
import type { CatalogueTopic } from '@/lib/types';

const kindKey: Record<CatalogueTopic['kind'], string> = { 'Capacity Building': 'capacity', 'Leadership Training': 'leadership', Coaching: 'coaching' };
const modeKey: Record<CatalogueTopic['modes'][number], string> = { 'In-person': 'inPerson', Virtual: 'virtual', Hybrid: 'hybrid' };

type Editing = CatalogueEntryInput & { id?: string };
const blank = (): Editing => ({ title: '', kind: 'Coaching', description: '', outcomes: [], audience: '', duration: '', modes: ['In-person'], languages: ['English'], standalone: true });

export default function CatalogueManager() {
  const t = useT();
  const list = useApi(() => capacityAdmin.listEntries(), []);
  const [tab, setTab] = useState<CatalogueStatus | 'all'>('all');
  const [editing, setEditing] = useState<Editing | null>(null);
  const [outcomes, setOutcomes] = useState('');
  const [retire, setRetire] = useState<CatalogueEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast, toastNode } = useToast();

  const items = list.data ?? [];
  const count = (s: CatalogueStatus) => items.filter(i => i.status === s).length;
  const replace = (e: CatalogueEntry) => list.setData(d => (d ?? []).some(x => x.id === e.id) ? d!.map(x => (x.id === e.id ? e : x)) : [e, ...(d ?? [])]);

  const run = async (fn: () => Promise<CatalogueEntry>, msg: (e: CatalogueEntry) => string) => {
    setBusy(true);
    try { const e = await fn(); replace(e); toast(msg(e)); return true; }
    catch (e) { toast(errorMessage(e)); return false; }
    finally { setBusy(false); }
  };

  const openEditor = (e: Editing) => { setEditing(e); setOutcomes(e.outcomes.join('\n')); setError(null); };

  const save = async () => {
    if (!editing) return;
    if (!editing.title.trim() || !editing.description.trim()) { setError(t('console.cat.required')); return; }
    const { id, ...rest } = editing;
    const body: CatalogueEntryInput = { ...rest, outcomes: outcomes.split('\n').map(s => s.trim()).filter(Boolean) };
    setBusy(true);
    setError(null);
    try {
      const e = id ? await capacityAdmin.updateEntry({ params: { id }, body }) : await capacityAdmin.createEntry({ body });
      replace(e);
      setEditing(null);
      toast(id ? t('console.cat.updated') : t('console.cat.created'));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const shown = items.filter(i => tab === 'all' || i.status === tab);

  return (
    <>
      <PageHead title={t('nav.catalogue')} meta={<span>{t('console.cat.meta')}</span>}
        actions={<Button onClick={() => openEditor(blank())}><Plus size={17} /> {t('console.cat.new')}</Button>} />

      <Tabs className="mb-5" value={tab} onChange={setTab} tabs={[
        { id: 'all', label: t('ui.all'), count: items.length },
        { id: 'published', label: t('status.published'), count: count('published') },
        { id: 'draft', label: t('status.draft'), count: count('draft') },
        { id: 'retired', label: t('status.retired'), count: count('retired') },
      ]} />

      <Async state={list} skeleton={<div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-[var(--radius-card)]" />)}</div>}>
        {() => shown.length === 0 ? <Panel><p className="py-6 text-center text-muted">{t('console.cat.none')}</p></Panel> : (
          <ul className="grid gap-4 md:grid-cols-2">
            {shown.map(e => (
              <li key={e.id}>
                <Panel className="flex h-full flex-col" bodyClassName="flex flex-1 flex-col">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <StatusPill status={e.status} />
                    <Badge>{t(`console.kind.${kindKey[e.kind]}`)}</Badge>
                    {!e.standalone && <Badge tone="info">{t('console.cat.bundleOnly')}</Badge>}
                  </div>
                  <h2 className="text-lg font-bold leading-tight">{e.title}</h2>
                  <p className="mt-1 flex-1 text-sm text-muted">{e.description}</p>
                  <div className="mt-3 text-sm text-muted">{e.duration} · {e.modes.map(m => t(`console.mode.${modeKey[m]}`)).join(', ')} · {e.languages.map(l => t(`console.lang.${l}`)).join(', ')}</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEditor(e)}><Pencil size={14} /> {t('ui.edit')}<span className="sr-only">: {e.title}</span></Button>
                    {e.status !== 'published' && (
                      <Button variant="subtle" size="sm" disabled={busy} onClick={() => run(() => capacityAdmin.publishEntry({ params: { id: e.id } }), x => t('console.cat.publishedToast', { title: x.title }))}>
                        <Send size={14} /> {e.status === 'retired' ? t('console.cat.reinstate') : t('console.cat.publish')}
                      </Button>
                    )}
                    {e.status === 'published' && (
                      <Button variant="subtle" size="sm" disabled={busy} onClick={() => run(() => capacityAdmin.unpublishEntry({ params: { id: e.id } }), x => t('console.cat.unpublishedToast', { title: x.title }))}>
                        <EyeOff size={14} /> {t('console.cat.unpublish')}
                      </Button>
                    )}
                    {e.status !== 'retired' && <Button variant="danger" size="sm" onClick={() => setRetire(e)}><Archive size={14} /> {t('console.cat.retire')}</Button>}
                  </div>
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </Async>

      <Modal wide open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? t('console.cat.edit') : t('console.cat.new')}
        footer={<><Button variant="ghost" onClick={() => setEditing(null)} disabled={busy}>{t('ui.cancel')}</Button><Button onClick={save} disabled={busy}>{t('ui.save')}</Button></>}>
        {editing && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label={t('console.cat.title')} htmlFor="ce-title">
                <Input id="ce-title" value={editing.title} maxLength={120} onChange={e => setEditing({ ...editing, title: e.target.value })} />
              </Field>
            </div>
            <Field label={t('console.cat.kind')} htmlFor="ce-kind">
              <Select id="ce-kind" value={editing.kind} onChange={e => setEditing({ ...editing, kind: e.target.value as CatalogueTopic['kind'] })}>
                {capacityAdmin.CATALOGUE_KINDS.map(k => <option key={k} value={k}>{t(`console.kind.${kindKey[k]}`)}</option>)}
              </Select>
            </Field>
            <Field label={t('console.cat.duration')} htmlFor="ce-dur">
              <Input id="ce-dur" value={editing.duration} onChange={e => setEditing({ ...editing, duration: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t('console.cat.description')} htmlFor="ce-desc">
                <Textarea id="ce-desc" value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} />
              </Field>
            </div>
            <Field label={t('console.cat.audience')} htmlFor="ce-aud">
              <Input id="ce-aud" value={editing.audience} onChange={e => setEditing({ ...editing, audience: e.target.value })} />
            </Field>
            <Field label={t('console.cat.outcomes')} htmlFor="ce-out" hint={t('console.cat.onePerLine')}>
              <Textarea id="ce-out" value={outcomes} onChange={e => setOutcomes(e.target.value)} className="min-h-20" />
            </Field>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">{t('console.cat.modes')}</legend>
              <div className="flex flex-col gap-2">
                {capacityAdmin.CATALOGUE_MODES.map(m => <Checkbox key={m} label={t(`console.mode.${modeKey[m]}`)} checked={editing.modes.includes(m)}
                  onChange={e => setEditing({ ...editing, modes: e.target.checked ? [...editing.modes, m] : editing.modes.filter(x => x !== m) })} />)}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">{t('console.editor.languages')}</legend>
              <div className="flex flex-col gap-2">
                {capacityAdmin.CATALOGUE_LANGUAGES.map(l => <Checkbox key={l} label={t(`console.lang.${l}`)} checked={editing.languages.includes(l)}
                  onChange={e => setEditing({ ...editing, languages: e.target.checked ? [...editing.languages, l] : editing.languages.filter(x => x !== l) })} />)}
              </div>
            </fieldset>
            <div className="sm:col-span-2">
              <Checkbox label={t('console.cat.standalone')} checked={editing.standalone} onChange={e => setEditing({ ...editing, standalone: e.target.checked })} />
            </div>
            <div className="sm:col-span-2"><FormError message={error} /></div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!retire} onClose={() => setRetire(null)} danger busy={busy} title={t('console.cat.retireTitle')} confirmLabel={t('console.cat.retire')}
        onConfirm={async () => { if (retire && await run(() => capacityAdmin.retireEntry({ params: { id: retire.id } }), x => t('console.cat.retiredToast', { title: x.title }))) setRetire(null); }}>
        {t('console.cat.retireBody', { title: retire?.title ?? '' })}
      </ConfirmDialog>
      {toastNode}
    </>
  );
}
