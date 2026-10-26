// Runtime configuration for talking to the SPA microservices.
// All traffic goes through the Nginx API gateway (SRS 2.2.2):
//   /api/core/*  -> NestJS Core Microservice   (identity, LMS, pitch, agri-market, capacity, governance)
//   /api/ai/*    -> FastAPI AI & Analytics      (recommendations, scoring, routing, M&E metrics)
//   /media/*     -> signed redirect to MinIO    (never exposed directly)

export type ApiMode = 'mock' | 'live';

export const API_MODE: ApiMode = process.env.NEXT_PUBLIC_API_MODE === 'live' ? 'live' : 'mock';

/** Gateway origin. Empty string means same origin (Next.js rewrites /api/* to the gateway). */
export const GATEWAY_URL = (process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? '').replace(/\/$/, '');

export const SERVICE_PREFIX = {
  core: '/api/core',
  ai: '/api/ai',
  media: '/media',
} as const;

export type Service = keyof typeof SERVICE_PREFIX;

/** Simulated network delay in mock mode so loading states are visible. */
export const MOCK_LATENCY_MS = Number(process.env.NEXT_PUBLIC_MOCK_LATENCY_MS ?? 220);

/** Default page size for list endpoints (SRS NFR-BW.5). */
export const DEFAULT_PAGE_SIZE = 20;
