# Shape Potential Africa frontend

This repository contains the Shape Potential Africa website and platform frontend.

- `index.html`, `css/`, `js/`, and `assets/`: static landing page.
- `web/`: Next.js application with the public site and role-based portals.

## Run the application

```sh
cd web
npm ci
npm run dev
```

Open http://localhost:3000. See [web/README.md](web/README.md) for configuration, portal details, and backend integration documentation.

## Run against the backend

The NestJS API lives in `../spa-backend`. `web/.env.local` switches the app to live mode and forwards
`/api/*` and `/media/*` to it on port 8080:

```sh
cd ../spa-backend
npm install && npm run db:setup   # needs PostgreSQL; see spa-backend/README.md
npm run start:dev                 # http://localhost:8080
cd ../frontend/web
npm run dev                       # sign in with aline@example.com / SpaDemo!2026 (other demo accounts in the backend README)
```

Remove `web/.env.local` (or set `NEXT_PUBLIC_API_MODE=mock`) to go back to the in-browser mock data.

## Validate

```sh
cd web
npm run typecheck
npm run build
```
