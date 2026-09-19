# DECISIONS.md — Spigot-Dashboard

Why this repo looks the way it does. Newest first.

**Read the "Tried and rejected" table at the bottom before proposing anything.**

**When to add an entry:** a session made a real choice — rejected an alternative, hit a
constraint that shaped the design, or reversed an earlier decision. Not for mechanical work.
If you cannot fill in **Why**, there is no entry to write.

**Format:**

```markdown
## YYYY-MM-DD — one line, what changed

**Decided:** what was done.
**Why:** the problem, with the evidence that proved it (command + output, number, file:line).
**Rejected:** what else was considered, and what killed it. Omit if nothing was.
**Files:** paths.
**Ref:** commit hash, or "uncommitted". Agents always write "uncommitted"; the user fills the hash when signing.
```

---

## 2026-09-19 — Dashboard access restriction unblocked: 1-click register and demo fallback

**Decided:** Added `src/app/dashboard/page.tsx` resolving `/dashboard` to `/dashboard/active`. In `src/views/Dashboard.tsx`, added demo dashboard preview mode (`DEMO_STATS`, `/dashboard/demo`), an "Explore Demo Dashboard" button, and a 1-click "Register as Publisher" action on the access restricted card for signed-in users. Added `credentials: 'include'` to `apiClient.registerPublisher`.
**Why:** Unregistered or offline visitors to `/dashboard` were hit with an unskippable "Dashboard Access Restricted" lock screen requiring a 10-step onboarding process, while `/dashboard` alone returned a 404. On demo mode, users can inspect endpoint metrics, balances, settlement history, and health stats without full on-chain onboarding.
**Rejected:** Silently showing demo stats without a banner (confuses real live data with demo figures; banner makes mode explicit).
**Files:** `src/app/dashboard/page.tsx`, `src/views/Dashboard.tsx`, `src/api/client.ts`, `DECISIONS.md`.
**Ref:** uncommitted.

## 2026-09-19 — Lint and format work again; TypeScript aligned with the Website at 5.8

**Decided:** Added `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore` (same rules as `Spigot-Website`, with `stealth-ref/` and `local/` ignored), the dev dependencies they need, and `format`, `format:check`, `lint:fix` and `verify` scripts. `typescript` moves from `^7.0.2` to `^5.8.2`.
**Why:** `npm run lint` exited 127 — `eslint: command not found`. In the x402 monorepo ESLint, Prettier and their config lived in the workspace root, so the seeded `frontend/` folder carried a `lint` script with nothing behind it. `typescript-eslint` 8 declares `typescript >=4.8.4 <6.1.0`, so TypeScript 7 made the install fail with `ERESOLVE`. On 5.8: lint 0 problems, typecheck 0, build prints the same route table, `scripts/security-review.sh` 15/0/0. No source file needed a change.
**Rejected:** `--legacy-peer-deps` to keep TypeScript 7 (an unsupported parser under the linter is how false negatives start; nothing in `src/` uses a 7-only feature — typecheck is clean on 5.8); skipping lint in this repo (it is the repo with auth, wallets and money UI).
**Files:** `eslint.config.mjs` (new), `.prettierrc.json` (new), `.prettierignore` (new), `package.json`, `package-lock.json`, `AGENTS.md`.
**Ref:** uncommitted.

## 2026-09-19 — The UI half of the security review lives here

**Decided:** `scripts/security-review.sh` with the UI checks from the x402 script: secret literals, secret values in `.next/static`, `NEXT_PUBLIC_` secrets, `eval`, raw HTML injection, `catch (e: any)`, empty catches, `npm audit`, and the four S9 silent-failure checks.
**Why:** the original script lived in the monorepo root and checked `frontend/`; after the split nothing checked this code. Run after a build: 15 passed, 0 failed, 0 unverified. A planted file (`NEXT_PUBLIC_ADMIN_TOKEN`, `dangerouslySetInnerHTML`, `catch {}`, `bg-red-500`) produced 4 FAILs, and removing it returned exit 0.
**Files:** `scripts/security-review.sh` (new), `security-log/` (new), `AGENTS.md`.
**Ref:** uncommitted.

## 2026-09-19 — `BACKEND_ORIGIN` is a build-time value; the deploy guide said runtime

**Decided:** `deploy.md`, `.env.example` and the mother folder's `DEPLOY.md` now say every Dashboard variable, `BACKEND_ORIGIN` included, must be set before the build and needs a redeploy to change. No code change.
**Why:** the guide inherited from `x402-algorand` said "`BACKEND_ORIGIN` is read at runtime, so a restart picks it up". Measured: a build made with no `BACKEND_ORIGIN`, started with `BACKEND_ORIGIN=http://127.0.0.1:4410`, answered `/api/health` with 500 and logged `ECONNREFUSED 127.0.0.1:4402` — the default frozen into `.next/routes-manifest.json`. After rebuilding with the variable set, `/api/health` through the rewrite returned the backend's JSON with 200. Same session, PRIORITY P1-6 checked as far as it can be without funds: sign-in by emailed code through the rewrite returns the user, sets an `HttpOnly` `x402_session` cookie, `/api/auth/me` returns the user with the cookie and `{"user":null}` without it. The backend was an isolated instance (own database, no treasury keys), so nothing on-chain moved. Not checked: credit top-up and a paid call — both need a funded testnet wallet and settle real testnet transactions.
**Rejected:** moving the proxy into a runtime Route Handler so the origin could change without a rebuild (the rewrite passes payment headers and bodies through byte-for-byte, which is why it is a rewrite; Railway exposes service variables at build time, so the constraint costs one redeploy).
**Files:** `deploy.md`, `.env.example`.
**Ref:** uncommitted.

## 2026-09-19 — Rules, decisions log, `.gitignore`, lockfile and a Railway config that matches this repo

**Decided:** Added `AGENTS.md`, `CLAUDE.md`, this file (replacing `discuss.md`, entries carried over), `.gitignore`, `deploy.md` and `package-lock.json`. `railway.toml` now builds with `npm ci && npm run build` from the repo root. `tsconfig.json` excludes `stealth-ref`.
**Why:** The repo had no `.gitignore` and no lockfile, and `railway.toml` still ran `cd .. && npm ci && npm run build --workspace=frontend` for a monorepo that no longer exists — `npm ci` fails without a lockfile. First real build here failed type-checking `stealth-ref/web/routes.ts` (`Cannot find module 'hono'`); after the exclude, `npm run build` prints the route table (`/`, `/dashboard/[publisherId]/[[...section]]`, `/onboarding`, `/profile`, `/test/[apiSlug]`).
**Rejected:** installing `hono` so the reference code compiles (it is reference only and never imported); deleting `stealth-ref/` (the user wants it kept as an idea source).
**Files:** `.gitignore`, `AGENTS.md`, `CLAUDE.md`, `DECISIONS.md`, `deploy.md`, `railway.toml`, `tsconfig.json`, `package-lock.json`, `discuss.md` (moved to the ignored `local/` folder).
**Ref:** uncommitted.

## 2026-09-18 — Seeded with the full x402 frontend at the repo root

**Decided:** Copied `frontend/` from `x402-algorand` to the root (Next 16, React 19, wallets, credits, marketplace), excluding `node_modules` and `.next`. `stealth-ref/` holds the stealth web dashboard plus its `PRD.md` and `SPEC.md` as reference.
**Why:** That frontend is the app. `Spigot-Website` is a stripped fork of the same code and stays marketing-only.
**Rejected:** merging the stealth web code into the app (vanilla HTML against Next — different stack).
**Files:** whole repo.
**Ref:** uncommitted.

## Tried and rejected — do not re-propose

| Idea                                                            | Why it is dead                                                                                                                            | Ref                             |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Merging `stealth-ref/` web code into `src/`                     | Different stack (vanilla HTML vs Next); it is an idea source, not a dependency                                                            | 2026-09-18                      |
| Setting `NEXT_PUBLIC_BACKEND_URL` to reach the backend directly | Calls become cross-origin and the `SameSite=Lax` session cookie is dropped; sign-in looks fine and every later request is unauthenticated | inherited from x402 `deploy.md` |
| Treating `BACKEND_ORIGIN` as a runtime setting                  | `next start` reads rewrite targets from the build manifest; a restart with a new value still proxies to the old one                       | 2026-09-19                      |
