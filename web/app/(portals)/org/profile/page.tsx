'use client';

// Organisation profile and authorised users (FR-C1.2, FR-C1.3).

import { useEffect, useState } from 'react';
import { Mail, Trash2, UserPlus } from 'lucide-react';
import { Avatar, Badge, Button, Field, Input, Select } from '@/components/ui';
import { Modal, useToast } from '@/components/ui/client';
import { Async, PageHead, Panel, Skeleton, SkeletonPanel } from '@/components/dash';
import { useOrgLabels } from '@/components/org/bits';
import { errorMessage, useApi, type ApiState } from '@/lib/api/hooks';
import { capacity } from '@/lib/api/services';
import type { InviteOrgUserRequest, OrgProfile, OrgUser } from '@/lib/api/services/core/capacity';
import { useSession } from '@/lib/session';
import { useT } from '@/lib/i18n';

const TYPES = ['NGO', 'Company', 'Government institution', 'School or university', 'Cooperative', 'Other'];
const SIZES = ['Fewer than 10 staff', '10 to 25 staff', '25 to 50 staff', '50 to 200 staff', 'More than 200 staff'];
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export default function OrgProfilePage() {
  const t = useT();
  const org = useApi(() => capacity.getOrganisation(), []);
  const users = useApi(() => capacity.listOrgUsers(), []);
  const { toast, toastNode } = useToast();

  return (
    <>
      <PageHead title={t('nav.orgProfile')} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Async state={org} skeleton={<SkeletonPanel rows={6} />}>
          {o => <ProfileForm initial={o} onSaved={p => { org.setData(p); toast(t('org.prof.saved')); }} onError={e => toast(errorMessage(e))} />}
        </Async>
        <UsersPanel state={users} orgName={org.data?.name ?? ''} toast={toast} />
      </div>
      {toastNode}
    </>
  );
}

function ProfileForm({ initial, onSaved, onError }: { initial: OrgProfile; onSaved: (p: OrgProfile) => void; onError: (e: unknown) => void }) {
  const t = useT();
  const [f, setF] = useState<OrgProfile>(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => setF(initial), [initial]);
  const set = (k: keyof OrgProfile, v: string) => setF(x => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const errors = { name: !f.name.trim() ? t('org.prof.errName') : undefined, billingEmail: !isEmail(f.billingEmail) ? t('org.prof.errEmail') : undefined };

  const fields: { k: keyof OrgProfile; hint?: string; optional?: boolean }[] = [
    { k: 'name' }, { k: 'type' }, { k: 'sector' }, { k: 'size' }, { k: 'country' }, { k: 'city' },
    { k: 'address', hint: t('org.prof.onInvoices') }, { k: 'tin', hint: t('org.prof.onInvoices'), optional: true },
    { k: 'website', optional: true }, { k: 'billingEmail', hint: t('org.prof.billingHint') },
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (errors.name || errors.billingEmail) return;
    setBusy(true);
    try {
      const { id: _id, ...body } = f;
      onSaved(await capacity.updateOrganisation({ body }));
    } catch (er) {
      onError(er);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title={t('org.prof.details')}>
      <form onSubmit={submit} noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          {fields.map(({ k, hint, optional }) => (
            <Field key={k} label={t(`org.prof.f.${k}`)} htmlFor={`org-${k}`} hint={hint} optional={optional} error={dirty ? errors[k as 'name'] : undefined}>
              {k === 'type' || k === 'size' ? (
                <Select id={`org-${k}`} value={f[k]} onChange={e => set(k, e.target.value)}>
                  {(k === 'type' ? TYPES : SIZES).map(x => <option key={x}>{x}</option>)}
                </Select>
              ) : (
                <Input id={`org-${k}`} type={k === 'billingEmail' ? 'email' : k === 'website' ? 'url' : 'text'} value={f[k]} onChange={e => set(k, e.target.value)}
                  aria-invalid={dirty && !!errors[k as 'name']} />
              )}
            </Field>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button type="submit" disabled={!dirty || busy || !!errors.name || !!errors.billingEmail}>{t('ui.saveChanges')}</Button>
          {dirty && <Button type="button" variant="ghost" onClick={() => setF(initial)}>{t('org.prof.discard')}</Button>}
        </div>
      </form>
    </Panel>
  );
}

function UsersPanel({ state, orgName, toast }: { state: ApiState<OrgUser[]>; orgName: string; toast: (m: string) => void }) {
  const t = useT();
  const L = useOrgLabels();
  const { user } = useSession();
  const [invite, setInvite] = useState(false);
  const [nu, setNu] = useState<InviteOrgUserRequest>({ name: '', email: '', role: 'coordinator' });
  const [removing, setRemoving] = useState<OrgUser | null>(null);
  const [busy, setBusy] = useState(false);

  const sendInvite = async () => {
    setBusy(true);
    try {
      const u = await capacity.inviteOrgUser({ body: nu });
      state.setData(d => [...(d ?? []), u]);
      setInvite(false);
      setNu({ name: '', email: '', role: 'coordinator' });
      toast(t('org.prof.invited', { email: u.email }));
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await capacity.removeOrgUser({ params: { id: removing.id } });
      state.setData(d => d?.filter(x => x.id !== removing.id));
      toast(t('org.prof.removed', { name: removing.name }));
      setRemoving(null);
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Panel title={t('org.prof.users')} className="self-start"
        action={<Button size="sm" variant="ghost" onClick={() => setInvite(true)}><UserPlus size={16} aria-hidden="true" /> {t('org.prof.invite')}</Button>}>
        <Async state={state} skeleton={<div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-12" />)}</div>}>
          {list => (
            <ul className="divide-y divide-line">
              {list.map(u => (
                <li key={u.id} className="flex items-center gap-3 py-3">
                  <Avatar name={u.name} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">{u.name}</span>
                      {u.status === 'invited' && <Badge tone="gold">{t('org.prof.invitedBadge')}</Badge>}
                    </div>
                    <div className="truncate text-sm text-muted">{L.role(u.role)} · {u.email}</div>
                  </div>
                  {u.email !== user?.email && u.role !== 'owner' && (
                    <button type="button" onClick={() => setRemoving(u)} aria-label={t('org.prof.removeAria', { name: u.name })}
                      className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface hover:text-brand"><Trash2 size={16} aria-hidden="true" /></button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Async>
      </Panel>

      <Modal open={invite} onClose={() => setInvite(false)} title={t('org.prof.inviteTitle')}
        footer={<>
          <Button variant="ghost" onClick={() => setInvite(false)}>{t('ui.cancel')}</Button>
          <Button disabled={busy || !nu.name.trim() || !isEmail(nu.email)} onClick={sendInvite}><Mail size={16} aria-hidden="true" /> {t('org.prof.send')}</Button>
        </>}>
        <div className="space-y-4">
          <Field label={t('org.prof.fullName')} htmlFor="inv-name"><Input id="inv-name" autoComplete="off" value={nu.name} onChange={e => setNu(x => ({ ...x, name: e.target.value }))} /></Field>
          <Field label={t('org.prof.workEmail')} htmlFor="inv-email" error={nu.email && !isEmail(nu.email) ? t('org.prof.errEmail') : undefined}>
            <Input id="inv-email" type="email" autoComplete="off" value={nu.email} onChange={e => setNu(x => ({ ...x, email: e.target.value }))} />
          </Field>
          <Field label={t('org.prof.role')} htmlFor="inv-role" hint={t('org.prof.roleHint')}>
            <Select id="inv-role" value={nu.role} onChange={e => setNu(x => ({ ...x, role: e.target.value as InviteOrgUserRequest['role'] }))}>
              <option value="coordinator">{L.role('coordinator')}</option>
              <option value="finance">{L.role('finance')}</option>
            </Select>
          </Field>
        </div>
      </Modal>

      <Modal open={!!removing} onClose={() => setRemoving(null)} title={t('org.prof.removeTitle')}
        footer={<>
          <Button variant="ghost" onClick={() => setRemoving(null)}>{t('ui.cancel')}</Button>
          <Button disabled={busy} onClick={remove}>{t('org.prof.removeConfirm')}</Button>
        </>}>
        <p className="text-muted">{t('org.prof.removeText', { name: removing?.name ?? '', org: orgName })}</p>
      </Modal>
    </>
  );
}
