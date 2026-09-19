# AGENTS.md — Spigot-Dashboard

Instructions for AI coding agents and humans working in this repo. Single source for the repo;
`CLAUDE.md` only points here.

The app people log into: sign-in, credit top-up, usage, publisher onboarding, marketplace and the
consumer test page. Next 16, React 19, Tailwind 4. Seeded on 2026-09-18 from the `frontend/`
workspace of `x402-algorand`. It talks to the backend in `Spigot-Algorand` and holds no chain
logic and no secrets of its own.

Read **[DECISIONS.md](DECISIONS.md)** before proposing anything.

## What to read

| File                         | Read it when                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [deploy.md](deploy.md)       | Anything about environment variables or how this reaches the backend                                                                                   |
| `.env.example`               | You add or change a variable                                                                                                                           |
| `stealth-ref/`               | Looking for ideas only. It is reference code from another project on a different stack. It is excluded from `tsconfig.json` and must never be imported |
| [DECISIONS.md](DECISIONS.md) | Before proposing anything                                                                                                                              |

## Commands

```bash
npm install                  # inside this repo only
npm run verify               # format:check → lint → typecheck → build. Must exit 0
scripts/security-review.sh   # UI security + silent-failure checks; run after a build. 0 FAIL, 0 UNVERIFIED
npm run dev                  # :5173; proxies /api, /x402, /nanopay, /pay to BACKEND_ORIGIN (default http://127.0.0.1:4402)
```

Never run `npm install` in the mother folder. Each Spigot repo installs on its own.

## Invariants — do not break these

- **The browser only ever talks to this origin.** `next.config.ts` rewrites API paths to
  `BACKEND_ORIGIN` server-side, which is what keeps the httpOnly `SameSite=Lax` session cookie
  working. Never set or introduce `NEXT_PUBLIC_BACKEND_URL` in a deploy.
- **Only `NEXT_PUBLIC_*` variables reach the browser, and they are public.** No secret goes in one.
- `NEXT_PUBLIC_ALGORAND_NETWORK_PROFILE` must match the backend profile (`testnet` in alpha).
- `next/image` remote hosts are an explicit allowlist. Do not widen it to a wildcard.

## Where this repo sits

Spigot is five independent git repos, normally checked out side by side in one mother folder
that is not itself a repo.

| Repo               | Owns                                                                                   | Never put here                        |
| ------------------ | -------------------------------------------------------------------------------------- | ------------------------------------- |
| `Spigot-Algorand`  | Chain logic: x402 gateway, custodial wallets, credit ledger, settlement, publisher CLI | UI, marketing copy                    |
| `Spigot-Dashboard` | The app people log into: accounts, credit, usage, publisher onboarding                 | Chain logic, secrets, marketing pages |
| `Spigot-Website`   | Static marketing site. No backend dependency                                           | Auth, API calls, app routes           |
| `Spigot-MCP`       | Agent tools: Spigot through Claude and other MCP clients                               | Payment logic copied from the backend |
| `Spigot-Docs`      | Protocol and product docs                                                              | Code                                  |

No cross-repo imports. If a change seems to belong in two repos, stop and ask which one owns it.

---

# Working agreements

These are the same in all five Spigot repos. They live in each repo, not in a shared parent,
because each repo is cloned on its own.

## Hard rules

1. **Agents never `git commit`, `git push`, tag, or add their name anywhere.** The user reviews
   and signs every commit. Leave the work in the tree and say what changed.
2. **Alpha is testnet-only. No real funds.** Nothing an agent writes may make mainnet reachable
   without the explicit opt-in described in `Spigot-Algorand/mainnet.md`.
3. **Secrets never leave `.env`.** Never print, log, paste, or commit a mnemonic, key or token.
   When you must show config, show variable names and mask the values. Before anything is
   staged, run the check in "Before the user commits" below.
4. **Every claim about money or data must match `Spigot-Algorand/SECURITY.md`.** That covers
   website copy, Terms, Privacy, docs and tool descriptions. Describe what the backend does
   today, not what is planned.
5. **When in doubt, ask.** One short question with options: (a) yes as proposed, (b) change or
   add, (c) move it to another repo or later, (d) skip. Never guess across repos.

## Skills

| Situation                                                    | Skill          | Who turns it on                                                                                                                     |
| ------------------------------------------------------------ | -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Any code change                                              | `ponytail`     | the model, by default                                                                                                               |
| README, AGENTS, DECISIONS, docs, website copy                | `no-ai-slop`   | the model                                                                                                                           |
| Output should cost fewer tokens                              | `caveman`      | either                                                                                                                              |
| Output should lead with the next action and number the steps | `i-have-adhd`  | **the user only** — the skill blocks model invocation, so type `/i-have-adhd`. Without it, the model follows the same shape by hand |
| A yes/no or go/no-go call that is genuinely unclear          | TypeSafe (Jev) | the model                                                                                                                           |

## Precedence, when more than one is on

1. **Correctness beats brevity.** Never drop a command, path, flag, or error string to save
   tokens.
2. **`i-have-adhd` wins on structure, `caveman` wins on wording.** Keep the numbered steps and
   the next-action-first opening; compress the words inside them.
3. **`caveman` shapes chat only, never file contents.** Anything written to the repo is full
   English under `no-ai-slop`.
4. **`ponytail` governs the code; `no-ai-slop` governs the writing about it.**

## The work loop

Analyze → research → plan → check the plan → build → test → verify against the plan. A work
item is done when the repo's verify command exits 0, the behaviour was confirmed by a command
you ran yourself, and the plan's items are ticked. After three failed rounds, stop and escalate
with the evidence. "It should work" is not evidence; the command output is.

## The decisions log — how the proof chain is kept

[DECISIONS.md](DECISIONS.md) is where the _why_ lives. Read it before proposing anything;
append to it when you decide.

**Append an entry** when a session rejected an alternative, hit a constraint that shaped the
design, or reversed an earlier decision. Nothing for mechanical work — if you cannot fill in
**Why**, there is no entry to write.

Every entry carries its own proof: **Why** quotes the evidence (the command that was run and
what it printed, a measured number, a file and line), **Files** lists what changed, and
**Ref** names the commit. An agent writes `uncommitted`; the user replaces it with the hash
when they sign. That chain — decision, evidence, files, commit — is what lets the next person
check a claim instead of trusting it.

**When you reject something after actually trying it, add a row to "Tried and rejected" too.**
That table is the reason a fresh agent does not spend an afternoon rebuilding it.

The format is at the top of the file. Newest first.

## Machine-local files

`local/` is gitignored in every repo. Strategy notes, handoffs, scratch plans and anything
naming a real customer go there, never in a tracked file.

## Before the user commits

```bash
git add -A --dry-run | grep -iE "\.env|data/|\.db|node_modules|local/"
```

The only acceptable hits are `.env.example` files. Anything else: stop and fix `.gitignore`
first.

## Deploying

Agents do not deploy. The user does, following [deploy.md](deploy.md) in this repo and
`DEPLOY.md` in the mother folder (order, cross-service wiring, fresh-push steps).
