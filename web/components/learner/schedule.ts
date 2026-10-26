// Helpers for the learner schedule: week grouping, month grid and .ics export (built on the device).

import type { ScheduleItem } from '@/lib/api/services/core/schedule';

export const JOIN_EARLY_MS = 15 * 60_000;

export const endOf = (s: ScheduleItem) => new Date(s.startsAt).getTime() + s.minutes * 60_000;

/** Monday 00:00 local time of the week containing d */
export function weekStart(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** 6 rows of 7 days covering the month, starting on Monday */
export function monthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = weekStart(first);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export function groupByWeek(items: ScheduleItem[]) {
  const groups = new Map<number, ScheduleItem[]>();
  for (const s of items) {
    const k = weekStart(new Date(s.startsAt)).getTime();
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([week, list]) => ({ week: new Date(week), items: list }));
}

const icsDate = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n');

export function buildIcs(s: ScheduleItem, extra?: { description?: string; url?: string }) {
  const start = new Date(s.startsAt).getTime();
  const end = start + Math.max(s.minutes, 30) * 60_000;
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SHAPE Potential Africa//Learner schedule//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${s.id}@shapepotential.africa`,
    `DTSTAMP:${icsDate(Date.now())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(s.title)}`,
    ...(extra?.description ? [`DESCRIPTION:${icsText(extra.description)}`] : []),
    ...(extra?.url ? [`URL:${extra.url}`] : []),
    ...(s.kind === 'live' ? ['BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(s.title)}`, 'END:VALARM'] : []),
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

export function downloadIcs(s: ScheduleItem, extra?: { description?: string; url?: string }) {
  const blob = new Blob([buildIcs(s, extra)], { type: 'text/calendar;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `${s.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event'}.ics`,
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
