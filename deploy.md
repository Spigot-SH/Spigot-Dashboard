# deploy.md — Spigot-Dashboard on Railway

Read the mother folder's `DEPLOY.md` first: it has the order and the cross-service wiring.
This service needs the backend (`Spigot-Algorand`) deployed and healthy.

## 1. Service

In the **same Railway project as the backend**: **New** → **GitHub Repo** → `Spigot-SH/Spigot-Dashboard`.

| Setting        | Value                                              |
| -------------- | -------------------------------------------------- |
| Service name   | `dashboard`                                        |
| Root Directory | blank — the app is at the repo root                |
| Config file    | `railway.toml` (detected automatically)            |
| Build          | `npm ci && npm run build` (from `railway.toml`)    |
| Start          | `npm run start` — Next listens on Railway's `PORT` |

`npm ci` needs `package-lock.json` — it is in the repo; commit it.

**Settings → Networking → Generate Domain** (or attach `app.<your domain>`). This is the URL
users visit.

## 2. Variables

| Variable                               | Value                                       | Scope            |
| -------------------------------------- | ------------------------------------------- | ---------------- |
| `BACKEND_ORIGIN`                       | `http://backend.railway.internal:4402`      | server-side only |
| `NEXT_PUBLIC_ALGORAND_NETWORK_PROFILE` | `testnet`                                   | browser          |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`         | same as backend `GOOGLE_CLIENT_ID`, if used | browser          |
| `NEXT_PUBLIC_GATEWAY_URL`              | backend public URL, `https://…`             | browser          |

- `BACKEND_ORIGIN` uses the **private network**: service name `backend` + the port the backend
  pins (`PORT=4402`). Both services must be in one Railway project. The backend's public
  `https://` domain also works; it is just a slower round trip.
- `NEXT_PUBLIC_GATEWAY_URL` is the gateway origin shown to publishers in the onboarding
  preview. Unset, it shows the Dashboard's own origin — which also works, because `/x402` is
  rewritten to the backend, but the backend domain is the honest answer.
- **Do not set `NEXT_PUBLIC_BACKEND_URL`.** Next rewrites `/api`, `/x402`, `/nanopay` and `/pay` to
  `BACKEND_ORIGIN`, so the browser stays on this origin and the `SameSite=Lax` session cookie
  is sent on every call. Setting it makes calls cross-origin; the browser drops the cookie —
  sign-in appears to work and every later request is unauthenticated.
- **Every variable here is frozen at build time, `BACKEND_ORIGIN` included.** `next build` writes
  the rewrite targets into `.next/routes-manifest.json`, and `next start` reads that file, not
  the environment. Set all variables **before the first build**; changing one needs a
  **redeploy** (rebuild), not a restart. Measured 2026-09-19: a build made without
  `BACKEND_ORIGIN`, started with it set, still proxied to `127.0.0.1:4402`.

## 3. Tell the backend where this lives

On the **backend** service set `APP_BASE_URL=https://<this service's domain>` and restart it.
That value is the magic-link redirect target and the backend's only production CORS origin.

## 4. Check

```bash
APP=https://<dashboard domain>
curl -s $APP/api/health   # {"status":"ok","network":"testnet",…} → the rewrite reaches the backend
```

Then in a browser: sign in by email code, reload, still signed in.

### The homepage may be empty on the first deploy

`/` lists marketplace APIs from the backend. `getMarketplaceApis()` returns `[]` rather than
throwing when the backend is unreachable, so an empty list right after a deploy is
recoverable, not a fault. Still empty after a few minutes → check `BACKEND_ORIGIN` and backend
health.

## Troubleshooting

| Symptom                                              | Cause                                                                                                                                                                                   |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/*` returns 500/502, or calls go to `127.0.0.1` | `BACKEND_ORIGIN` unset **at build time** (set it, then redeploy), backend service not named `backend`, backend `PORT` not `4402`, or the two services are in different Railway projects |
| Signed in, but every request is unauthenticated      | `NEXT_PUBLIC_BACKEND_URL` is set. Unset it and redeploy                                                                                                                                 |
| Magic link opens the wrong site                      | Backend `APP_BASE_URL` does not match this domain                                                                                                                                       |
| Build fails on `@walletconnect/*` or `lute-connect`  | A wallet was added without installing its package or removing it from the alias list in `next.config.ts`                                                                                |
| Build fails type-checking `stealth-ref/`             | `stealth-ref` was removed from `exclude` in `tsconfig.json`                                                                                                                             |
| Wallet top-up connects to the wrong network          | `NEXT_PUBLIC_ALGORAND_NETWORK_PROFILE` differs from the backend profile; fix and **redeploy**                                                                                           |
