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
npm run dev                  # :5173; proxies /api and /x402 to BACKEND_ORIGIN (default http://127.0.0.1:4402)
```

Never run `npm install` in the mother folder. Each Spigot repo installs on its own.

## Invariants — do not break these

- **The browser only ever talks to this origin.** `next.config.ts` rewrites API paths to
  `BACKEND_ORIGIN` server-side, which is what keeps the httpOnly `SameSite=Lax` session cookie
  working. Never reintroduce a browser-side backend URL (`NEXT_PUBLIC_BACKEND_URL` was removed).
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

This section is the same text in all five Spigot repos. It lives in each repo, not in a shared
parent, because each repo is cloned on its own.

Two people work on Spigot. Each runs their own AI agents. Before these rules the agents undid
each other's work: one reverted the other's change, one bumped a package the other had pinned,
one rewrote the other's log entry. These rules stop that.

Every rule has a number. Cite it as "rule 3.1". Every rule has three parts: **Do**, **Don't**,
and **Why** in one line.

## Words used in these rules

- **Agent**: any AI model or AI tool that reads or edits this repo.
- **Your user**: the human who typed the request in your session.
- **The other person**: any human or agent that is not you and not your user.
- **Orchestrator**: the main session your user types into. It hands out work to other agents.
- **Committed**: the change shows in `git log`. **Uncommitted**: it shows in `git status`.
- **Green**: the command exited 0 and printed no `FAIL` and no `UNVERIFIED`. **Red**: anything
  else.
- **This repo's checks**: every check command listed under "Commands" at the top of this file.
  Where `scripts/security-review.sh` exists, it is one of them and must print `0 failed` and
  `0 unverified`.
- **Money path**: code that moves, prices or records funds, or signs a user in. That is all of
  `Spigot-Algorand/backend/src`, plus `src/wallet` and `src/credits` in `Spigot-Dashboard`.
- **Native package**: an npm package that ships or compiles a binary file. Today that is
  `better-sqlite3`.
- **Probe**: a read-only command that proves a money path still works. Example:
  `(cd backend && npx tsx scripts/reconcile.ts)`.
- **Jev**: a paid yes/no model from TypeSafe. You ask a question and it returns a number from
  0 to 1. Closer to 1 means yes.
- **Potpie**: a free tool that runs on this machine and keeps a map of the code.

## 1. Skills

**1.1 Use `ponytail` for every code change.**

- Do: write the smallest diff that works. Delete before you add. Fix a bug once, in the shared
  function every caller uses.
- Don't: add a file, a dependency, an option or an abstraction nobody asked for. Don't remove
  input checks, security checks or error handling to make the diff smaller.
- Why: a small diff is quick for the other person to review and leaves little to argue about.

**1.2 Use `caveman` for chat only.**

- Do: keep chat replies short when your user turns it on.
- Don't: write caveman style into any file, commit message or log entry. Don't drop a command,
  path, flag or error string to save words.
- Why: files are read later by people who were not in the chat.

**1.3 Use `no-ai-slop` for everything people read.**

- Do: apply it to `AGENTS.md`, `DECISIONS.md`, README files, docs, website copy and commit
  messages. Short sentences. Name the file, the number, the command.
- Don't: write filler, praise or vague claims.
- Why: a rule that can be read two ways gets followed two ways.

**1.4 `i-have-adhd` is turned on by your user only.**

- Do: when your user types `/i-have-adhd`, lead with the next action and number the steps.
- Don't: turn it on yourself. The skill blocks that.
- Why: it is a reading preference, and only the reader can set it.

**1.5 Ask Jev when a yes/no is unclear. Follow these numbers.**

- Do: put all open questions into one Jev call. Report each score.
- Do: for "does this change need a `DECISIONS.md` entry?": above 0.75, write the entry. Below
  0.45, write no entry and fix the doc text only. From 0.45 to 0.75, ask your user.
- Do: for "should this block a deploy?": above 0.8, it is a blocker. Stop other work and tell
  your user first. At 0.8 or below, report it and keep working.
- Don't: guess. If Jev fails, or `TYPESAFE_API_KEY` is not set, ask your user instead: one
  short question with options (rule 4.11).
- Why: Jev costs money and can be offline, so every Jev rule needs a free path.

**1.6 GSD agents do three jobs only: debug, code review, verify work.**

- Do: use them for those three jobs.
- Don't: run any codebase-mapper agent. Don't create a `.planning/` folder.
- Why: Potpie already maps the code. Two maps drift apart.

**1.7 If a skill is not installed, follow its rule here by hand.**

- Do: read the Do and Don't lines of rules 1.1 to 1.3 and work that way.
- Don't: stop work because a skill is missing.
- Why: the rules are written so they work without the skill.

## 2. Packages

**2.1 List before you bump.**

- Do: run `npm outdated` inside the repo. Write down each package, its current version and the
  latest version.
- Don't: change any version before the list exists.
- Why: the list shows which bumps are risky before anything breaks.

**2.2 Put every package in exactly one bucket.**

- Do: **UPDATE NOW** if the bump is a patch or minor version and the package is not used on a
  money path.
- Do: **HOLD WITH PROBE** if the bump is a major version, or the package is used on a money
  path, talks to a chain, or is a native package. Examples: `@x402/*`, `algosdk`,
  `@stellar/stellar-sdk`, `better-sqlite3`, `@libsql/client`.
- Do: **BLOCKED WITH REASON** if another package forbids the bump. Write the blocker and the
  command that showed it in `DECISIONS.md`, in the "Tried and rejected" table.
- Don't: leave a package in no bucket, or in two.
- Why: the bucket decides which check the bump must pass.

Blocked today:

| Package                                    | Blocked at | Reason                                                                                      |
| ------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------- |
| `typescript`                               | 6.0.x      | `typescript-eslint` 8 supports TypeScript below 6.1.0                                       |
| `@types/node`                              | 22.x       | Production runs Node 22. Types for a newer Node allow code that crashes on 22               |
| `eslint` in `Spigot-Dashboard`, `-Website` | 9.x        | `eslint-plugin-react`, `eslint-plugin-import` and `eslint-plugin-jsx-a11y` stop at eslint 9 |
| `uuid` in `Spigot-Algorand`                | removed    | Version 12 and later cannot be loaded by the CommonJS backend. Use `crypto.randomUUID()`    |

**2.3 Bump one package at a time.**

- Do: bump one package. Run its check (rule 2.4). Green: keep it. Red: undo that one package
  (rule 2.6). Then take the next package.
- Do: treat packages that release together as one package. Examples: all of `@x402/*`; `react`
  with `react-dom` and their types; `eslint` with `@eslint/js`.
- Don't: bump two unrelated packages before running a check.
- Why: when a check goes red, you know which package did it.

**2.4 Run the check that fits the bucket.**

- Do: for every bump, run this repo's checks.
- Do: for a money-path bump, also run the probe and the testnet guard in `Spigot-Algorand`:
  `(cd backend && npx tsx scripts/reconcile.ts)` and
  `(cd backend && sh scripts/check-testnet-guard.sh)`. The guard must print 6 `PASS` lines.
- Do: for a native package, also delete `node_modules`, run `npm ci`, then load the package and
  run the database migrations against a throwaway database file.
- Don't: start the full backend with the real `.env` as a check. It starts the settlement loop.
- Why: a type check cannot see a broken binary or a broken payment.

**2.5 Prove a TypeScript or eslint major is supported before you bump it.**

- Do: run `npm view typescript-eslint peerDependencies` and read the range. For eslint, run
  `npm view <plugin> peerDependencies.eslint` for every eslint plugin in the repo.
- Don't: use `--legacy-peer-deps`, `--force` or `overrides` to get past a peer error.
- Why: a linter running on a version it does not support misses real errors without saying so.

**2.6 Undo a red bump without undoing the green ones.**

- Do: before each bump, copy `package.json` and `package-lock.json` to a scratch folder outside
  the repo. To undo, copy them back and run `npm ci`.
- Don't: run `git checkout HEAD -- package.json` when earlier kept bumps are still uncommitted.
  It throws those away too.
- Why: a revert must remove one package, not the whole session.

**2.7 Two reds in a row: stop everything.**

- Do: stop all bumps and report both failures with their output.
- Don't: try a third package.
- Why: two failures in a row usually share one cause, and more bumps hide it.

**2.8 Install with Node 22, inside the repo.**

- Do: run `nvm use 22` first. Run `npm install` and `npm ci` only inside the repo folder.
- Don't: run `npm install` in the mother folder. Don't install with npm 12 or later on a repo
  that has a native package.
- Why: production runs Node 22. npm 12 blocks install scripts, which leaves a native package
  without its binary.

**2.9 A pin made by the other person is their committed work.**

- Do: before you bump a package, run `git log -S'"<package>"' --format='%an %h %s' -- '*package.json'`.
  If the other person set or lowered that version, rule 3.1 applies: ask first.
- Don't: raise a version the other person pinned without asking.
- Why: they pinned it for a reason the code may not show.

## 3. No-fight rules

**3.1 Ask before you change the other person's committed work.**

- Do: before you edit or delete existing lines, run `git blame -L <start>,<end> <file>` on those
  lines. If any line has an author name other than the one `git config user.name` prints, stop
  and ask your user. Ask once per task. List every commit of theirs you would touch, with its
  hash. Use the options in rule 4.11.
- Don't, until your user has answered: revert their commit, rewrite their lines, or change a
  version they pinned. After your user answers, do exactly what they picked.
- Don't, ever: run `git push --force`, `git commit --amend` or `git rebase` on a commit that is
  already pushed.
- Why: their agent will put the change back, and the two agents loop.

**3.2 When code and docs disagree, report it. Do not rewrite either one.**

- Do: quote both sides with `file:line`. Name the commit that made them differ. Ask your user
  which side is right.
- Do: until your user answers, treat the committed code as what the product does today.
- Don't: edit an existing `DECISIONS.md` entry. It is a dated log. To correct one, append a new
  entry that names the old entry's date and title. The only edit allowed inside an old entry is
  your user replacing `uncommitted` with a commit hash (rule 3.6).
- Don't: change code to match a doc unless your user picks that.
- Why: a log that gets rewritten cannot be trusted, and neither can a doc nobody checked.

**3.3 One writer per file at a time.**

- Do: at the start of a task run `git fetch`, then `git status -sb`. If it prints `behind`, stop
  and tell your user to pull.
- Do: if `git status --short` lists a file you did not change in this session, do not edit that
  file. Ask your user who is working on it.
- Do: the orchestrator gives each file to exactly one agent for the whole task. A change across
  several files stays with the orchestrator, or is split so that no file is on two agents'
  lists.
- Do: a single-file tool such as `opencode` gets exactly one file path and the instruction
  "edit only this file".
- Don't: let two agents, two sessions or two tools edit the same file during one task. Don't run
  `git pull`, `git stash`, `git reset` or `git checkout -- <file>` on work you did not create in
  this session.
- Why: two writers on one file produce edits that cancel each other.

**3.4 No agent names anywhere.**

- Do: write commit messages as plain text about the change.
- Don't: add `Co-Authored-By`, "Generated with" or any model or tool name to a commit message,
  a file, a log entry or a PR.
- Why: your user signs the work and answers for it.

**3.5 Every claim about money or data must match `Spigot-Algorand/SECURITY.md`.**

- Do: check website copy, Terms, Privacy, docs and tool descriptions against that file.
  Describe what the backend does today.
- Don't: describe planned behaviour as if it exists. Don't show an invented number, key or
  chart as real data. Show what the backend returned, an empty state, or a dash.
- Why: a wrong claim about money is a promise the backend does not keep.

**3.6 Humans sign `Ref` lines.**

- Do: write `**Ref:** uncommitted.` on every entry you add.
- Don't: replace `uncommitted` with a hash. Only your user does that, after they commit.
- Why: the hash is your user's statement that they reviewed the change.

**3.7 Stay inside this repo.**

- Do: if a change seems to belong in two repos, stop and ask your user which repo owns it.
- Don't: import code from another Spigot repo. Don't import from `stealth-ref/`.
- Why: each repo is cloned, installed and deployed on its own.

## 4. How work gets done

**4.1 Follow the loop in order.**

- Do: analyze, research, plan, check the plan, build, test, verify.
- Don't: build before the plan is checked.
- Why: a wrong plan costs less to fix than wrong code.

**4.2 Evidence is a command you ran in this session, and its output.**

- Do: call work done only when this repo's checks are green and a command you ran yourself
  showed the behaviour. Quote the exit code and the deciding line.
- Do: when another agent reports a blocker, re-run its check yourself before you repeat the
  claim.
- Don't: write "it should work". Don't report a check you did not run.
- Why: the next person can re-run a command. They cannot re-run a belief.

**4.3 Three failed rounds: stop and escalate.**

- Do: after three failed attempts at the same problem, stop and show your user the evidence.
- Don't: start a fourth attempt.
- Why: the fourth attempt usually repeats the first.

**4.4 Agents never commit, push, tag or deploy.**

- Do: leave the work in the tree. List every file you changed. If your user asks, give them
  commands they can paste.
- Don't: run `git commit`, `git push`, `git tag` or any deploy command.
- Why: your user reviews and signs every commit, and does every deploy, following `deploy.md`
  in this repo and `DEPLOY.md` in the mother folder.

**4.5 Run the secret check before your user commits.**

- Do: run `git add -A --dry-run | grep -iE "\.env|data/|\.db|node_modules|local/"`. The only
  acceptable hits are `.env.example` files.
- Don't: let your user commit while anything else is listed. Fix `.gitignore` first.
- Why: a secret in git history stays there.

**4.6 Secrets never leave `.env`.**

- Do: when you must show config, show variable names and mask the values.
- Don't: print, log, paste or commit a mnemonic, key or token.
- Why: chat logs and terminal history are not private.

**4.7 Alpha is testnet-only. No real funds.**

- Do: keep every network setting on testnet.
- Don't: write anything that makes mainnet reachable without the opt-in described in
  `Spigot-Algorand/mainnet.md`.
- Why: a bug on testnet costs nothing. On mainnet it costs money.

**4.8 Log real decisions in `DECISIONS.md`.**

- Do: append an entry when a session rejected an alternative, hit a limit that shaped the
  design, or reversed an earlier decision. Use the format at the top of that file. In **Why**,
  quote the command and its output, a measured number, or a `file:line`. Newest entry first.
- Do: when you tried something and dropped it, also add a row to "Tried and rejected".
- Don't: write an entry for mechanical work. If you cannot fill in **Why**, there is no entry.
- Why: the next agent reads the table and does not rebuild what was already thrown out.

**4.9 Private notes go in `local/`.**

- Do: put strategy notes, handoffs, scratch plans and anything naming a real customer in
  `local/`. It is gitignored in every repo.
- Don't: put them in a tracked file.
- Why: tracked files get pushed.

**4.10 Read `DECISIONS.md` before you propose anything.**

- Do: read the "Tried and rejected" table first.
- Don't: propose an idea that is in that table.
- Why: it was already tried, and the table says why it failed.

**4.11 When in doubt, ask one short question with options.**

- Do: offer (a) yes as proposed, (b) change or add, (c) move it to another repo or do it later,
  (d) skip.
- Don't: guess across repos. Don't ask more than one question when one will do.
- Why: a wrong guess takes longer to undo than a question takes to answer.

## 5. Tools

**5.1 Every paid tool has a free fallback.**

- Do: when a paid tool is missing or fails, use the fallback in the table below.
- Don't: add a new paid tool without asking your user.
- Why: work must not stop because a key is missing.

| Tool                                | Used for                        | Cost               | Check it is installed                        | If it is missing                        |
| ----------------------------------- | ------------------------------- | ------------------ | -------------------------------------------- | --------------------------------------- |
| Potpie                              | Code map and project memory     | Free, runs locally | `potpie status` prints `profile=local`       | Search the code with `grep`             |
| `opencode`                          | Single-file edits (rule 3.3)    | Free binary (1)    | `~/.opencode/bin/opencode --version`         | The orchestrator edits the file         |
| `ponytail`, `caveman`, `no-ai-slop` | Rules 1.1 to 1.3                | Free               | `ls ~/.claude/skills/<name>/SKILL.md`        | Follow the rule text by hand (rule 1.7) |
| Jev (TypeSafe)                      | Unclear yes/no calls (rule 1.5) | **Paid**, per call | `echo ${TYPESAFE_API_KEY:+set}` prints `set` | Ask your user (rule 1.5)                |
| GSD agents                          | Debug, code review, verify work | No extra cost      | They appear in the session's agent list      | Do the job in the main session          |
| Node 22 (`nvm`)                     | All installs (rule 2.8)         | Free               | `node -v` prints `v22`                       | Install it, see below                   |

(1) The `opencode` binary is free. The model it calls may bill its own provider.

Install on a fresh machine:

```bash
pip install potpie && potpie setup --repo . --agent claude   # Potpie; keep profile=local
curl -fsSL https://opencode.ai/install | bash                # opencode
nvm install 22                                               # Node 22
```

The three skills are folders. Copy `~/.claude/skills/<name>/` from a machine that has them. Jev
comes from the `typesafe` plugin (marketplace repo `typesafe-ai/skills`). Its key goes in your
shell environment as `TYPESAFE_API_KEY`, never in a repo file.
