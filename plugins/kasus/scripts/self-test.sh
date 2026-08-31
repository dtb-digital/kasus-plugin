#!/usr/bin/env bash
# /kasus:test — selvtest av pluginen.
#
# Tørt (default): syntaks på alle skript, at komponentmappene ikke er tomme, at
# manifestene er gyldig JSON, at verktøyets --list-kontrakt holder, at
# kommandoene bare refererer til modi som FINNES, at enhetstestene er grønne, og
# at mål-presedensen er den samme i shell og JS.
#
# --live: i tillegg et ekte kall mot API-et, og en verifisering av at serveren
# FAKTISK avviser skriv — ikke bare at pluginen ikke prøver.

set -u

if [ -n "${ZSH_VERSION:-}" ]; then setopt shwordsplit; fi

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
# shellcheck source=lib/env.sh
. "$HERE/lib/env.sh"

LIVE=0
ENV_NAME=""
for arg in "$@"; do
  case "$arg" in
    --live) LIVE=1 ;;
    --help|-h) printf 'Bruk: self-test.sh [--live] [miljø]\n'; exit 0 ;;
    --*) printf 'Ukjent flagg: %s\n' "$arg" >&2; exit 2 ;;
    *) ENV_NAME="$arg" ;;
  esac
done

FAILED=0
pass() { printf 'OK    %s\n' "$1"; }
fail() { printf 'FEIL  %s\n' "$1"; FAILED=$((FAILED + 1)); }

printf 'kasus — selvtest%s\n\n' "$([ "$LIVE" -eq 1 ] && printf ' (--live)')"

# --- 1. Syntaks ------------------------------------------------------------
# Bash-verktøyet kan bruke bash, sh eller zsh, så shell-skript må sjekkes i
# begge dialekter. En zsh-only feil dukker ellers opp hos brukeren, ikke her.
for f in $(find "$ROOT/scripts" -name '*.sh' | sort); do
  rel="${f#"$ROOT"/}"
  if bash -n "$f" 2>/dev/null && zsh -n "$f" 2>/dev/null; then
    pass "syntaks (bash+zsh): $rel"
  else
    fail "syntaks: $rel"
  fi
done

for f in $(find "$ROOT/scripts" -name '*.mjs' | sort); do
  rel="${f#"$ROOT"/}"
  if node --check "$f" >/dev/null 2>&1; then
    pass "syntaks (node): $rel"
  else
    fail "syntaks: $rel"
  fi
done

# --- 1b. Shell-felle: $VAR rett foran et ikke-ASCII-tegn -------------------
# En ubeskyttet variabel klemt mellom typografiske anfoerselstegn er en tikkende
# bombe: bash 3.2 (den som er paa macOS) med UTF-8-locale leser de multibyte
# bytene som en DEL AV variabelnavnet, og feiler med «ORG?: unbound variable»
# under `set -u`. zsh gjør det ikke, så feilen finnes
# bare i den ene av de to dialektene Bash-verktøyet kan velge — og bare når
# locale er satt. Verifisert: identisk linje virker med tom env og kræsjer med
# LANG=en_US.UTF-8. `${ORG}` er entydig uansett locale.
#
# Sjekken bruker python3 framfor `grep -P`, som ikke finnes i BSD-grep overalt.
if find "$ROOT/scripts" -name '*.sh' -print0 | python3 -c '
import re, sys
pattern = re.compile(r"\$[A-Za-z_][A-Za-z0-9_]*[^\x00-\x7F\s]")
bad = []
for path in sys.stdin.buffer.read().split(b"\0"):
    if not path:
        continue
    name = path.decode()
    for n, raw in enumerate(open(name, "rb").read().split(b"\n"), 1):
        line = raw.decode("utf-8", "replace")
        if pattern.search(line):
            bad.append(name + ":" + str(n))
if bad:
    print(" ".join(bad))
    sys.exit(1)
' >/dev/null 2>&1; then
  pass "ingen \$VAR rett foran et ikke-ASCII-tegn (bruk \${VAR})"
else
  fail "\$VAR rett foran et ikke-ASCII-tegn — bruk \${VAR}, ellers feiler bash med UTF-8-locale:"
  find "$ROOT/scripts" -name '*.sh' -print0 | python3 -c '
import re, sys
pattern = re.compile(r"\$[A-Za-z_][A-Za-z0-9_]*[^\x00-\x7F\s]")
for path in sys.stdin.buffer.read().split(b"\0"):
    if not path:
        continue
    name = path.decode()
    for n, raw in enumerate(open(name, "rb").read().split(b"\n"), 1):
        line = raw.decode("utf-8", "replace")
        if pattern.search(line):
            print("      " + name + ":" + str(n) + ": " + line.strip())
'
fi

# --- 2. Komponentmapper ----------------------------------------------------
# Kommandoer og agenter registreres ikke noe sted — de oppdages fra mappa. En
# tom mappe er derfor en plugin uten kommandoer, ikke en feilmelding.
for dir in commands agents references; do
  count="$(find "$ROOT/$dir" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
  if [ "$count" -gt 0 ]; then
    pass "$dir/ har $count fil(er)"
  else
    fail "$dir/ er tom — komponentene oppdages fra mappa, så ingenting lastes"
  fi
done

# --- 3. Manifest -----------------------------------------------------------
MANIFEST="$ROOT/.claude-plugin/plugin.json"
if python3 -c "import json;json.load(open('$MANIFEST'))" 2>/dev/null; then
  pass "plugin.json er gyldig JSON"
else
  fail "plugin.json er ikke gyldig JSON"
fi

PLUGIN_VERSION="$(python3 -c "import json;print(json.load(open('$MANIFEST'))['version'])" 2>/dev/null || printf '')"
TOOL_VERSION="$(node "$ROOT/scripts/kasus/kasus.mjs" --list --json 2>/dev/null | python3 -c 'import json,sys;print(json.load(sys.stdin)["version"])' 2>/dev/null || printf '')"
if [ -n "$PLUGIN_VERSION" ] && [ "$PLUGIN_VERSION" = "$TOOL_VERSION" ]; then
  pass "versjon er den samme i plugin.json og verktøyet ($PLUGIN_VERSION)"
else
  fail "versjonsdrift: plugin.json=«${PLUGIN_VERSION}», kasus.mjs=«${TOOL_VERSION}»"
fi

# Marketplace-oppføringen har sin EGEN versjon og beskrivelse, og de driftet fra
# plugin.json første gang de ble endret hver for seg. Fila følger ikke med en
# installert plugin, så sjekken hopper over når den ikke finnes — da kjører vi
# fra en installasjon, ikke fra repoet.
MARKET="$(cd "$ROOT/../.." 2>/dev/null && pwd)/.claude-plugin/marketplace.json"
if [ -f "$MARKET" ]; then
  MARKET_VERSION="$(MARKET_FILE="$MARKET" python3 -c '
import json, os
m = json.load(open(os.environ["MARKET_FILE"]))
print(next((p["version"] for p in m["plugins"] if p["name"] == "kasus"), ""))
' 2>/dev/null || printf '')"
  if [ "$MARKET_VERSION" = "$PLUGIN_VERSION" ]; then
    pass "versjon er den samme i marketplace.json ($MARKET_VERSION)"
  else
    fail "versjonsdrift: plugin.json=«${PLUGIN_VERSION}», marketplace.json=«${MARKET_VERSION}»"
  fi
fi

# Agentens `name:` må matche filnavnet, ellers lastes den ikke.
for f in $(find "$ROOT/agents" -name '*.md' | sort); do
  base="$(basename "$f" .md)"
  declared="$(sed -n 's/^name:[[:space:]]*//p' "$f" | head -1)"
  if [ "$base" = "$declared" ]; then
    pass "agent-navn matcher filnavn: $base"
  else
    fail "agent $base har name: «${declared}» — må matche filnavnet"
  fi
done

# --- 4. Verktøy-kontrakten -------------------------------------------------
LIST_JSON="$(node "$ROOT/scripts/kasus/kasus.mjs" --list --json 2>/dev/null || printf '')"
if [ -z "$LIST_JSON" ]; then
  fail "kasus.mjs --list --json ga ingen output"
else
  if printf '%s' "$LIST_JSON" | python3 -c '
import json, sys
m = json.load(sys.stdin)
assert m["tool"] == "kasus", "tool skal være kasus"
assert m["readOnly"] is True, "readOnly skal være true"
assert m["modes"], "ingen modi i manifestet"
for mode in m["modes"]:
    navn = mode["name"]
    assert navn, "modus uten navn"
    assert mode["summary"], "modus " + navn + " mangler summary"
    assert isinstance(mode["flags"], list) and mode["flags"], "modus " + navn + " mangler flagg"
    for common in ("env", "json"):
        assert common in mode["flags"], "modus " + navn + " mangler --" + common
' 2>/dev/null; then
    pass "kasus.mjs --list --json oppfyller manifest-kontrakten"
  else
    fail "kasus.mjs --list --json bryter manifest-kontrakten"
  fi
fi

# Kommandoene kaller verktøyet med modus-navn. En modus som fjernes eller får
# nytt navn skal bli en rød test her, ikke en kommando som feiler hos brukeren.
MODES="$(printf '%s' "$LIST_JSON" | python3 -c 'import json,sys;print(" ".join(m["name"] for m in json.load(sys.stdin)["modes"]))' 2>/dev/null || printf '')"
USED="$(grep -rhoE 'kasus\.mjs[[:space:]]+[a-z][a-z-]*' "$ROOT/commands" "$ROOT/agents" 2>/dev/null | awk '{print $2}' | sort -u)"
UNKNOWN=""
for used in $USED; do
  case " $MODES " in
    *" $used "*) ;;
    *) UNKNOWN="$UNKNOWN $used" ;;
  esac
done
if [ -z "$UNKNOWN" ]; then
  pass "alle modi kommandoene refererer til finnes i verktøyet"
else
  fail "kommandoer/agenter kaller ukjente modi:$UNKNOWN (kjente: $MODES)"
fi

# --- 5. Enhetstester -------------------------------------------------------
if node --test "$ROOT/scripts/kasus/" >"${TMPDIR:-/tmp}/kasus-unit-$$.log" 2>&1; then
  pass "enhetstester ($(grep -c '^ok ' "${TMPDIR:-/tmp}/kasus-unit-$$.log" | tr -d ' ') tester)"
else
  fail "enhetstester feilet:"
  sed -n '/^not ok/,+8p' "${TMPDIR:-/tmp}/kasus-unit-$$.log" | sed 's/^/      /'
fi
rm -f "${TMPDIR:-/tmp}/kasus-unit-$$.log"

# --- 6. Mål-presedens: shell vs JS ----------------------------------------
# De to har driftet fra hverandre i en annen plugin før: shell mappet a-z- til
# A-Z_, JS brukte bare toUpperCase(). Resultatet var at env-sjekken ba om
# KASUS_API_KEY_PRE_PROD mens verktøyet leste KASUS_API_KEY_PRE-PROD.
PARITY_FAIL=0
for env_case in production staging pre-prod PRE-PROD test-env-2 a; do
  shell_out="$(env_suffix "$env_case")"
  js_out="$(node --input-type=module -e "
import { envSuffix } from '$ROOT/scripts/lib/env.mjs';
process.stdout.write(envSuffix('$env_case'));
" 2>/dev/null)"
  if [ "$shell_out" != "$js_out" ]; then
    fail "presedens-drift for «${env_case}»: shell=«${shell_out}», js=«${js_out}»"
    PARITY_FAIL=1
  fi
done
[ "$PARITY_FAIL" -eq 0 ] && pass "env-suffiks er identisk i shell og JS (6 miljøer)"

# --- 7. Read-only: ingen skrivende kodesti --------------------------------
if grep -rnE 'method:[[:space:]]*"(POST|PUT|PATCH|DELETE)"' "$ROOT/scripts" >/dev/null 2>&1; then
  fail "et skript har en skrivende HTTP-metode — pluginen skal kun gjøre GET"
else
  pass "ingen skrivende HTTP-metode i scripts/"
fi

# --- 8. Live ---------------------------------------------------------------
if [ "$LIVE" -eq 1 ]; then
  printf '\nLIVE\n'
  ENV_FLAG=""
  [ -n "$ENV_NAME" ] && ENV_FLAG="--env $ENV_NAME"

  OUT="${TMPDIR:-/tmp}/kasus-live-$$.json"
  ERR="${TMPDIR:-/tmp}/kasus-live-$$.err"

  if node "$ROOT/scripts/kasus/kasus.mjs" profile $ENV_FLAG --json >"$OUT" 2>"$ERR"; then
    ORG="$(ORG_FILE="$OUT" python3 -c 'import json, os; print(json.load(open(os.environ["ORG_FILE"]))["data"][0]["organization"]["name"])' 2>/dev/null)"
    [ -z "${ORG:-}" ] && ORG="(navn ikke i svaret)"
    pass "tilkobling virker — nøkkelen tilhører organisasjonen «${ORG}»"
  else
    fail "kall mot /api/v1/profile feilet:"
    sed 's/^/      /' "$ERR"
  fi

  if node "$ROOT/scripts/kasus/kasus.mjs" signals $ENV_FLAG --limit 1 >/dev/null 2>"$ERR"; then
    pass "signals-endepunktet svarer"
  else
    fail "signals-endepunktet feilet:"
    sed 's/^/      /' "$ERR"
  fi

  # Artiklene er halve runden — «har vi dekket dette før?» er ikke mulig å svare
  # på uten dem, og et manglende endepunkt ville ellers dukket opp midt i en runde.
  if node "$ROOT/scripts/kasus/kasus.mjs" articles $ENV_FLAG --limit 1 >"$OUT" 2>"$ERR"; then
    if grep -q "Ingen egne artikler" "$OUT"; then
      pass "articles-endepunktet svarer — men organisasjonen har ingen artikler synkronisert"
    else
      pass "articles-endepunktet svarer"
    fi
  else
    fail "articles-endepunktet feilet:"
    sed 's/^/      /' "$ERR"
  fi

  # Verifiser at SERVEREN avviser skriv, ikke bare at pluginen ikke prøver.
  # Ruten har ingen POST-handler, så et 405/404 er beviset. Ingen sideeffekt.
  BASE="$(KASUS_SELFTEST_ENV="$ENV_NAME" node --input-type=module -e "
import { resolveTarget } from '$ROOT/scripts/kasus/targets.mjs';
const env = process.env.KASUS_SELFTEST_ENV || null;
process.stdout.write(resolveTarget({ env }).baseUrl);
" 2>/dev/null)"
  if [ -n "$BASE" ]; then
    CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/signals" 2>/dev/null || printf '000')"
    case "$CODE" in
      405|404|401|403) pass "serveren avviser POST /api/v1/signals ($CODE) — API-et er read-only" ;;
      000) fail "fikk ikke kontakt med $BASE for skrive-sjekken" ;;
      *) fail "POST /api/v1/signals svarte $CODE — forventet 405/404/401/403" ;;
    esac
  else
    fail "kunne ikke løse base-URL for skrive-sjekken"
  fi
  rm -f "$OUT" "$ERR"
fi

printf '\n'
if [ "$FAILED" -eq 0 ]; then
  printf 'ALT OK\n'
  exit 0
fi
printf '%s test(er) feilet\n' "$FAILED"
exit 1
