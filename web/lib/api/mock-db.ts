// In-browser mock database used when NEXT_PUBLIC_API_MODE=mock.
// Each table is persisted to localStorage so changes survive a page reload, which makes
// demos realistic. Delete with resetMockDb() or the "Reset demo data" button in Settings.

const PREFIX = 'spa-mock:';
const memory = new Map<string, unknown>();

function load<T>(key: string, init: () => T): T {
  if (memory.has(key)) return memory.get(key) as T;
  let value: T | undefined;
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(PREFIX + key) : null;
    if (raw) value = JSON.parse(raw) as T;
  } catch {}
  const v = value ?? init();
  memory.set(key, v);
  return v;
}

function save(key: string, value: unknown) {
  memory.set(key, value);
  try { if (typeof window !== 'undefined') window.localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch {}
}

export interface MockTable<T> {
  get(): T;
  set(next: T): void;
  update(fn: (draft: T) => T | void): T;
}

/** Create (or reopen) a persisted mock table. `init` runs only the first time. */
export function mockTable<T>(key: string, init: () => T): MockTable<T> {
  return {
    get: () => load(key, init),
    set: next => save(key, next),
    update: fn => {
      const draft = structuredClone(load(key, init));
      const out = fn(draft);
      const next = (out === undefined ? draft : out) as T;
      save(key, next);
      return next;
    },
  };
}

export function resetMockDb() {
  memory.clear();
  try {
    Object.keys(window.localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => window.localStorage.removeItem(k));
  } catch {}
}

export const mockId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
export const nowIso = () => new Date().toISOString();
