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

## 2026-09-20 — Marketplace shows a dash for unmeasured uptime and latency; guests get a sign-in prompt, not zeros

**Decided:** `normaliseApi` in `src/api/marketplace.ts` keeps `uptime` and `avgLatency` as `null` when the backend sends none, and `MarketplaceApi` types both as `number | null`. `Marketplace.tsx` prints a dash for `null`, otherwise the latency rounded to a millisecond and the uptime to one decimal. A measured 0 stays 0. In `src/views/Dashboard.tsx` a signed-out visitor still reaches `/dashboard` and still sees the "Guest Mode" banner and the sidebar, but the four sections are replaced by "Sign in to see your dashboard" with a sign-in button.
**Why:** `GET /api/apis` computes both values from `health_checks` (`Spigot-Algorand/backend/src/routes/apis.ts:77-78`), so an API with no health check gets `NULL` for each. The client turned that into `Number(api.uptime ?? 100)` and `Number(... ?? 0)`, and the public home page showed "100%" and "0ms" for an API nobody had measured. On the dashboard, commit `6b0a991` opened the page to guests and rendered the overview, APIs, analytics and settings sections from `EMPTY_STATS` (its lines 182, 186, 188 and 190, the four `activeSection === ...` conditions), so a visitor with no account read "0.00 USDC available, 0 requests" as if it were an account. Those four conditions now also require `signedIn`; the routing and the banner from `6b0a991` are unchanged. Checked: `normaliseApi` run with `tsx` returns `null`/`null` for no health checks, `66.6666667`/`123.456` for measured values and `0`/`0` for a measured zero. In a browser with no backend behind the dev server, `/dashboard` stayed on `/dashboard` and showed the banner and the prompt, with no "Available Balance", "Requests this month" or "Success Rate" on the page and no error card. `npm run verify` exits 0 and the review prints 15 passed, 0 failed, 0 unverified. `grep -rnE '\?\? 100|\|\| 100' src` returns nothing.
**Rejected:** redirecting guests away from `/dashboard` (that would undo the routing choice in `6b0a991`; only the invented zeros were the problem); hiding the uptime and latency tiles when unmeasured (a dash says "not measured yet", a missing tile says nothing); defaulting `pricePerRequest` differently (publishing already requires pricing, `routes/apis.ts` returns 400 without it, so a published API always has a price).
**Files:** `src/api/marketplace.ts`, `src/api/client.ts`, `src/views/Marketplace.tsx`, `src/views/Dashboard.tsx`, `DECISIONS.md`.
**Ref:** a8e952a.

## 2026-09-20 — Know-the-user form, provider checklist, and a dashboard that shows only what loaded

**Decided:** New `/welcome` (`src/views/Welcome.tsx`): four optional questions (intent, role, monthly volume, payout need), saved with `PATCH /api/auth/me`. `WelcomeGate` in `providers.tsx` sends a signed-in user with an empty profile there once; skipping is stored, and saving with nothing picked counts as a skip. Each answer changes one thing, and the form says which: intent picks the landing page (`/start` or the marketplace), role picks the checklist's opening line, volume is read back on the API step, and payout moves the wallet step to position 2. New `/start` (`src/views/Start.tsx`): six steps over the existing wizard, each marked from backend data only, with three states (done, not yet, could not check). "Publish API" in the header now opens `/start`. In `Dashboard.tsx`, "Total Requests" became "Requests this month" with "Today" under it, the "Uptime (30d) 100%" row and the fixed 45% latency bar are gone, the health badge reads "No health check has run yet" until the backend reports one, success rate and latency show a dash until an endpoint has traffic, and the view now has three separate states instead of zeros: signed out (the guest view), signed in with no publisher ("No publisher account yet", with a link to `/start`), and a failed load (an error with "Try again" and no figures). In `AnalyticsView.tsx` the sub-lines "100% delivered via x402", "Instant settlement enabled", "End-to-end edge proxy" and "HTTP 2xx response ratio" became plain descriptions of each number, and `ApisView.tsx` now says "Each call is paid on chain before it is proxied", which is what `Spigot-Algorand/SECURITY.md` states.
**Why:** The user asked for the three pages with one hard rule: real totals and empty states only. Four invented figures were still on the overview, all from commit `6b0a991` (changed with the user's answer under rule 3.1). `totalRequests` was `requests_today + requests_month`, which counts today twice and is not a total. `uptime: 100` was a constant; the backend sends no uptime. `'ONLINE'` was the default on both sides when no health check exists. Success rate fell back to 100. The `catch` block also set `EMPTY_STATS`, so a failed request rendered as "0.00 USDC available, 0 requests". A read-only verifier pass then found "100% delivered via x402" hardcoded at `AnalyticsView.tsx:50`, and found that the new error state swallowed the guest view, because `getDashboard` throws on the 401 a signed-out visitor gets; both are fixed. `success_rate` and `avg_latency` are averages over every request, not this month, so their labels say "all requests" and the gate is endpoint traffic, not `requests_month`. The backend counts `status_code < 400` as success, so "2xx" was wrong. Checked in a browser against an isolated backend: a new user who opened `/dashboard` landed on `/welcome`; four answers were stored and read back from `/api/auth/me`; `/start` listed the wallet step second and "You expect over 1 million calls a month" on the API step; "Create account" linked a publisher and stored a `pk_test_` key; the overview read "REQUESTS THIS MONTH 0 Today: 0 SUCCESS RATE —" with none of "Uptime", "Total Requests", "System ONLINE" or "100%" on the page; with the backend stopped the page read "Could not load your dashboard" and showed no balance or request cards. `npm run verify` exits 0 and the review prints 15 passed, 0 failed, 0 unverified. A Jev pass over the new copy and code scored filler 0.18, invented numbers 0.24, money claims 0.04, single-use abstraction 0.40, duplicated helpers 0.14.
**Rejected:** storing the answers in `localStorage` (they would not follow the account, and "saved on your account" would be false); replacing the ten-step wizard (the checklist links into it instead); keeping a request total by adding the two counters (the backend has no all-time count); drawing the health badge as ONLINE until proven otherwise; Playwright for the UI pass (a new dependency for one run; the pass used the browser directly).
**Files:** `src/views/Welcome.tsx` (new), `src/views/Start.tsx` (new), `src/app/welcome/page.tsx` (new), `src/app/start/page.tsx` (new), `src/app/providers.tsx`, `src/api/auth.ts`, `src/api/client.ts`, `src/views/Dashboard.tsx`, `src/components/dashboard/AnalyticsView.tsx`, `src/components/dashboard/ApisView.tsx`, `src/components/layout/Header.tsx`, `DECISIONS.md`.
**Ref:** a8e952a.

## 2026-09-20 — Held lines re-checked: TypeScript 7, `@types/node` 26 and eslint 10 stay held

**Decided:** No version changed. This entry adds evidence to "Dependencies to latest; TypeScript 6, `stellar-sdk` 17, eslint held at 9" (2026-09-20) and records one finding.
**Why:** `typescript` 7 (latest 7.0.2): every `typescript-eslint` channel still declares `typescript >=4.8.4 <6.1.0`. Checked `latest` 8.70.0, 8.69.0, 8.68.0 and `canary` 8.70.1-alpha.27 with `npm view typescript-eslint@<v> peerDependencies.typescript`; `@typescript-eslint/parser` 8.70.0 and `@typescript-eslint/typescript-estree` print the same range. `eslint` 10 (latest 10.11.0): `eslint-config-next` accepts it (`eslint >=9.0.0` on both 16.3.5 and canary 16.4.0-canary.36), but both versions depend on three plugins whose newest releases stop at 9. `eslint-plugin-react` 7.37.5 peers `^3 || ^4 || ^5 || ^6 || ^7 || ^8 || ^9.7`, `eslint-plugin-import` 2.32.0 peers `^2 || ^3 || ^4 || ^5 || ^6 || ^7.2.0 || ^8 || ^9`, `eslint-plugin-jsx-a11y` 6.10.2 peers `^3 || ^4 || ^5 || ^6 || ^7 || ^8 || ^9`. Their other dist-tags are older (`next` 7.8.0-rc.0, `next` 2.0.0-beta.1, `v5-backport` 5.1.1). Only `eslint-plugin-react-hooks` 7.1.1 lists `^10.0.0`. `@types/node` 26 (latest 26.6.2) needs a Node 26 runtime first: `nixpacks.toml` pins `NIXPACKS_NODE_VERSION = "22"` and `nodejs_22`, and `engines.node` is `>=22`. The Node release schedule (`nodejs/Release/schedule.json`, read 2026-09-20) puts Node 26 LTS on 2026-10-28; Node 24 has been LTS since 2025-10-28 and Node 22 ends on 2027-04-30. A runtime move needs a staging deploy and a boot check, which only the user does. Finding: this repo already carries `@types/node` `^24.13.3` (installed 24.13.6, set in `eb74d3d`) on a Node 22 runtime, so the types are one major ahead of production today. `npm install --no-save @types/node@22.20.4` followed by `npm run typecheck` exited 0, so no code uses a Node 24-only API yet; the tree was restored with `npm ci`.
**Rejected:** `--legacy-peer-deps`, `--force` or `overrides` for TypeScript 7 or eslint 10; taking `@types/node` 26 while production runs Node 22.
**Files:** `DECISIONS.md`.
**Ref:** 3344617.

## 2026-09-20 — Working agreements rewritten as numbered Do / Don't / Why rules

**Decided:** The "Working agreements" half of `AGENTS.md` is replaced, not extended, with five numbered sections: skills, packages, no-fight rules, how work gets done, tools. The same text is in all five Spigot repos. Every earlier rule is kept: no agent commits, testnet only, secrets stay in `.env`, claims match `SECURITY.md`, the decisions log, `local/`, the secret check, user-only deploys. New: Jev thresholds with a no-Jev fallback (rule 1.5), the package buckets and their checks (rules 2.1 to 2.9), and three no-fight rules. Rule 3.1: ask before changing the other person's committed lines. Rule 3.2: report when code and docs disagree, and never edit an old entry. Rule 3.3: one writer per file.
**Why:** Two people run separate agents on these repos and the agents undid each other's work. On 2026-09-19 and 20, commit `6ee10a4` widened the sign-in echo gate the security review had just checked, and S10.4 still passed. Commit `6b0a991` removed the demo mode that the newest Dashboard entry described, with no entry. `Spigot-Website` diverged when `5a68d06` was pushed while `da19b0f` was made locally on the older parent. Two pins by one person (`2a1230e` for `uuid`, `9c610be` for `better-sqlite3`) sat in the path of a package run by the other. The old text said what to do but not how to check whose work a line is, so each rule now names its command: `git blame -L` for ownership, `git fetch` and `git status -sb` before starting, `git log -S` before touching a pin. The package rules record what that run measured: npm 12 blocks install scripts and left `better-sqlite3` 11 without a binary, `uuid` 14 throws `ERR_REQUIRE_ESM` in the CommonJS backend, and `typescript-eslint` 8 declares `typescript <6.1.0`.
**Rejected:** adding the new rules under the old block (two rule sets that overlap can be read two ways); keeping the rules only in the mother folder (it is not a repo and is not cloned with any of them); a `.planning/` folder or codebase-mapper agents for context (Potpie already holds the map: pot `spigot`, local profile).
**Files:** `AGENTS.md`, `DECISIONS.md`.
**Ref:** 3344617.

## 2026-09-20 — Dependencies to latest; TypeScript 6, `stellar-sdk` 17, eslint held at 9

**Decided:** `typescript` `^5.9.3` to `^6.0.3`, `@stellar/stellar-sdk` 16 to `^17.1.0`, spec floors for `@x402/*` moved to `^2.26.0`. `eslint` stays on 9.
**Why:** `npm install -D eslint@^10.11.0 @eslint/js@^10.0.1` fails with `ERESOLVE`: the latest `eslint-plugin-react` (7.37.5, peer `^9.7`), `eslint-plugin-import` (2.32.0, peer `^9`) and `eslint-plugin-jsx-a11y` (6.10.2, peer `^9`), all pulled in by `eslint-config-next`, stop at eslint 9. On TypeScript 6.0.3 and SDK 17.1.0, `npm run verify` exits 0 and the review prints 15 passed, 0 failed, 0 unverified. A read-only Horizon testnet call through SDK 17 returned the latest ledger, and the five symbols `freighterWallet.ts` imports are present. Not checked: a Freighter signing round trip, which needs a browser wallet.
**Rejected:** `--legacy-peer-deps` for eslint 10 (linting through plugins that do not support the host is how false negatives start, the same reason TypeScript 7 was refused); `typescript@7` (`typescript-eslint` supports `<6.1.0`); `@types/node@26` (the runtime is Node 22).
**Files:** `package.json`, `package-lock.json`, `DECISIONS.md`.
**Ref:** 28a0758.

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

| Idea                                                                  | Why it is dead                                                                                                                                              | Ref                             |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Merging `stealth-ref/` web code into `src/`                           | Different stack (vanilla HTML vs Next); it is an idea source, not a dependency                                                                              | 2026-09-18                      |
| Setting `NEXT_PUBLIC_BACKEND_URL` to reach the backend directly       | Calls become cross-origin and the `SameSite=Lax` session cookie is dropped; sign-in looks fine and every later request is unauthenticated                   | inherited from x402 `deploy.md` |
| Treating `BACKEND_ORIGIN` as a runtime setting                        | `next start` reads rewrite targets from the build manifest; a restart with a new value still proxies to the old one                                         | 2026-09-19                      |
| Drawing a traffic chart from totals shaped by a curve                 | The backend returns no time buckets; the tooltip reported invented per-hour figures as measured. Draw a series only when `GET /dashboard/:id` serves one    | 2026-09-20                      |
| A placeholder API key literal as the last fallback                    | It was displayed as the user's own key with working copy and reveal buttons. No key means an empty state                                                    | 2026-09-20                      |
| eslint 10 while `eslint-config-next` pulls plugins capped at eslint 9 | `npm install` fails with `ERESOLVE`; forcing it lints through unsupported plugins. Retry when `eslint-plugin-react`, `-import` and `-jsx-a11y` accept `^10` | 2026-09-20                      |
| Falling back to zeros when the dashboard request fails                | A failed load rendered as "0.00 USDC available, 0 requests", which reads as the account's real state. A failed load shows an error and no figures           | 2026-09-20                      |
| Adding `requests_today` to `requests_month` for a "total"             | It counts today twice and is not a total; the backend has no all-time count                                                                                 | 2026-09-20                      |
| Defaulting an unmeasured uptime to 100 or latency to 0                | The backend sends `NULL` until a health check runs; the default showed "100%" and "0ms" for APIs nobody had measured. Unmeasured renders as a dash          | 2026-09-20                      |
