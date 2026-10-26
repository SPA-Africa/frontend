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

## Validate

```sh
cd web
npm run typecheck
npm run build
```
