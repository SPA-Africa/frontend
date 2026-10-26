'use client';

// Immutable audit log (NFR-SEC.6). Append-only: entries cannot be edited or deleted by anyone.

import { Lock } from 'lucide-react';
import { Async, DataTable, PageHead, SkeletonPanel, type Column } from '@/components/dash';
import { Badge } from '@/components/ui';
import { roleTone } from '@/components/admin/kit';
import { useApi } from '@/lib/api/hooks';
import { governance } from '@/lib/api/services';
import type { AuditEvent } from '@/lib/api/services/core/governance';
import { useT } from '@/lib/i18n';
import type { PillarId, Role } from '@/lib/types';

import { dateLocale, fmtDate } from '@/lib/format';
const when = (iso: string) => fmtDate(new Date(iso), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const ROLES: (Role | 'system')[] = ['system', 'pillar_rep', 'judge_mentor', 'executive_admin', 'board_auditor', 'org_client', 'beneficiary'];
const PILLARS: PillarId[] = ['technology', 'education', 'leadership', 'young_startups', 'agriculture'];

export default function AuditLog() {
  const t = useT();
  const state = useApi(() => governance.listAudit({ query: { pageSize: 500 } }), []);
  const roleName = (r: Role | 'system') => (r === 'system' ? t('admin.common.system') : t(`role.${r}`));
  const pillarName = (e: AuditEvent) => (e.pillarId ? t(`pillar.${e.pillarId}`) : t('admin.audit.orgWide'));

  const columns: Column<AuditEvent>[] = [
    { id: 'at', header: t('admin.audit.time'), value: e => e.at, cell: e => <time dateTime={e.at} className="whitespace-nowrap text-sm tabular-nums text-muted">{when(e.at)}</time> },
    { id: 'actor', header: t('admin.audit.actor'), value: e => e.actor, cell: e => (
      <span className="flex flex-col items-start gap-1"><span className="font-semibold">{e.actor === 'system' ? t('admin.common.system') : e.actor}</span><Badge tone={roleTone[e.role]} className="py-0.5">{roleName(e.role)}</Badge></span>
    ) },
    { id: 'action', header: t('admin.audit.action'), value: e => e.action, cell: e => <span className="text-sm font-semibold">{e.action}</span> },
    { id: 'target', header: t('admin.audit.target'), value: e => e.target, cell: e => <span className="text-sm">{e.target}</span> },
    { id: 'pillar', header: t('admin.common.pillar'), value: pillarName, hideOnMobile: true, cell: e => <span className={e.pillarId ? 'text-sm' : 'text-sm text-subtle'}>{pillarName(e)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHead title={t('nav.audit')} meta={<span className="inline-flex items-center gap-1.5"><Lock size={14} aria-hidden /> {t('admin.audit.appendOnly')}</span>} />
      <Async state={state} skeleton={<SkeletonPanel rows={8} />}>
        {d => (
          <DataTable rows={d.items} columns={columns} rowKey={e => e.id} pageSize={15} exportName="spa-audit-log" caption={t('nav.audit')}
            search={e => `${e.actor} ${e.target}`} searchPlaceholder={t('admin.audit.search')}
            filters={[
              { id: 'role', label: t('admin.common.role'), options: ROLES.map(r => ({ value: r, label: roleName(r) })), get: e => e.role },
              { id: 'action', label: t('admin.audit.action'), options: d.actions.map(a => ({ value: a, label: a })), get: e => e.action },
              { id: 'pillar', label: t('admin.common.pillar'), options: [{ value: 'none', label: t('admin.audit.orgWide') }, ...PILLARS.map(p => ({ value: p, label: t(`pillar.${p}`) }))], get: e => e.pillarId ?? 'none' },
            ]} />
        )}
      </Async>
    </div>
  );
}
