'use client';

// Published quarterly reports. The API only returns published reports to board_auditor.

import { FileText } from 'lucide-react';
import { Async, PageHead, Panel, Row, SkeletonPanel, StatusPill } from '@/components/dash';
import { EmptyState } from '@/components/ui';
import { ReadOnlyPill, quarterLabel } from '@/components/admin/kit';
import { useApi } from '@/lib/api/hooks';
import { reporting } from '@/lib/api/services';
import { useT } from '@/lib/i18n';
import { date } from '@/lib/format';

export default function BoardReports() {
  const t = useT();
  const state = useApi(() => reporting.listReports(), []);

  return (
    <div>
      <PageHead title={t('nav.quarterly')} meta={<ReadOnlyPill />} />
      <Async state={state} skeleton={<SkeletonPanel rows={3} />}
        empty={d => d.filter(r => r.status === 'published').length === 0}
        emptyView={<EmptyState icon={<FileText size={22} />} title={t('board.reports.none')} text={t('board.reports.noneText')} />}>
        {d => (
          <Panel flush>
            <ul className="divide-y divide-line px-3 py-2">
              {d.filter(r => r.status === 'published').map(r => (
                <li key={r.quarter}>
                  <Row href={`/board/reports/${r.quarter}`}
                    leading={<span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface text-muted"><FileText size={20} /></span>}
                    title={t('admin.reports.reportFor', { quarter: quarterLabel(r.quarter) })}
                    sub={`${r.publishedAt ? t('admin.reports.publishedOn', { date: date(r.publishedAt) }) : ''} ${r.summary}`}
                    trailing={<StatusPill status="published" />} />
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </Async>
    </div>
  );
}
