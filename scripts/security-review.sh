#!/usr/bin/env bash
#
# security-review.sh — the executable half of security-review.md
#
# UI checks. The backend checks (auth, payments, SQL, rate limits) live in the same-named script
# in Spigot-Algorand.
#
# Runs every check that can be decided from the source tree alone. Checks needing a running
# server or a funded chain live in verify.md and are NOT run here.
#
# Exit codes:  0 = no FAIL   1 = at least one FAIL   2 = a check could not run (UNVERIFIED)
#
# Design rule: a check that cannot execute is NEVER silently a pass. It is UNVERIFIED, which
# is louder than PASS and is retried once before being recorded.
#
# Usage:
#   scripts/security-review.sh                 # human-readable
#   scripts/security-review.sh --log           # also append to security-log/
#   scripts/security-review.sh --strict        # UNVERIFIED also exits non-zero

set -uo pipefail
cd "$(dirname "$0")/.."

WANT_LOG=0
STRICT=0
for arg in "$@"; do
  case "$arg" in
    --log) WANT_LOG=1 ;;
    --strict) STRICT=1 ;;
  esac
done

RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; DIM=$'\033[2m'; RESET=$'\033[0m'
[ -t 1 ] || { RED=""; GREEN=""; YELLOW=""; DIM=""; RESET=""; }

PASS_COUNT=0; FAIL_COUNT=0; UNVERIFIED_COUNT=0
RESULTS=()

record() { # id | status | detail
  RESULTS+=("$1|$2|$3")
  case "$2" in
    PASS)       PASS_COUNT=$((PASS_COUNT+1));       printf "  ${GREEN}PASS${RESET}        %-26s %s\n" "$1" "$3" ;;
    FAIL)       FAIL_COUNT=$((FAIL_COUNT+1));       printf "  ${RED}FAIL${RESET}        %-26s %s\n" "$1" "$3" ;;
    UNVERIFIED) UNVERIFIED_COUNT=$((UNVERIFIED_COUNT+1)); printf "  ${YELLOW}UNVERIFIED${RESET}  %-26s %s\n" "$1" "$3" ;;
  esac
}

# Run a command that must produce NO output. Retries once before giving up, so a transient
# failure (a slow filesystem, a lock) is not recorded as a real finding.
expect_empty() { # id | description | command...
  local id="$1" desc="$2"; shift 2
  local out rc attempt
  for attempt in 1 2; do
    out="$("$@" 2>&1)"; rc=$?
    # grep exits 1 for "no matches", which is exactly the pass condition here.
    if [ $rc -le 1 ]; then
      if [ -z "$out" ]; then record "$id" PASS "$desc"
      else record "$id" FAIL "$desc — $(echo "$out" | head -3 | tr '\n' ' ')"; fi
      return
    fi
    [ $attempt -eq 1 ] && sleep 1
  done
  record "$id" UNVERIFIED "$desc — command exited $rc, could not evaluate"
}

need() { command -v "$1" >/dev/null 2>&1; }

echo
echo "Spigot-Dashboard security review — $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "${DIM}commit $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')${RESET}"
echo

check_contains() { # id | file | pattern | description
  if [ ! -f "$2" ]; then record "$1" UNVERIFIED "$2 not found"; return; fi
  if grep -q "$3" "$2"; then record "$1" PASS "$4"; else record "$1" FAIL "$4 — pattern '$3' absent"; fi
}

# ---------------------------------------------------------------------------
echo "S1  Secrets"
# ---------------------------------------------------------------------------
# Two independent detectors, because either alone has a blind spot:
#   (a) by NAME  — a credential-ish identifier assigned a long literal
#   (b) by SHAPE — a known provider token prefix, whatever the variable is called
# (b) exists because a real leak found during testing (`const LEAKED_KEY = "sk_live_…"`)
# slipped past (a): the identifier matched none of the name patterns.
expect_empty "S1.1-hardcoded-name" "no credential-named literal in source" \
  bash -c "set -o pipefail; grep -rnE \"(mnemonic|api_?key|secret|passwd|password|token|credential|_KEY|PRIVATE_KEY)[[:space:]]*[:=][[:space:]]*['\\\"][A-Za-z0-9+/=_-]{16,}\" src --include='*.ts' --include='*.tsx' --include='*.mjs' 2>/dev/null | grep -v 'process\.env' | grep -vi 'storage_key' | grep -v '\.example' | grep -vE ':[0-9]+:[[:space:]]*(\*|//)'"

expect_empty "S1.1-hardcoded-shape" "no provider-shaped token literal in source" \
  bash -c "set -o pipefail; grep -rnE \"['\\\"](sk_live_|sk_test_|pk_live_|pk_test_|rk_live_|AKIA[0-9A-Z]{16}|ghp_|gho_|github_pat_|xox[baprs]-|re_[A-Za-z0-9]{16}|AIza[0-9A-Za-z_-]{35})\" src --include='*.ts' --include='*.tsx' --include='*.mjs' 2>/dev/null | grep -vE ':[0-9]+:[[:space:]]*(\*|//)'"

# 25 space-separated lowercase words in a quoted string is an Algorand mnemonic.
expect_empty "S1.1-mnemonic-shape" "no 25-word mnemonic literal in source" \
  bash -c "set -o pipefail; grep -rnE \"['\\\"]([a-z]+ ){24}[a-z]+['\\\"]\" src --include='*.ts' --include='*.tsx' --include='*.mjs' 2>/dev/null"

expect_empty "S1.2-env-committed" "no .env file is tracked by git" \
  bash -c "set -o pipefail; git ls-files | grep -E '(^|/)\.env$|(^|/)\.env\.' | grep -v '\.example'"

if [ -d .next/static ]; then
  # A NAME appearing in vendored library code is not a leak; a VALUE is. Look for assignment.
  expect_empty "S1.3-bundle-secrets" "no secret VALUES in the client bundle" \
    bash -c "set -o pipefail; grep -rhoE '(SESSION_SECRET|MASTER_ENCRYPTION_KEY|ADMIN_TOKEN|RESEND_API_KEY|TREASURY_MNEMONIC|CUSTODY_MNEMONIC|SETTLEMENT_MNEMONIC)[\"'\\'']?[[:space:]]*[:=][[:space:]]*[\"'\\''][A-Za-z0-9+/= ]{12,}' .next/static 2>/dev/null"
else
  record "S1.3-bundle-secrets" UNVERIFIED ".next/static absent — run 'npm run build' first"
fi

expect_empty "S1.4-public-env" "no server secret is exposed via NEXT_PUBLIC_" \
  bash -c "set -o pipefail; grep -rn 'NEXT_PUBLIC_[A-Z_]*\(SECRET\|MNEMONIC\|PRIVATE\|TOKEN\|PASSWORD\)' src next.config.ts 2>/dev/null"

# ---------------------------------------------------------------------------
echo
echo "S4  Injection and execution"
# ---------------------------------------------------------------------------
expect_empty "S4.2-exec" "no eval / Function / child_process" \
  bash -c "set -o pipefail; grep -rnE '\beval\(|new Function\(|child_process|execSync' src --include='*.ts' --include='*.tsx' --include='*.mjs' 2>/dev/null"

expect_empty "S4.3-xss" "no raw HTML injection in the UI" \
  bash -c "set -o pipefail; grep -rn 'dangerouslySetInnerHTML\|innerHTML' src 2>/dev/null"

# ---------------------------------------------------------------------------
echo
echo "S6  Error handling"
# ---------------------------------------------------------------------------
# `catch (e: any)` disables every type check inside the handler. Comment lines are excluded:
# the errors.ts helpers document the pattern they exist to replace.
expect_empty "S6.1-catch-any" "no 'catch (e: any)' handlers" \
  bash -c "set -o pipefail; grep -rn 'catch ([a-zA-Z_]*: any)' src --include='*.ts' --include='*.tsx' 2>/dev/null | grep -vE ':[0-9]+:[[:space:]]*(\*|//)'"

# An empty catch swallows the failure entirely.
# Multi-line match, so grep cannot do it portably: `grep -P` does not exist on macOS, and the
# original check swallowed that error and reported PASS. perl ships on macOS and Linux alike; if
# it is missing the check is UNVERIFIED, never a silent pass.
empty_catches() { # dirs...
  find "$@" -type f \( -name '*.ts' -o -name '*.tsx' \) -print0 |
    xargs -0 perl -0777 -ne 'while (/catch\s*(\([^)]*\))?\s*\{\s*\}/g) { my $l = 1 + (substr($_, 0, $-[0]) =~ tr/\n//); print "$ARGV:$l: empty catch\n" }'
}
expect_empty "S6.2-empty-catch" "no silently empty catch blocks" empty_catches src

# ---------------------------------------------------------------------------
echo
echo "S8  Dependencies"
# ---------------------------------------------------------------------------
if need npm; then
  audit_json="$(npm audit --omit=dev --json 2>/dev/null)"
  if [ -z "$audit_json" ]; then
    record "S8.1-audit" UNVERIFIED "npm audit produced no output (offline?)"
  else
    counts="$(node -e "
      let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
        try{const a=JSON.parse(s);const m=a.metadata&&a.metadata.vulnerabilities||{};
        console.log((m.critical||0)+' '+(m.high||0)+' '+(m.moderate||0)+' '+(m.low||0));}
        catch(e){console.log('ERR');}});" <<<"$audit_json")"
    if [ "$counts" = "ERR" ]; then
      record "S8.1-audit" UNVERIFIED "could not parse npm audit output"
    else
      read -r crit high mod low <<<"$counts"
      if [ "$crit" -gt 0 ] || [ "$high" -gt 0 ]; then
        record "S8.1-audit" FAIL "$crit critical, $high high in production deps"
      elif [ "$mod" -gt 0 ] || [ "$low" -gt 0 ]; then
        record "S8.1-audit" PASS "no critical/high ($mod moderate, $low low)"
      else
        record "S8.1-audit" PASS "0 vulnerabilities in production deps"
      fi
    fi
  fi
else
  record "S8.1-audit" UNVERIFIED "npm not on PATH"
fi

# ---------------------------------------------------------------------------
echo
echo "S9  Frontend correctness that fails silently"
# ---------------------------------------------------------------------------
# Arbitrary values containing spaces produce NO CSS — the class attribute is split on
# whitespace. This shipped undetected for weeks, hence a permanent check.
expect_empty "S9.1-dead-classes" "no Tailwind arbitrary values containing spaces" \
  bash -c "set -o pipefail; grep -rnE '(bg|text|border|shadow|ring|from|to)-\[[^]]* [^]]*\]' src --include='*.tsx' 2>/dev/null"

expect_empty "S9.2-var-escape" "no raw var(--color-*) escape hatches" \
  bash -c "set -o pipefail; grep -rn '\[var(--color-' src --include='*.tsx' --include='*.ts' 2>/dev/null"

# Math.random()/Date.now() during render differ between server and client.
expect_empty "S9.3-render-impurity" "no Math.random/Date.now in a render path" \
  bash -c "set -o pipefail; grep -rn 'Math.random()\|Date.now()' src/components src/views --include='*.tsx' 2>/dev/null | grep -v 'useEffect\|onClick\|onSubmit\|=> {'"

# Raw palette values are fixed hex from Tailwind's default scale. They render, but they do
# not follow the light/dark switch — in light mode they are identical to dark. Every state
# colour must come from a semantic token (text-error, bg-warning/10) so it resolves through
# a CSS variable. See ui.md §8.
expect_empty "S9.4-raw-palette" "no raw Tailwind palette colours; state uses semantic tokens" \
  bash -c "set -o pipefail; grep -rnE '(bg|text|border|ring|from|to|via|fill|stroke|divide|placeholder)-(red|green|yellow|blue|orange|amber|emerald|lime|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-[0-9]{2,3}' src --include='*.tsx' 2>/dev/null"

# ---------------------------------------------------------------------------
echo
printf "%s\n" "────────────────────────────────────────────────────────"
printf "  ${GREEN}%d passed${RESET}   ${RED}%d failed${RESET}   ${YELLOW}%d unverified${RESET}\n" \
  "$PASS_COUNT" "$FAIL_COUNT" "$UNVERIFIED_COUNT"
echo

if [ "$WANT_LOG" = "1" ]; then
  mkdir -p security-log
  stamp="$(date -u '+%Y-%m-%dT%H-%M-%SZ')"
  logfile="security-log/${stamp}.md"
  {
    echo "# Security review — ${stamp}"
    echo
    echo "| Field | Value |"
    echo "| --- | --- |"
    echo "| Commit | \`$(git rev-parse --short HEAD 2>/dev/null || echo unknown)\` |"
    echo "| Branch | \`$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)\` |"
    echo "| Passed | ${PASS_COUNT} |"
    echo "| Failed | ${FAIL_COUNT} |"
    echo "| Unverified | ${UNVERIFIED_COUNT} |"
    echo
    echo "## Results"
    echo
    echo "| Check | Status | Detail |"
    echo "| --- | --- | --- |"
    for r in "${RESULTS[@]}"; do
      id="${r%%|*}"; rest="${r#*|}"; status="${rest%%|*}"; detail="${rest#*|}"
      echo "| \`${id}\` | ${status} | ${detail//|/\\|} |"
    done
    echo
    if [ "$UNVERIFIED_COUNT" -gt 0 ]; then
      echo "> **${UNVERIFIED_COUNT} check(s) could not be evaluated.** Unverified is not a pass."
      echo "> Each was retried once. Investigate before trusting this run."
      echo
    fi
    echo "Generated by \`scripts/security-review.sh\`. Checks are defined in [security-review.md](../security-review.md)."
  } > "$logfile"
  echo "log written: $logfile"
  echo
fi

[ "$FAIL_COUNT" -gt 0 ] && exit 1
[ "$STRICT" = "1" ] && [ "$UNVERIFIED_COUNT" -gt 0 ] && exit 2
exit 0
