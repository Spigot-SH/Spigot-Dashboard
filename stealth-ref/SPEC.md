# Stealth v0.1 — Technical Spec

Implements [`PRD.md`](./PRD.md). Resolves its 4 open questions:

| # | question | decision |
|---|---|---|
| 1 | MCP transport | **Streamable HTTP** |
| 2 | proxy coverage | **Anthropic + OpenAI-compatible** (both) |
| 3 | tool sources | **aggregate downstream MCP servers** |
| 4 | cost | **$ via static price table**, always store tokens, fall back to tokens-only for unknown models |

> **Update (post-v0.1 decision):** DB switched from SQLite to **PostgreSQL** (Railway
> managed). All DB helpers are async; `DATABASE_URL` drives the connection. No volume
> needed. Local dev requires a reachable Postgres (set `DATABASE_URL`).

---

## 1. Stack

- **Runtime:** Node 20+, **TypeScript**.
- **HTTP:** [Hono](https://hono.dev) — tiny, TS-first, first-class streaming (needed
  for SSE tee). (Express is the fallback if Hono friction appears.)
- **MCP:** `@modelcontextprotocol/sdk` — used as **both** server (Streamable HTTP
  transport, to the agent) and client (to downstream servers).
- **DB:** **PostgreSQL** via `pg` (node-postgres). On Railway, `DATABASE_URL` is
  injected from a managed Postgres service; async query layer.
- **Dashboard UI:** static HTML + vanilla JS (no build step), dark terminal
  aesthetic reused from `../survey-review/admin.html`.
- **Config:** `.env` + a `config.ts` (price table, downstream servers).

Rationale: one language across all three planes, MCP SDK is TS-native, one shared
SQLite, zero UI build step — fastest local-first path.

## 2. Runtime shape — one process, one port

A single Node process (default `http://localhost:8787`) mounts everything:

| route | plane | purpose |
|---|---|---|
| `POST /v1/messages` | proxy | Anthropic ingest (Claude Code) |
| `POST /v1/chat/completions` | proxy | OpenAI-compatible ingest (Cursor/others) |
| `ALL  /mcp` | control | Streamable HTTP MCP endpoint (facade) |
| `GET  /` | dashboard | UI (static) |
| `/api/*` | dashboard | UI data API (log, catalog, allow-list toggles) |

All read/write the same SQLite file at `mvps/data/stealth.db`.

## 3. Directory structure

```
mvps/
  package.json
  tsconfig.json
  .env.example
  src/
    index.ts             # boot Hono server, mount all routers, init DB + MCP
    config.ts            # env, PRICE_TABLE, downstream MCP server list
    db/
      schema.sql         # tables: events, tools, skills, servers, sessions
      db.ts              # better-sqlite3 init + typed query helpers
    proxy/
      anthropic.ts       # /v1/messages: forward + capture
      openai.ts          # /v1/chat/completions: forward + capture
      capture.ts         # SSE tee, response reconstruction, usage extraction
      cost.ts            # tokens -> $ via PRICE_TABLE (fallback: tokens-only)
    mcp/
      server.ts          # Streamable HTTP MCP server; registers facade + skills
      facade.ts          # catalog / describe / call  (tools, lazy)
      aggregator.ts      # MCP client pool -> downstream servers (list/call cache)
      skills.ts          # downstream prompts re-exposed as MCP prompts (lazy)
      allowlist.ts       # governance check against `tools`/`skills` tables
    web/
      routes.ts          # /api/* : events feed, catalog, toggles
      public/
        index.html       # dashboard (static, dark terminal)
  data/                  # stealth.db  (gitignored)
```

## 4. Component specs

### 4.1 Capture proxy (`proxy/`)

**Goal:** be inline, forward to the real provider, log 100% of prompts + responses
+ tokens + cost. Non-streaming and streaming both supported.

**Keys:** real provider keys live in env (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`).
The proxy **overrides** whatever auth header the client sends and uses the env key
upstream. (Client can be configured with any dummy key.)

**`/v1/messages` (Anthropic):**
1. Read body, extract the latest user turn + full message array → write a `prompt`
   event (session keyed by a header or a hash of the system prompt).
2. Forward to `https://api.anthropic.com/v1/messages` with env key, same body.
3. If `stream:false` → parse response, write `response` event with
   `usage.input_tokens`/`output_tokens` + cost. Return as-is.
4. If `stream:true` → **tee** (see 4.2): pipe chunks straight to the client while
   accumulating; on `message_delta`/`message_stop` capture usage; write one
   `response` event at end. Client sees no added latency.

**`/v1/chat/completions` (OpenAI-compatible):**
- Same pattern against `OPENAI_BASE_URL` (default `https://api.openai.com/v1`).
- **Usage trick:** always inject `stream_options.include_usage = true` into the
  upstream request so the final SSE chunk carries `usage`, even if the client
  didn't ask. Strip it back out of the client-facing stream if it wasn't requested.

**Sessions:** derive a `session_id` from a stable signal (client-sent header if
present, else hash of system prompt + first user message). Good enough for v0.1.

### 4.2 SSE tee + usage (`capture.ts`)

- Wrap the upstream `ReadableStream`. For each chunk: (a) forward to client, (b)
  feed a lightweight SSE parser that accumulates text deltas + captures the
  `usage` object when it appears.
- Anthropic: `message_start` → input tokens; `message_delta.usage` → output tokens
  (cumulative); `message_stop` → finalize.
- OpenAI: text in `choices[].delta.content`; `usage` in the final chunk (present
  because we injected `include_usage`).
- On end: assemble `{ text, tokens_in, tokens_out, model }`, compute cost, write one
  `response` event. Never buffer the whole stream before forwarding — forward and
  accumulate concurrently.

### 4.3 Cost (`cost.ts`)

```ts
// $ per 1M tokens. Unknown model -> return null cost, keep token counts.
PRICE_TABLE = {
  "claude-opus-4-8":   { in: 15, out: 75 },      // fill real numbers in config
  "claude-sonnet-4-6": { in: 3,  out: 15 },
  "gpt-4o":            { in: 2.5, out: 10 },
  // ...
}
cost = tokens_in/1e6 * price.in + tokens_out/1e6 * price.out
```
Always persist `tokens_in`/`tokens_out`; `cost` is nullable.

### 4.4 MCP facade + aggregator (`mcp/`)

Stealth is an MCP **server** to the agent and an MCP **client** to downstream
servers listed in `servers` (managed in the dashboard).

**Facade tools exposed to the agent (only these — context stays flat):**
- `stealth_begin(intent, plan?)` → log an `intent` event. **Enforced ordering:** the
  facade tracks per-session state; `call`/`use_skill` are refused until the session
  has called `stealth_begin`. Server `initialize.instructions` tells the model to
  call it first. This is how intent is always captured through MCP (works on Max sub).
- `catalog(query?)` → allowed tools + skills, one line each (from cached
  downstream `tools/list` + `prompts/list`).
- `describe(name)` → full input schema / usage for one item (on demand).
- `call(name, args)` → begin-gate + allow-list check → route to the owning downstream
  server's `tools/call` → log `tool_call` event → return result.
- `use_skill(name, args?)` → begin-gate + allow-list check → downstream `prompts/get`
  → return the composed instructions (lazy body load) → log `skill_call`. (The
  user-invoked slash-command form via MCP `prompts` is M4.)

**Skills = downstream MCP prompts, re-exposed as Stealth MCP prompts** (`skills.ts`):
- `prompts/list` returns allowed skills (names + one-liners — cheap, no bodies).
- `prompts/get(name, args)` → allow-list check → log `skill_call` (incl. args, so
  the request text passed as an arg is captured) → proxy to downstream
  `prompts/get` → return composed messages. This is the `/caveman` pattern; bodies
  load only on get.

**Aggregator (`aggregator.ts`):** maintains a client connection per downstream
server, caches their `tools/list` + `prompts/list`, refreshes on
`list_changed` notifications. Routes `call`/`get` to the right server.

**Allow-list (`allowlist.ts`):** every `call`/`prompts.get` checks the `tools`/
`skills` table `allowed` flag. Not allowed → refuse with a clear reason (logged).
This is the only enforcement in v0.1 (governance boundary); prompt block/redact is
v0.2 (the proxy seam from PRD §5).

### 4.5 Dashboard (`web/`)

Static UI + `/api/*`:
- **Log view** — live feed of `events` (prompt / response / tool_call / skill_call)
  with tokens + cost. Poll or SSE.
- **Catalog** — list downstream servers + their tools/skills; toggle `allowed`.
- **Add server** — register a downstream MCP server (name, transport, url).
Reuse `admin.html`'s look; no framework.

### 4.6 Data model (`db/schema.sql`)

- `events(id, ts, kind, session_id, client, name, payload_json, tokens_in,
  tokens_out, cost, latency_ms, status)` — kind ∈ prompt|response|tool_call|skill_call.
- `servers(id, name, transport, url, enabled, added_at)` — downstream MCP servers.
- `tools(id, server_id, name, one_line, schema_json, allowed, seen_at)`.
- `skills(id, server_id, name, one_line, args_json, allowed, seen_at)`.

## 5. Client setup (v0.1)

**Claude Code (Anthropic):**
```bash
export ANTHROPIC_BASE_URL="http://localhost:8787"
export ANTHROPIC_API_KEY="stealth-local"   # dummy; proxy uses its own env key
# add MCP server:  http://localhost:8787/mcp  (streamable http)
```
**Cursor / OpenAI-compatible:** set custom base URL `http://localhost:8787/v1`,
any key; add the same `/mcp` server.

## 6. Build order (milestones)

1. ✅ **M0 — skeleton:** Hono server, DB init from `schema.sql`, `/api/health`.
2. ✅ **M1 — Anthropic capture:** `/v1/messages` + streaming SSE tee → log
   prompt+response+tokens+cost.
3. ✅ **M2 — OpenAI ingest:** `/v1/chat/completions` + SSE tee + `include_usage`
   trick (Cursor-ready). API-key + passthrough auth modes.
4. ✅ **M3 — MCP facade:** Streamable HTTP MCP server + `stealth_begin` (enforced) +
   `catalog/describe/call/use_skill`, aggregate downstream servers, allow-list.
5. ✅ **M4 — skills as prompts:** allow-listed downstream prompts re-exposed as MCP
   prompts (slash commands), lazy body load, logged.
6. ✅ **M5 — dashboard:** live log + catalog allow-list toggles + add-server.

## 7. Success criteria → tests (from PRD §7)

- Every prompt+response in a Claude Code session logged w/ tokens (+$ if priced) — M1/M2.
- Same in one non-Claude client — M2 (Cursor).
- 10 skills registered, 2 used → only 2 bodies load (assert via events) — M4/M5.
- Non-allow-listed tool cannot be `call`ed — M3.
- Dashboard shows live log + toggles a tool/skill — M5.

## 8. Notes / risks

- **Streaming is the hardest bit** — get M2's tee right before anything else fancy.
- **OpenAI vs Anthropic message shapes** differ; normalize into `events.payload_json`
  but keep raw enough to reconstruct.
- **Auth override**: some clients validate key format — accept anything, ignore it.
- **MCP HTTP session**: Streamable HTTP uses a session id header; the aggregator's
  downstream connections are separate from the agent's inbound session.
