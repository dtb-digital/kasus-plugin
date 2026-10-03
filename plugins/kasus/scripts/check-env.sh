#!/usr/bin/env bash
# /kasus:env — sjekker at det lokale oppsettet pluginen trenger er på plass, og
# svarer med --resolve hvilken Kasus-installasjon tilkoblingen går mot og hvor
# kvitteringen ligger.
#
# Dette er den ENE kilden til sannhet for hva pluginen krever LOKALT. Legger du
# til en ny variabel et sted i pluginen, skal den inn her også — ellers sier
# `/kasus:env` «ALT OK» mens kommandoen stopper, som er nøyaktig den stille
# fallbacken prinsippene forbyr.
#
# Innloggingen sjekkes IKKE her. Den er en OAuth-tilkobling Claude Code eier, og
# et skall kan ikke se den: `/kasus:env` kaller MCP-verktøyet get_organization
# etter dette skriptet, og det er svaret derfra som sier om tilkoblingen virker.
#
# Leser KUN env-variabler og filer i pluginen. Ingen nettverk.

set -u

# zsh splitter ikke uquotede lister; uten dette leses «a b» som ett element.
if [ -n "${ZSH_VERSION:-}" ]; then setopt shwordsplit; fi

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

RESOLVE=0
for arg in "$@"; do
  case "$arg" in
    --resolve) RESOLVE=1 ;;
    --help|-h)
      printf 'Bruk: check-env.sh [--resolve]\n'
      exit 0
      ;;
    *)
      printf 'Ukjent argument: %s\n' "$arg" >&2
      exit 2
      ;;
  esac
done

PROBLEMS=0
WARNINGS=0
ok() { printf 'OK       %s\n' "$1"; }
missing() { printf 'MANGLER: %s\n' "$1"; PROBLEMS=$((PROBLEMS + 1)); }
warn() { printf 'ADVARSEL: %s\n' "$1"; WARNINGS=$((WARNINGS + 1)); }

printf 'kasus — miljøsjekk\n\n'

# --- Node ------------------------------------------------------------------
# Kvitteringen er et Node-skript. Uten Node kan saksløpet hente, men ikke vite hva
# som er nytt — og ikke kvittere.
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || printf '0')"
  if [ "${NODE_MAJOR:-0}" -ge 18 ]; then
    ok "node ${NODE_MAJOR} (kvitteringen krever 18+)"
  else
    missing "node 18 eller nyere — fant ${NODE_MAJOR}. Kvitteringen («siden sist») kjører ikke uten."
  fi
else
  missing "node — kvitteringen («siden sist») kjører ikke uten. Installer Node 18+."
fi

# --- MCP-tilkoblingen ------------------------------------------------------
MCP_JSON="$ROOT/.mcp.json"
if [ -f "$MCP_JSON" ] && grep -q '"kasus"' "$MCP_JSON"; then
  ok ".mcp.json kobler til Kasus (server «kasus»)"
else
  missing ".mcp.json med serveren «kasus» i pluginroten — uten den finnes ingen Kasus-verktøy. Installer pluginen på nytt."
fi

DEFAULT_MCP_URL="https://app.kasus.io/api/mcp"
MCP_URL="${KASUS_MCP_URL:-}"
if [ -n "$MCP_URL" ]; then
  case "$MCP_URL" in
    http://*|https://*) ok "KASUS_MCP_URL er satt: ${MCP_URL}" ;;
    *) missing "gyldig KASUS_MCP_URL — «${MCP_URL}» må starte med http:// eller https://" ;;
  esac
  MCP_SOURCE="KASUS_MCP_URL"
else
  MCP_URL="$DEFAULT_MCP_URL"
  MCP_SOURCE="default"
  ok "KASUS_MCP_URL er ikke satt — default ${DEFAULT_MCP_URL}"
fi

# Restene av HTTP-oppsettet. De gjør ingen skade, men de er ikke i bruk — og en
# som ser dem tror at det er de som avgjør organisasjonen.
for gammel in KASUS_API_KEY KASUS_BASE_URL KASUS_TIMEOUT_MS; do
  eval "verdi=\${${gammel}-}"
  if [ -n "${verdi:-}" ]; then
    warn "${gammel} er satt, men brukes ikke lenger — pluginen kobler til via MCP med innlogging. Kan fjernes fra env."
  fi
done

# --- Kvitteringen ----------------------------------------------------------
STATE_FILE="${KASUS_STATE_FILE:-.claude/kasus-state.json}"
case "$STATE_FILE" in
  /*) STATE_PATH="$STATE_FILE" ;;
  *) STATE_PATH="$(pwd)/${STATE_FILE}" ;;
esac
STATE_DIR="$(dirname "$STATE_PATH")"
PROBE_DIR="$STATE_DIR"
while [ ! -d "$PROBE_DIR" ] && [ "$PROBE_DIR" != "/" ]; do PROBE_DIR="$(dirname "$PROBE_DIR")"; done
if [ -w "$PROBE_DIR" ]; then
  ok "kvitteringen kan skrives: ${STATE_PATH}"
else
  missing "skrivetilgang til ${STATE_DIR} — kvitteringen kan ikke lagres. Sett KASUS_STATE_FILE til en sti du kan skrive til."
fi
if [ -f "$STATE_PATH" ] && ! python3 -c "import json,sys;json.load(open(sys.argv[1]))" "$STATE_PATH" 2>/dev/null; then
  missing "kvitteringsfila ${STATE_PATH} er ikke gyldig JSON — kjør «kasus.mjs kvitter --org <slug> --reset», eller slett fila."
fi

# --- Mål-oppløsning --------------------------------------------------------
if [ "$RESOLVE" -eq 1 ]; then
  printf '\nMÅL\n'
  printf '  Kasus:          %s (%s)\n' "$MCP_URL" "$MCP_SOURCE"
  printf '  Innlogging:     OAuth via /mcp → plugin:kasus:kasus. Organisasjonen velges ved innlogging.\n'
  printf '  Kvittering:     %s (%s)\n' "$STATE_PATH" "$([ -n "${KASUS_STATE_FILE:-}" ] && printf 'KASUS_STATE_FILE' || printf 'default')"
  printf '                  nøklet på vert + organisasjonens slug\n'
fi

printf '\n'
if [ "$PROBLEMS" -eq 0 ]; then
  printf 'ALT OK lokalt%s. Om innloggingen virker, svarer get_organization på.\n' \
    "$([ "$WARNINGS" -gt 0 ] && printf ' (%s advarsel(er))' "$WARNINGS")"
  exit 0
fi
printf '%s ting mangler\n' "$PROBLEMS"
exit 1
