# Reach Social — SPA

Chakra UI v2 + React 18 + Vite + TypeScript. Lives alongside `../client/`
(the legacy vanilla pages) during cohabitation; will replace it once
the four-page flow ships at parity.

## Local dev

```
cd app
npm install
npm run dev
```

Opens at http://localhost:5173. API and auth requests are proxied to
the Render backend via `vite.config.ts`. Override the target with:

```
VITE_BACKEND_URL=http://localhost:3000 npm run dev
```

## Phase status

- [x] Phase 1 — Vite + Chakra theme scaffold (this drop)
- [ ] Phase 2 — App shell, sidebar, stepper, placeholder routes
- [ ] Phase 3 — Auth + brand context + brand picker
- [ ] Phase 4+ — Page rebuilds (Brand, Upload, Detect, Ad Generation)

## Layout

```
app/
  src/
    main.tsx                 # entry point, wires ChakraProvider
    App.tsx                  # placeholder until Phase 2
    theme/
      reachSocialTheme.ts    # color tokens + component variants
  index.html                 # Vite-served HTML shell
  vite.config.ts             # dev proxy + build settings
  tsconfig.json              # strict TS config
  package.json
```

## Deploy

Phase 1 is local-dev only. Netlify still serves `client/` for prod.
Deploy wiring lands in a later phase once the SPA actually owns the
routes it claims.
