'use client';

// The one table used in every portal: search, filter chips, sorting, pagination, CSV export.
// Works client-side on the rows it is given. For large server-paginated lists, pass `page`
// and `onPageChange` from a Page<T> response instead (SRS NFR-BW.5).

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Search, SearchX } from 'lucide-react';
import { Button, Select } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { cx } from '@/lib/format';

export interface Column<T> {
  id: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** value used for sorting and CSV; omit to make the column unsortable and skip it in CSV */
  value?: (row: T) => string | number;
  align?: 'left' | 'right';
  className?: string;
  /** hide below md */
  hideOnMobile?: boolean;
}

export interface Filter<T> {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  get: (row: T) => string;
}

export function DataTable<T>({ rows, columns, rowKey, search, searchPlaceholder, filters, pageSize = 10, exportName, onRowClick, empty, toolbar, caption }: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  search?: (row: T) => string;
  searchPlaceholder?: string;
  filters?: Filter<T>[];
  pageSize?: number;
  exportName?: string;
  onRowClick?: (row: T) => void;
  empty?: React.ReactNode;
  toolbar?: React.ReactNode;
  caption?: string;
}) {
  const t = useT();
  const [q, setQ] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ id: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter(r =>
      (!needle || !search || search(r).toLowerCase().includes(needle)) &&
      (filters ?? []).every(f => !filterValues[f.id] || f.get(r) === filterValues[f.id]));
    if (sort) {
      const col = columns.find(c => c.id === sort.id);
      if (col?.value) out = [...out].sort((a, b) => {
        const x = col.value!(a), y = col.value!(b);
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sort.dir;
      });
    }
    return out;
  }, [rows, q, search, filters, filterValues, sort, columns]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize);
  const hasFilters = q || Object.values(filterValues).some(Boolean);

  const exportCsv = () => {
    const cols = columns.filter(c => c.value);
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [cols.map(c => esc(typeof c.header === 'string' ? c.header : c.id)).join(','), ...filtered.map(r => cols.map(c => esc(c.value!(r))).join(','))];
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${exportName}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="min-w-0 rounded-[var(--radius-card)] border border-line bg-bg">
      {(search || filters?.length || exportName || toolbar) && (
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          {search && (
            <label className="relative flex-1">
              <span className="sr-only">{t('ui.search')}</span>
              <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle" />
              <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder={searchPlaceholder ?? t('ui.search')}
                className="h-10 w-full rounded-full border border-line bg-bg pl-10 pr-4 text-[15px] placeholder:text-subtle focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10" />
            </label>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {filters?.map(f => (
              <label key={f.id} className="min-w-[150px]">
                <span className="sr-only">{f.label}</span>
                <Select value={filterValues[f.id] ?? ''} onChange={e => { setFilterValues(v => ({ ...v, [f.id]: e.target.value })); setPage(1); }} className="h-10! rounded-full! text-sm">
                  <option value="">{f.label}: {t('ui.all')}</option>
                  {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </label>
            ))}
            {toolbar}
            {exportName && <Button variant="ghost" size="sm" onClick={exportCsv} className="h-10"><Download size={15} /> {t('ui.exportCsv')}</Button>}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[15px]">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="text-[13px] text-muted">
            <tr className="border-b border-line">
              {columns.map(c => {
                const active = sort?.id === c.id;
                return (
                  <th key={c.id} scope="col" aria-sort={active ? (sort!.dir === 1 ? 'ascending' : 'descending') : undefined}
                    className={cx('whitespace-nowrap px-4 py-3 font-semibold first:pl-5 last:pr-5', c.align === 'right' && 'text-right', c.hideOnMobile && 'hidden md:table-cell')}>
                    {c.value ? (
                      <button type="button" onClick={() => setSort(s => s?.id === c.id ? { id: c.id, dir: s.dir === 1 ? -1 : 1 } : { id: c.id, dir: 1 })}
                        className={cx('inline-flex items-center gap-1 hover:text-ink', active && 'text-ink')}>
                        {c.header}
                        {active && (sort!.dir === 1 ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
                      </button>
                    ) : c.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map(r => (
              <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={cx('transition-colors', onRowClick && 'cursor-pointer hover:bg-surface')}>
                {columns.map(c => (
                  <td key={c.id} className={cx('px-4 py-3.5 align-middle first:pl-5 last:pr-5', c.align === 'right' && 'text-right tabular-nums', c.hideOnMobile && 'hidden md:table-cell', c.className)}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            {hasFilters ? (
              <>
                <SearchX size={26} className="text-subtle" />
                <p className="mt-2 font-semibold">{t('ui.noResults')}</p>
                <Button variant="link" size="sm" onClick={() => { setQ(''); setFilterValues({}); }}>{t('ui.clearFilters')}</Button>
              </>
            ) : (empty ?? <p className="text-muted">{t('ui.empty')}</p>)}
          </div>
        )}
      </div>

      {filtered.length > pageSize && (
        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm text-muted">
          <span>{t('ui.showing', { from: (current - 1) * pageSize + 1, to: Math.min(current * pageSize, filtered.length), total: filtered.length })}</span>
          <div className="flex gap-1">
            <button type="button" onClick={() => setPage(current - 1)} disabled={current === 1} aria-label={t('ui.previous')}
              className="grid size-9 place-items-center rounded-full border border-line hover:bg-surface disabled:opacity-40"><ChevronLeft size={16} /></button>
            <button type="button" onClick={() => setPage(current + 1)} disabled={current === pages} aria-label={t('ui.next')}
              className="grid size-9 place-items-center rounded-full border border-line hover:bg-surface disabled:opacity-40"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
