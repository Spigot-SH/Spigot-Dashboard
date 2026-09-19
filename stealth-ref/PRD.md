# Stealth v0.1 — PRD

**Status:** draft · **Scope:** single-user, local-first · **Deploy:** local now, Railway later
**Grounded in:** `/market-research` (dossier) + `research/strategy.html` (strategy)

---

## 1. Problem

Two problems, one product:

1. **No visibility.** When you drive a coding agent (Claude Code, Cursor, any MCP
   client), nothing records what you asked, what the model did, or what it cost.
   There's no log of prompts, responses, tool calls, or spend.
2. **Context bloat + no governance.** Every MCP server dumps *all* its tool
   schemas into context on connect. 10 tools registered = 10 schemas in every
   turn, even the 8 you never use. And there's no allow-list — the agent can
   reach anything that's connected.

## 2. What v0.1 is

A **local, single-user control layer for one person's AI agent**, with two planes:

- **Capture plane (proxy):** an inline LLM proxy. Your client points its model
  endpoint at Stealth; every prompt and response flows through and is logged
  (`prompt → log → llm → log → back`). Works in any client that supports a
  custom base URL.
- **Control plane (MCP facade):** one Stealth MCP server that governs and
  *lazily* serves tools and skills — a tiny fixed surface instead of N schemas,
  so context stays flat no matter how many you register.

Plus a **local dashboard** to manage the allow-list and read the live log.

> One-liner: *See every prompt, response, and cost from your agent — and give it
> only the tools and skills you allow, loaded only when used.*

## 3. Goals / non-goals

**Goals (v0.1)**
- G1 — Log 100% of prompts + responses + token/cost, inline, in any client (proxy).
- G2 — Register/allow-list tools and skills from a dashboard; nothing outside it
  is reachable through Stealth.
- G3 — Lazy loading: a session using 2 of 10 skills loads 2 skill bodies, not 10.
  Same for tools.
- G4 — One live dashboard: manage the allow-list + browse the log.
- G5 — Runs entirely on your machine (SQLite, no external deps beyond the LLM API).
- G6 — **`stealth_begin`**: the agent must log its intent + plan before using any
  tool/skill. Enforced server-side (ordering gate), so intent is always captured.

**Operational reality (auth)**
- The **MCP plane works on a Claude Max/Pro subscription** — MCP is client-side and
  unaffected by auth mode, so you can dogfood the facade (`stealth_begin`, catalog,
  call, use_skill) today with no API key.
- The **proxy plane requires a Console API key** — Claude Code subscription/OAuth
  auth ignores `ANTHROPIC_BASE_URL`, and proxying OAuth tokens violates Anthropic
  ToS. So full prompt/response capture needs pay-per-token API credits.

**Non-goals (explicitly deferred — all real, all later)**
- Credential broker / server-side key injection for *others'* keys (v0.1 uses
  your own key locally).
- Prompt/tool **enforcement** — `block / redact / hold`. Deliberately deferred to
  v0.2 (you chose log-only). The proxy ships the *seam* for it (see §5), so it's a
  drop-in later, not a rewrite. The capability is real; v0.1 just observes.
- Spend budgets + runtime enforcement (block/hold on budget).
- Hold-for-approval workflow (Slack).
- SSO / MDM / fleet rollout.
- Multi-user, multi-tenant, Railway deploy.
- Marketplace / payments.
- Cheap-vs-frontier model router.
- CC `UserPromptSubmit` hook — **superseded by the proxy** (proxy already captures
  all prompts, portably).

## 4. User & primary flows

Single user, playing both "admin" and "engineer" (the roles split later).

**Flow A — Setup (once)**
1. Start Stealth locally (proxy + MCP + dashboard).
2. Point the client at the proxy (`ANTHROPIC_BASE_URL` for Claude Code; custom
   base URL/key for Cursor).
3. Add the Stealth MCP server to the client.
4. In the dashboard, register + allow the tools and skills you want.

**Flow B — Everyday use (logging)**
1. You type a prompt in your client.
2. Prompt → Stealth proxy (logs it) → real LLM → response (logs it, with tokens
   + cost) → back to client.
3. Everything appears live in the dashboard log.

**Flow C — Skill on demand (the "caveman" pattern)**
1. You invoke a skill as an MCP prompt: `/stealth__caveman task="..."`.
2. Client calls `prompts/get(caveman, {task})` → Stealth **logs it + lazy-loads
   the skill body** → returns composed messages → they go to the LLM.
3. Only invoked skills load into context; the other 9 stay out.

**Flow D — Tool on demand**
1. Model calls the facade: `catalog()` → sees allowed tools (one line each) →
   `describe(name)` for the one it needs → `call(name, args)`.
2. Only the used tool's schema is ever pulled in. Every step is logged, and
   `call` is allow-list-checked.

## 5. Architecture

```
        ┌─────────────────────────── your machine ───────────────────────────┐
        │                                                                      │
 client │   ┌──────────────┐        ┌──────────────┐                          │
 (CC /  │   │ CAPTURE PROXY │──────► │  real LLM API│                          │
 Cursor)├──►│ logs prompt + │◄────── │ (Anthropic/  │                          │
        │   │ response+cost │        │  OpenAI)     │                          │
        │   └──────┬───────┘        └──────────────┘                          │
        │          │ writes                                                    │
        │          ▼                                                           │
        │      ┌────────┐        ┌──────────────────┐      ┌───────────────┐  │
        │      │ SQLite │◄───────│  MCP FACADE       │◄─────│  DASHBOARD    │  │
        │      │ (log,  │        │  catalog/describe │      │ allow-list +  │  │
        │      │ catalog│───────►│  /call + skills   │─────►│ live log      │  │
        │      │ ,allow)│        │  as prompts (lazy)│      │ (local web)   │  │
        │      └────────┘        └──────────────────┘      └───────────────┘  │
        │                              ▲ MCP (stdio/http)                      │
        └──────────────────────────────┼──────────────────────────────────────┘
                                        │
                                   client's MCP connection
```

**Components**
1. **Capture proxy** — HTTP server forwarding to the real LLM API; holds your API
   key in env; logs request + response + tokens + cost to SQLite. Path: `mvps/proxy`.
   **Design note:** this is the inline interception point. v0.1 only *observes*
   (log-only), but the proxy must be built so a verdict step —
   `allow / redact / block / hold` — slots in before forwarding, without a
   rewrite. Enforcement is v0.2; the seam for it ships in v0.1.
2. **MCP facade** — Stealth MCP server. Tools via `catalog`/`describe`/`call`;
   skills via MCP `prompts` (user-invoked, lazy). Enforces the allow-list, logs
   every invocation. Path: `mvps/mcp`.
3. **Dashboard** — local web UI: register/allow/toggle tools + skills, browse the
   live log. Reuse the dark terminal aesthetic from `../survey-review/admin.html`.
   Path: `mvps/web`.
4. **Store** — single SQLite file shared by all three. Path: `mvps/data/`.

**Recommended stack:** Node + TypeScript (first-class MCP SDK, easy proxy, shares
one SQLite). Final call in the spec (step 3).

## 6. Data model (first cut)

- `events` — id, ts, kind(`prompt|response|tool_call|skill_call`), session_id,
  payload(json), tokens_in, tokens_out, cost, latency_ms, status, tool/skill name.
- `tools` — name, source, one_line, schema(json), allowed(bool), enabled(bool).
- `skills` — name, one_line, body(md), args(json), allowed(bool), enabled(bool).
- `sessions` — id, started_at, client, meta.

## 7. Success criteria (v0.1 is "done" when)

- [ ] Every prompt + response in a Claude Code session is logged with token/cost.
- [ ] The same works in one non-Claude client (proves portability of the proxy).
- [ ] Registering 10 skills but using 2 loads only 2 skill bodies (verify via log).
- [ ] A tool not on the allow-list cannot be called through `call`.
- [ ] Dashboard shows the live log and lets you toggle a tool/skill on/off.

## 8. Open questions — RESOLVED in [`SPEC.md`](./SPEC.md) §intro

- MCP transport → **Streamable HTTP**.
- Tool sources → **aggregate downstream MCP servers**.
- Proxy coverage → **Anthropic + OpenAI-compatible** (both).
- Cost → **$ via static price table** (`config.ts`), always store tokens, fall back
  to tokens-only for unpriced models.

## 9. Out-of-scope reminder

Everything in §3 non-goals. When tempted, write it in `mvps/BACKLOG.md`, not v0.1.
