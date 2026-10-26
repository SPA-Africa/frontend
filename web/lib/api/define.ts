// One place to declare every backend call.
//
//   export const listMyEnrollments = defineEndpoint<Enrollment[]>({
//     id: 'lms.enrollments.mine', service: 'core', method: 'GET', path: '/lms/enrollments/me',
//     roles: ['beneficiary'], summary: 'Courses the signed-in learner is enrolled in', srs: ['FR-A2.3'],
//     response: 'Enrollment[]',
//   }, ({ db }) => db.enrollments);
//
// The declaration is used three ways:
//   1. In live mode it calls the gateway:  GET {gateway}/api/core/lms/enrollments/me
//   2. In mock mode it runs the mock handler against the in-browser mock database
//   3. `npm run api:docs` reads the registry and writes docs/API_ENDPOINTS.md for the backend team

import { API_MODE, MOCK_LATENCY_MS, type Service } from './config';
import { ApiError, buildUrl, request } from './http';
import type { Role, User } from '../types';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type Access = Role | 'public' | 'authenticated';

export interface EndpointMeta {
  /** Stable id, `<domain>.<resource>.<action>` */
  id: string;
  service: Service;
  method: HttpMethod;
  /** Path after the service prefix, with `:param` placeholders */
  path: string;
  summary: string;
  /** Who may call it. Enforced by the backend (RBAC + Postgres RLS); the frontend only hides UI. */
  roles: Access[];
  /** SRS requirement ids this endpoint satisfies */
  srs?: string[];
  /** Name of the request body type in `lib/types.ts` / `lib/api/contracts.ts` */
  request?: string;
  /** Name of the response type */
  response: string;
  /** Query string parameters, documented as `name: type` */
  query?: string[];
  /** Domain events the backend should publish on success (Redis/BullMQ, SRS 2.2.3) */
  emits?: string[];
  /** Must accept offline replay (Idempotency-Key, SRS 2.2.1) */
  offline?: boolean;
  /** Returns Page<T> */
  paginated?: boolean;
  notes?: string;
}

export interface CallArgs {
  params?: Record<string, string | number>;
  query?: Record<string, unknown>;
  body?: unknown;
  signal?: AbortSignal;
  idempotencyKey?: string;
}

export interface MockContext<A extends CallArgs> {
  args: A;
  /** The demo user for the current session, or null when signed out */
  user: User | null;
  /** Throw this for 4xx-style failures in mocks */
  fail: (status: number, code: string, message: string) => never;
}

export type Endpoint<R, A extends CallArgs> = ((args?: A) => Promise<R>) & { meta: EndpointMeta };

const registry: EndpointMeta[] = [];
export const endpointRegistry = () => registry;

let currentUser: () => User | null = () => null;
/** Wired up by the session provider so mocks know who is calling. */
export const setMockUserResolver = (fn: () => User | null) => { currentUser = fn; };

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export function defineEndpoint<R, A extends CallArgs = CallArgs>(
  meta: EndpointMeta,
  mock: (ctx: MockContext<A>) => R | Promise<R>,
): Endpoint<R, A> {
  if (registry.some(m => m.id === meta.id)) throw new Error(`Duplicate endpoint id ${meta.id}`);
  registry.push(meta);

  const call = (async (args?: A) => {
    const a = (args ?? {}) as A;
    if (API_MODE === 'live') {
      const url = buildUrl(meta.service, meta.path, a.params, a.query);
      return request<R>(url, { method: meta.method, body: a.body, signal: a.signal, idempotencyKey: a.idempotencyKey });
    }
    await sleep(MOCK_LATENCY_MS * (meta.method === 'GET' ? 1 : 1.6));
    const user = currentUser();
    if (!meta.roles.includes('public') && !user) throw new ApiError(401, 'unauthenticated', 'Please sign in');
    if (user && !meta.roles.includes('public') && !meta.roles.includes('authenticated') && !meta.roles.includes(user.role)) {
      throw new ApiError(403, 'forbidden', 'You do not have access to this');
    }
    const fail = (status: number, code: string, message: string): never => { throw new ApiError(status, code, message); };
    // structuredClone so components never mutate the mock database by accident
    const out = await mock({ args: a, user, fail });
    return out === undefined ? out : structuredClone(out);
  }) as Endpoint<R, A>;

  call.meta = meta;
  return call;
}

/** Standard paginated list envelope (SRS NFR-BW.5). */
export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export function paginate<T>(items: T[], query?: Record<string, unknown>, pageSize = 20): Page<T> {
  const page = Math.max(1, Number(query?.page ?? 1));
  const size = Math.max(1, Number(query?.pageSize ?? pageSize));
  return { items: items.slice((page - 1) * size, page * size), page, pageSize: size, total: items.length };
}
