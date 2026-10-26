'use client';

// Staff approvals (FR-B1.7). Pillar Representatives and Judges or Mentors register themselves and
// cannot sign in until the Executive Office approves them here.

import { useState } from 'react';
import { Check, ShieldCheck, X } from 'lucide-react';
import { Async, DataTable, PageHead, Panel, SkeletonPanel, StatusPill, type Column } from '@/components/dash';
import { Avatar, Badge, Button, EmptyState, Field, Textarea } from '@/components/ui';
import { Tabs, useToast } from '@/components/ui/client';
import { ConfirmDialog, roleTone } from '@/components/admin/kit';
import { errorMessage, useApi } from '@/lib/api/hooks';
import { governance } from '@/lib/api/services';
import type { StaffAccount } from '@/lib/api/services/core/governance';
import { useT } from '@/lib/i18n';
import { date } from '@/lib/format';

type Tab = 'pending_approval' | 'active' | 'declined';

export default function Approvals() {
  const t = useT();
  const state = useApi(() => governance.listStaffRequests({ query: { status: 'all' } }), []);
  const [tab, setTab] = useState<Tab>('pending_approval');
  const [action, setAction] = useState<{ person: StaffAccount; kind: 'approve' | 'decline' } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast, toastNode } = useToast();

  const all = state.data ?? [];
  const count = (s: Tab) => all.filter(p => p.status === s).length;
  const roleText = (p: StaffAccount) => `${t(`role.${p.role}`)}${p.pillarId ? `, ${t(`pillar.${p.pillarId}`)}` : ''}`;

  const decide = async () => {
    if (!action) return;
    const { person, kind } = action;
    setBusy(true);
    try {
      if (kind === 'approve') await governance.approveStaff({ params: { id: person.id } });
      else await governance.declineStaff({ params: { id: person.id }, body: { reason: reason.trim() || undefined } });
      state.setData(xs => xs?.map(x => (x.id === person.id ? { ...x, status: kind === 'approve' ? 'active' : 'declined' } : x)));
      toast(t(kind === 'approve' ? 'admin.approvals.approvedToast' : 'admin.approvals.declinedToast', { name: person.name }));
      setAction(null);
      setReason('');
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<StaffAccount>[] = [
    { id: 'name', header: t('ui.name'), value: p => p.name, cell: p => (
      <span className="flex items-center gap-3"><Avatar name={p.name} size={32} /><span className="min-w-0"><span className="block font-semibold">{p.name}</span><span className="block truncate text-sm text-muted">{p.email}</span></span></span>
    ) },
    { id: 'role', header: t('admin.common.role'), value: roleText, cell: p => <Badge tone={roleTone[p.role]}>{roleText(p)}</Badge> },
    { id: 'since', header: t('admin.approvals.requested'), value: p => p.joinedAt, cell: p => <span className="whitespace-nowrap text-sm">{date(p.joinedAt)}</span>, hideOnMobile: true },
    { id: 'status', header: t('ui.status'), value: p => p.status, cell: p => <StatusPill status={p.status} /> },
  ];

  return (
    <div>
      <PageHead title={t('nav.approvals')} />

      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[
        { id: 'pending_approval', label: t('admin.approvals.waiting'), count: state.data ? count('pending_approval') : undefined },
        { id: 'active', label: t('admin.approvals.approved'), count: state.data ? count('active') : undefined },
        { id: 'declined', label: t('admin.approvals.declined'), count: state.data ? count('declined') : undefined },
      ]} />

      <Async state={state} skeleton={<SkeletonPanel rows={3} />}>
        {data => {
          const rows = data.filter(p => p.status === tab);
          if (tab !== 'pending_approval') {
            return <DataTable rows={rows} columns={columns} rowKey={p => p.id} search={p => `${p.name} ${p.email}`} exportName={`spa-staff-${tab}`} caption={t('nav.approvals')} />;
          }
          if (rows.length === 0) return <EmptyState icon={<ShieldCheck size={22} />} title={t('admin.approvals.none')} />;
          return (
            <Panel flush>
              <ul className="divide-y divide-line">
                {rows.map(p => (
                  <li key={p.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                    <Avatar name={p.name} size={44} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{p.name}</span>
                        <Badge tone={roleTone[p.role]}>{roleText(p)}</Badge>
                      </div>
                      <div className="text-sm text-muted">{p.email} · {t('admin.approvals.requestedOn', { date: date(p.joinedAt) })}</div>
                      {p.note && <div className="mt-1 text-sm">{p.note}</div>}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="danger" size="sm" onClick={() => setAction({ person: p, kind: 'decline' })}><X size={15} /> {t('admin.approvals.decline')}</Button>
                      <Button size="sm" onClick={() => setAction({ person: p, kind: 'approve' })}><Check size={15} /> {t('admin.approvals.approve')}</Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          );
        }}
      </Async>

      <ConfirmDialog open={!!action} onClose={() => { if (!busy) { setAction(null); setReason(''); } }} busy={busy} danger={action?.kind === 'decline'}
        title={t(action?.kind === 'approve' ? 'admin.approvals.confirmApprove' : 'admin.approvals.confirmDecline')}
        confirmLabel={t(action?.kind === 'approve' ? 'admin.approvals.approve' : 'admin.approvals.decline')} onConfirm={decide}>
        {action && (action.kind === 'approve' ? (
          <p>{t(action.person.role === 'pillar_rep' ? 'admin.approvals.approveRep' : 'admin.approvals.approveJudge', { name: action.person.name, role: roleText(action.person) })}</p>
        ) : (
          <div className="space-y-4">
            <p>{t('admin.approvals.declineBody', { name: action.person.name })}</p>
            <Field label={t('admin.approvals.reason')} htmlFor="decline-reason" optional>
              <Textarea id="decline-reason" value={reason} onChange={e => setReason(e.target.value)} maxLength={300} className="text-ink" />
            </Field>
          </div>
        ))}
      </ConfirmDialog>
      {toastNode}
    </div>
  );
}
