# SHAPE Potential Africa web app

The frontend for the SPA Digital Platform: Next.js (App Router), Tailwind CSS and TypeScript, as set out in the SRS. One app serves the public site and six role-based portals, and talks to the backend microservices through one API gateway.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000, mock mode (no backend needed)
npm run build        # production build
npm run api:docs     # regenerate docs/API_ENDPOINTS.md from the service files
```

Sign in at `/login` and pick a demo account to enter any portal. To use real services, copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_API_MODE=live`.

| Role | Area |
| --- | --- |
| Learner | `/app` |
| Organisation | `/org` |
| Pillar Representative | `/console` |
| Judge / Mentor | `/judge` |
| Executive Office | `/admin` |
| Board of Trustees | `/board` (read-only) |

## For the backend team

Start with [`docs/BACKEND_HANDOFF.md`](docs/BACKEND_HANDOFF.md), then [`docs/API_ENDPOINTS.md`](docs/API_ENDPOINTS.md) (139 endpoints across core-svc and ai-svc). The gateway config and a docker-compose for the full stack are in [`infra/`](infra/).

## Where things live

| Path | What |
| --- | --- |
| `app/` | Public pages; `app/(portals)/<area>/` portal pages |
| `lib/api/services/core/*`, `lib/api/services/ai/*` | Every backend call, one file per domain, grouped by microservice |
| `lib/api/define.ts`, `http.ts`, `hooks.ts` | Endpoint registry, fetch client (auth, refresh, trace id, idempotency), React data hooks |
| `lib/api/mock/*` | Mock database used in mock mode, persisted in the browser |
| `lib/i18n/` | English, French and Kinyarwanda strings (`messages/*.ts`); Kinyarwanda glossary and review notes in `docs/i18n/` |
| `components/dash/` | Dashboard kit: panels, KPI tiles, charts, DataTable, course covers, status pills, loading and error states |
| `components/ui/` | Base controls: buttons, fields, tabs, modal, toast |
| `components/shell/` | Site header and footer, portal sidebar and top bar, route map |
| `infra/` | Nginx gateway config, docker-compose, see also `Dockerfile` |

## Design rules

- Colours only from the tokens in `app/globals.css`, so light and dark themes both work. Public pages are pure white; portals sit on a warm canvas with white panels.
- Headings use Bricolage Grotesque (`font-display`), body text uses Manrope.
- Short, plain headings and copy. No em or en dashes in visible text. Every label goes through `useT()` with English, French and Kinyarwanda (all three are required by the type checker). Format dates with `fmtDate` from `lib/format.ts`.
- Pages fetch only through `lib/api/services` with `useApi` and show skeletons while loading.
