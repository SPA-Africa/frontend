'use client';

// People directory with board term tracking (FR-B1.8, FR-B1.9).

import { BellRing } from 'lucide-react';
import { Async, DataTable, PageHead, Panel, Skeleton, SkeletonPanel, StatusPill, type Column } from '@/components/dash';
import { Avatar, Badge } from '@/components/ui';
import { roleTone } from '@/components/admin/kit';
import { useApi } from '@/lib/api/hooks';
import { governance } from '@/lib/api/services';
import type { BoardTerm, PersonRow } from '@/lib/api/services/core/governance';
import { useT } from '@/lib/i18n';
import { date } from '@/lib/format';
import type { PillarId, Role } from '@/lib/types';

const ROLES: Role[] = ['beneficiary', 'org_client', 'pillar_rep', 'judge_mentor', 'executive_admin', 'board_auditor'];
const STATUSES = ['active', 'pending_approval', 'declined', 'suspended'];
const PILLARS: PillarId[] = ['technology', 'education', 'leadership', 'young_startups', 'agriculture'];

export default function PeopleDirectory() {
  const t = useT();
  const people = useApi(() => governance.listPeople({ query: { pageSize: 200 } }), []);
  const terms = useApi(() => governance.listBoardTerms(), []);

  const termPill = (term: BoardTerm) => term.endingSoon
    ? <Badge tone="gold" dot>{t('admin.people.endsInMonths', { n: Math.max(0, Math.round(term.monthsLeft)) })}</Badge>
    : term.finalTerm ? <Badge tone="info">{t('admin.people.finalTerm')}</Badge>
    : <Badge tone="ok">{t('admin.people.renewable')}</Badge>;

  const columns: Column<PersonRow>[] = [
    { id: 'name', header: t('ui.name'), value: p => p.name, cell: p => (
      <span className="flex items-center gap-3"><Avatar name={p.name} size={32} /><span className="min-w-0"><span className="block font-semibold">{p.name}</span><span className="block truncate text-sm text-muted">{p.email}</span></span></span>
    ) },
    { id: 'role', header: t('admin.common.role'), value: p => t(`role.${p.role}`), cell: p => <Badge tone={roleTone[p.role]}>{t(`role.${p.role}`)}</Badge> },
    { id: 'pillar', header: t('admin.common.pillar'), value: p => (p.pillarId ? t(`pillar.${p.pillarId}`) : ''), hideOnMobile: true,
      cell: p => (p.pillarId ? <span className="text-sm">{t(`pillar.${p.pillarId}`)}</span> : <span className="text-sm text-subtle">{t('admin.common.none')}</span>) },
    { id: 'status', header: t('ui.status'), value: p => p.status, cell: p => <StatusPill status={p.status} /> },
    { id: 'joined', header: t('admin.people.joined'), value: p => p.joinedAt, hideOnMobile: true, cell: p => <span className="whitespace-nowrap text-sm">{date(p.joinedAt)}</span> },
    { id: 'term', header: t('admin.people.boardTerm'), value: p => p.term?.termEnd ?? '', hideOnMobile: true, cell: p => p.term ? (
      <span className="flex flex-col items-start gap-1 text-sm">
        <span className="whitespace-nowrap">{t('admin.people.termEnds', { n: p.term.termNumber, date: date(p.term.termEnd) })}</span>
        {termPill(p.term)}
      </span>
    ) : <span className="text-sm text-subtle">{t('admin.common.none')}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHead title={t('nav.people')} />

      <Panel title={t('admin.people.boardTerms')} action={terms.data && <span className="text-sm text-muted">{t('admin.people.termRule', { years: terms.data.termYears, max: terms.data.maxConsecutiveTerms })}</span>}>
        <Async state={terms} skeleton={<div className="grid gap-3 md:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-32" />)}</div>}
          empty={d => d.trustees.length === 0} emptyView={<p className="text-sm text-muted">{t('ui.empty')}</p>}>
          {d => {
            const ending = d.trustees.filter(p => p.term?.endingSoon);
            return (
              <>
                {ending.length > 0 && (
                  <ul className="mb-4 space-y-2" aria-label={t('admin.people.reminders')}>
                    {ending.map(p => (
                      <li key={p.id} className="flex items-center gap-2 text-sm">
                        <BellRing size={16} className="shrink-0 text-gold" aria-hidden />
                        <span>{t('admin.people.reminder', { name: p.name, date: date(p.term!.termEnd) })}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <ul className="grid gap-3 md:grid-cols-3">
                  {d.trustees.map(p => (
                    <li key={p.id} className="rounded-2xl border border-line p-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={p.name} size={36} />
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{p.name}</div>
                          <div className="text-sm text-muted">{t('admin.people.termOf', { n: p.term!.termNumber, max: d.maxConsecutiveTerms })}</div>
                        </div>
                      </div>
                      <div className="mt-3 text-sm text-muted">{t('admin.common.range', { from: date(p.term!.termStart), to: date(p.term!.termEnd) })}</div>
                      <div className="mt-2 flex flex-wrap gap-2">{termPill(p.term!)}</div>
                    </li>
                  ))}
                </ul>
              </>
            );
          }}
        </Async>
      </Panel>

      <Async state={people} skeleton={<SkeletonPanel rows={6} />}>
        {d => (
          <DataTable rows={d.items} columns={columns} rowKey={p => p.id} pageSize={12} exportName="spa-people" caption={t('nav.people')}
            search={p => `${p.name} ${p.email}`} searchPlaceholder={t('admin.people.search')}
            filters={[
              { id: 'role', label: t('admin.common.role'), options: ROLES.map(r => ({ value: r, label: t(`role.${r}`) })), get: p => p.role },
              { id: 'status', label: t('ui.status'), options: STATUSES.map(s => ({ value: s, label: t(`status.${s}`) })), get: p => p.status },
              { id: 'pillar', label: t('admin.common.pillar'), options: PILLARS.map(p => ({ value: p, label: t(`pillar.${p}`) })), get: p => p.pillarId ?? '' },
            ]} />
        )}
      </Async>
    </div>
  );
}
