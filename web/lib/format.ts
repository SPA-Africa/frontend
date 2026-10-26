export const rwf = (n: number) => `RWF ${Math.round(n).toLocaleString('en-US')}`;
export const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
export const num = (n: number) => Math.round(n).toLocaleString('en-US');
export const pct = (n: number) => `${Math.round(n * 100)}%`;

// Dates follow the interface language (Kinyarwanda month names come from the browser, e.g. "27 Ukwakira 2026").
const dateTags = { en: 'en-GB', fr: 'fr-FR', rw: 'rw-RW' } as const;
let dateTag: string = dateTags.en;
export const setDateLocale = (l: keyof typeof dateTags) => { dateTag = dateTags[l] ?? dateTags.en; };
export const dateLocale = () => dateTag;

// Chrome and Safari ship without Kinyarwanda date data and silently fall back to US English,
// so for rw we format with en-GB (day month year, 24-hour clock) and swap in the CLDR rw names.
const RW_MONTHS = ['Mutarama', 'Gashyantare', 'Werurwe', 'Mata', 'Gicurasi', 'Kamena', 'Nyakanga', 'Kanama', 'Nzeri', 'Ukwakira', 'Ugushyingo', 'Ukuboza'];
const RW_MONTHS_SHORT = ['Mut', 'Gas', 'Wer', 'Mat', 'Gic', 'Kam', 'Nya', 'Kan', 'Nze', 'Ukw', 'Ugu', 'Uku'];
const RW_WEEKDAYS = ['Ku cyumweru', 'Ku wa mbere', 'Ku wa kabiri', 'Ku wa gatatu', 'Ku wa kane', 'Ku wa gatanu', 'Ku wa gatandatu'];
const RW_WEEKDAYS_SHORT = ['Cyu', 'Mbe', 'Kab', 'Gtu', 'Kan', 'Gnu', 'Gnd'];
let rwNative: boolean | null = null;
const browserHasRw = () => {
  if (rwNative === null) {
    try { rwNative = new Intl.DateTimeFormat('rw-RW', { month: 'long' }).format(new Date(2026, 9, 1)) === 'Ukwakira'; } catch { rwNative = false; }
  }
  return rwNative;
};

/** Format a date or time in the interface language. Use this instead of toLocale*String. */
export function fmtDate(d: Date, opts: Intl.DateTimeFormatOptions) {
  if (dateTag !== 'rw-RW' || browserHasRw()) return new Intl.DateTimeFormat(dateTag, opts).format(d);
  const tz = opts.timeZone;
  const local = (fn: 'getMonth' | 'getDay') => (tz === 'UTC' ? (fn === 'getMonth' ? d.getUTCMonth() : d.getUTCDay()) : d[fn]());
  return new Intl.DateTimeFormat('en-GB', { ...opts, hour12: false }).formatToParts(d).map(p => {
    if (p.type === 'month' && opts.month !== 'numeric' && opts.month !== '2-digit') {
      return (opts.month === 'long' || opts.dateStyle === 'long' || opts.dateStyle === 'full' ? RW_MONTHS : RW_MONTHS_SHORT)[local('getMonth')];
    }
    if (p.type === 'weekday') return (opts.weekday === 'long' ? RW_WEEKDAYS : RW_WEEKDAYS_SHORT)[local('getDay')];
    return p.value;
  }).join('');
}

export const date = (iso: string) =>
  fmtDate(new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')), { day: 'numeric', month: 'short', year: 'numeric' });

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
