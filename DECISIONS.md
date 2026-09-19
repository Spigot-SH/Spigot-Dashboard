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

## 2026-09-20 — Settings and Analytics show only what the backend returned

**Decided:** `SettingsView.tsx` no longer falls back to the literal `'pk_test_spigot_pub_default_key'`. With no key it shows "No API key yet." and a button that calls the existing `POST /publishers`, which is idempotent and returns `{ id, api_key }`. `AnalyticsView.tsx` lost both charts, the hover tooltip and the 24h/7d/30d toggle (440 lines to 188). The status card keeps one error row, "Errors (4xx and 5xx)", and the hardcoded `0.0%` 5xx row is gone. With zero requests the success rate reads "—", not a default 100%. `scripts/security-review.sh` S1.1 now includes `pk_test_`. `src/api/client.ts` lost the `NEXT_PUBLIC_BACKEND_URL` override: `BASE_URL` is the constant `'/api'`, so the first invariant in `AGENTS.md` can no longer be broken by configuration; the variable is gone from `.env.example` and `deploy.md`.
**Why:** Both views presented invented values as real. A signed-in user with no key saw the literal in the "Publisher API Key" card with working reveal and copy buttons. The charts spread all-time totals through `Math.sin(i * 0.8)` and `Math.cos(i * 0.5)` and the tooltip reported the result per hour as "Requests" and "Revenue USDC"; the source comment read "Synthesize consistent timeline buckets". `GET /dashboard/:id` returns totals, a success rate (`status_code < 400`) and per-endpoint rows, with no time buckets and no 4xx/5xx split, so there is no series to draw. The review passed throughout: S1.1 listed `sk_test_` and `pk_live_` but not `pk_test_`, and S9.3 looks only for `Math.random`/`Date.now`. After the fix `grep -rn 'pk_test_' src` and `grep -rnE 'Math\.(sin|cos)' src` return nothing, `npm run verify` exits 0 and the review prints 15 passed, 0 failed, 0 unverified. A planted `'pk_test_planted'` literal produced 1 FAIL; removing it returned 15/0/0.
**Rejected:** a new key-issuing endpoint (the existing POST already returns the key); keeping a chart fed by synthesized buckets under a "sample" label (the same figure that misled, with a caption); a `Math.sin` grep in the review (a heuristic for one spelling of the bug).
**Files:** `src/components/dashboard/SettingsView.tsx`, `src/components/dashboard/AnalyticsView.tsx`, `src/api/client.ts`, `.env.example`, `scripts/security-review.sh`, `AGENTS.md`, `deploy.md`, `DECISIONS.md`.
**Ref:** a372bac.

## 2026-09-20 — Recorded after the fact: commit 6b0a991 removed demo mode and the access lock

**Decided:** This entry records a reversal that shipped without one. Commit `6b0a991` deleted `DEMO_STATS`, the `/dashboard/demo` preview, the "Explore Demo Dashboard" button and the "Dashboard Access Restricted" card, and added `ApisView`, `AnalyticsView` and `SettingsView`. `Dashboard.tsx` now registers a publisher for a signed-in user on first load instead of showing a lock screen. The entry below, "Dashboard access restriction unblocked", describes code that no longer exists.
**Why:** An audit on 2026-09-20 found the log and the tree disagreeing: `grep -rn "DEMO_STATS\|Access Restricted\|Explore Demo" src/` returns nothing, and `git show --stat 6b0a991` lists 8 source files, +1169/−417, with `DECISIONS.md` untouched. The commit message gives the intent as "remove access restrictions, eliminate demo stats". The author should confirm or correct that reason when signing.
**Files:** `DECISIONS.md` (the code change itself is commit `6b0a991`).
**Ref:** a372bac.

## 2026-09-19 — Dashboard access restriction unblocked: 1-click register and demo fallback

**Decided:** Added `src/app/dashboard/page.tsx` resolving `/dashboard` to `/dashboard/active`. In `src/views/Dashboard.tsx`, added demo dashboard preview mode (`DEMO_STATS`, `/dashboard/demo`), an "Explore Demo Dashboard" button, and a 1-click "Register as Publisher" action on the access restricted card for signed-in users. Added `credentials: 'include'` to `apiClient.registerPublisher`.
**Why:** Unregistered or offline visitors to `/dashboard` were hit with an unskippable "Dashboard Access Restricted" lock screen requiring a 10-step onboarding process, while `/dashboard` alone returned a 404. On demo mode, users can inspect endpoint metrics, balances, settlement history, and health stats without full on-chain onboarding.
**Rejected:** Silently showing demo stats without a banner (confuses real live data with demo figures; banner makes mode explicit).
**Files:** `src/app/dashboard/page.tsx`, `src/views/Dashboard.tsx`, `src/api/client.ts`, `DECISIONS.md`.
**Ref:** ac9b3a7.

## 2026-09-19 — Lint and format work again; TypeScript back on 5.x (`^5.9.3`)

**Decided:** Added `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore` (same rules as `Spigot-Website`, with `stealth-ref/` and `local/` ignored), the dev dependencies they need, and `format`, `format:check`, `lint:fix` and `verify` scripts. `typescript` moves from `^7.0.2` to `^5.9.3`.
**Why:** `npm run lint` exited 127 — `eslint: command not found`. In the x402 monorepo ESLint, Prettier and their config lived in the workspace root, so the seeded `frontend/` folder carried a `lint` script with nothing behind it. `typescript-eslint` 8 declares `typescript >=4.8.4 <6.1.0`, so TypeScript 7 made the install fail with `ERESOLVE`. On 5.9: lint 0 problems, typecheck 0, build prints the same route table, `scripts/security-review.sh` 15/0/0. No source file needed a change.
**Rejected:** `--legacy-peer-deps` to keep TypeScript 7 (an unsupported parser under the linter is how false negatives start; nothing in `src/` uses a 7-only feature — typecheck is clean on 5.9); skipping lint in this repo (it is the repo with auth, wallets and money UI).
**Files:** `eslint.config.mjs` (new), `.prettierrc.json` (new), `.prettierignore` (new), `package.json`, `package-lock.json`, `AGENTS.md`.
**Ref:** eb74d3d.

## 2026-09-19 — The UI half of the security review lives here

**Decided:** `scripts/security-review.sh` with the UI checks from the x402 script: secret literals, secret values in `.next/static`, `NEXT_PUBLIC_` secrets, `eval`, raw HTML injection, `catch (e: any)`, empty catches, `npm audit`, and the four S9 silent-failure checks.
**Why:** the original script lived in the monorepo root and checked `frontend/`; after the split nothing checked this code. Run after a build: 15 passed, 0 failed, 0 unverified. A planted file (`NEXT_PUBLIC_ADMIN_TOKEN`, `dangerouslySetInnerHTML`, `catch {}`, `bg-red-500`) produced 4 FAILs, and removing it returned exit 0.
**Files:** `scripts/security-review.sh` (new), `security-log/` (new), `AGENTS.md`.
**Ref:** eb74d3d.

## 2026-09-19 — `BACKEND_ORIGIN` is a build-time value; the deploy guide said runtime

**Decided:** `deploy.md`, `.env.example` and the mother folder's `DEPLOY.md` now say every Dashboard variable, `BACKEND_ORIGIN` included, must be set before the build and needs a redeploy to change. No code change.
**Why:** the guide inherited from `x402-algorand` said "`BACKEND_ORIGIN` is read at runtime, so a restart picks it up". Measured: a build made with no `BACKEND_ORIGIN`, started with `BACKEND_ORIGIN=http://127.0.0.1:4410`, answered `/api/health` with 500 and logged `ECONNREFUSED 127.0.0.1:4402` — the default frozen into `.next/routes-manifest.json`. After rebuilding with the variable set, `/api/health` through the rewrite returned the backend's JSON with 200. Same session, PRIORITY P1-6 checked as far as it can be without funds: sign-in by emailed code through the rewrite returns the user, sets an `HttpOnly` `x402_session` cookie, `/api/auth/me` returns the user with the cookie and `{"user":null}` without it. The backend was an isolated instance (own database, no treasury keys), so nothing on-chain moved. Not checked: credit top-up and a paid call — both need a funded testnet wallet and settle real testnet transactions.
**Rejected:** moving the proxy into a runtime Route Handler so the origin could change without a rebuild (the rewrite passes payment headers and bodies through byte-for-byte, which is why it is a rewrite; Railway exposes service variables at build time, so the constraint costs one redeploy).
**Files:** `deploy.md`, `.env.example`.
**Ref:** eb74d3d.

## 2026-09-19 — Rules, decisions log, `.gitignore`, lockfile and a Railway config that matches this repo

**Decided:** Added `AGENTS.md`, `CLAUDE.md`, this file (replacing `discuss.md`, entries carried over), `.gitignore`, `deploy.md` and `package-lock.json`. `railway.toml` now builds from the repo root (`npm ci && npm run build` at the time; since `ac9b3a7` the install, `npm ci --include=dev`, and the Node 22 pin live in `nixpacks.toml` and `railway.toml` runs `npm run build`). `tsconfig.json` excludes `stealth-ref`.
**Why:** The repo had no `.gitignore` and no lockfile, and `railway.toml` still ran `cd .. && npm ci && npm run build --workspace=frontend` for a monorepo that no longer exists — `npm ci` fails without a lockfile. First real build here failed type-checking `stealth-ref/web/routes.ts` (`Cannot find module 'hono'`); after the exclude, `npm run build` prints the route table (`/`, `/dashboard/[publisherId]/[[...section]]`, `/onboarding`, `/profile`, `/test/[apiSlug]`).
**Rejected:** installing `hono` so the reference code compiles (it is reference only and never imported); deleting `stealth-ref/` (the user wants it kept as an idea source).
**Files:** `.gitignore`, `AGENTS.md`, `CLAUDE.md`, `DECISIONS.md`, `deploy.md`, `railway.toml`, `tsconfig.json`, `package-lock.json`, `discuss.md` (moved to the ignored `local/` folder).
**Ref:** eb74d3d.

## 2026-09-18 — Seeded with the full x402 frontend at the repo root

**Decided:** Copied `frontend/` from `x402-algorand` to the root (Next 16, React 19, wallets, credits, marketplace), excluding `node_modules` and `.next`. `stealth-ref/` holds the stealth web dashboard plus its `PRD.md` and `SPEC.md` as reference.
**Why:** That frontend is the app. `Spigot-Website` is a stripped fork of the same code and stays marketing-only.
**Rejected:** merging the stealth web code into the app (vanilla HTML against Next — different stack).
**Files:** whole repo.
**Ref:** eb74d3d.

## Tried and rejected — do not re-propose

| Idea                                                            | Why it is dead                                                                                                                                           | Ref                             |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Merging `stealth-ref/` web code into `src/`                     | Different stack (vanilla HTML vs Next); it is an idea source, not a dependency                                                                           | 2026-09-18                      |
| Setting `NEXT_PUBLIC_BACKEND_URL` to reach the backend directly | Calls become cross-origin and the `SameSite=Lax` session cookie is dropped; sign-in looks fine and every later request is unauthenticated                | inherited from x402 `deploy.md` |
| Treating `BACKEND_ORIGIN` as a runtime setting                  | `next start` reads rewrite targets from the build manifest; a restart with a new value still proxies to the old one                                      | 2026-09-19                      |
| Drawing a traffic chart from totals shaped by a curve           | The backend returns no time buckets; the tooltip reported invented per-hour figures as measured. Draw a series only when `GET /dashboard/:id` serves one | 2026-09-20                      |
| A placeholder API key literal as the last fallback              | It was displayed as the user's own key with working copy and reveal buttons. No key means an empty state                                                 | 2026-09-20                      |
