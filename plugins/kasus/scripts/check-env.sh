#!/usr/bin/env bash
# /kasus:env — sjekker at runtime-env har det pluginen trenger, og svarer med
# --resolve hvilken Kasus-installasjon et kall FAKTISK ville truffet, og hvilken
# variabel hver verdi kom fra.
#
# Dette er den ENE kilden til sannhet for hva pluginen krever. Legger du til en
# ny variabel et sted i pluginen, skal den inn her også — ellers sier
# `/kasus:env` «ALT OK» mens kommandoen stopper, som er nøyaktig den stille
# fallbacken prinsippene forbyr.
#
# Leser KUN env-variabler. Ingen tilkobling, ingen nettverk, ingen nøkkelverdier
# i outputen.

set -u

# zsh splitter ikke uquotede lister; uten dette leses «a b» som ett element.
if [ -n "${ZSH_VERSION:-}" ]; then setopt shwordsplit; fi

HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/env.sh
. "$HERE/lib/env.sh"

RESOLVE=0
ENV_NAME=""

for arg in "$@"; do
  case "$arg" in
    --resolve) RESOLVE=1 ;;
    --help|-h)
      printf 'Bruk: check-env.sh [--resolve] [miljø]\n'
      exit 0
      ;;
    --*)
      printf 'Ukjent flagg: %s\n' "$arg" >&2
      exit 2
      ;;
    *) ENV_NAME="$arg" ;;
  esac
done

PROBLEMS=0
WARNINGS=0

# get_var <base> — skriver «<variabelnavn>\t<verdi>» for den varianten som
# vinner, eller «\t» hvis ingen er satt. Presedens: <BASE>_<ENV> før <BASE>.
# Motstykket i JS er readEnvValue() i lib/env.mjs; self-test.sh sammenligner dem.
get_var() {
  base="$1"
  if [ -n "$ENV_NAME" ]; then
    scoped="$(env_var "$base" "$ENV_NAME")"
    eval "value=\${$scoped-}"
    if [ -n "${value:-}" ]; then printf '%s\t%s' "$scoped" "$value"; return 0; fi
  fi
  eval "value=\${$base-}"
  if [ -n "${value:-}" ]; then printf '%s\t%s' "$base" "$value"; return 0; fi
  printf '\t'
}

name_of() { printf '%s' "$1" | cut -f1; }
value_of() { printf '%s' "$1" | cut -f2-; }

tried_names() {
  if [ -n "$ENV_NAME" ]; then
    printf '%s eller %s' "$(env_var "$1" "$ENV_NAME")" "$1"
  else
    printf '%s' "$1"
  fi
}

printf 'kasus — miljøsjekk\n'
if [ -n "$ENV_NAME" ]; then
  printf 'Miljø: %s (suffiks %s)\n' "$ENV_NAME" "$(env_suffix "$ENV_NAME")"
else
  printf 'Miljø: (ingen) — kun de delte variablene leses. Kjør med et miljønavn for per-miljø-oppslag.\n'
fi
printf '\n'

# --- Node ------------------------------------------------------------------
# fetch er innebygd fra Node 18. Verktøyet har ingen avhengigheter, så Node er
# hele forutsetningen.
if command -v node >/dev/null 2>&1; then
  NODE_VERSION="$(node --version 2>/dev/null)"
  NODE_MAJOR="$(printf '%s' "$NODE_VERSION" | sed 's/^v//' | cut -d. -f1)"
  if [ "${NODE_MAJOR:-0}" -ge 18 ] 2>/dev/null; then
    printf 'OK       node %s (innebygd fetch)\n' "$NODE_VERSION"
  else
    printf 'MANGLER: node 18+ kreves for innebygd fetch, fant %s\n' "$NODE_VERSION"
    PROBLEMS=$((PROBLEMS + 1))
  fi
else
  printf 'MANGLER: node finnes ikke på PATH. Verktøyet er avhengighetsfri ESM og krever Node 18+.\n'
  PROBLEMS=$((PROBLEMS + 1))
fi

# --- API-nøkkel (påkrevd) --------------------------------------------------
KEY_ROW="$(get_var KASUS_API_KEY)"
KEY_NAME="$(name_of "$KEY_ROW")"
KEY_VALUE="$(value_of "$KEY_ROW")"

if [ -z "$KEY_NAME" ]; then
  printf 'MANGLER: %s — API-nøkkel fra Kasus → Innstillinger → API-nøkler.\n' "$(tried_names KASUS_API_KEY)"
  PROBLEMS=$((PROBLEMS + 1))
else
  # Verdien ekkoes ALDRI. Lengden er nok for å se at det ikke er en tom streng
  # eller et avkuttet lim-inn.
  printf 'OK       %s = (satt, %s tegn)\n' "$KEY_NAME" "$(printf '%s' "$KEY_VALUE" | wc -c | tr -d ' ')"
  case "$KEY_VALUE" in
    kasus_sk_*) ;;
    *)
      printf 'ADVARSEL %s starter ikke med kasus_sk_ — er dette en Kasus-API-nøkkel?\n' "$KEY_NAME"
      WARNINGS=$((WARNINGS + 1))
      ;;
  esac
fi

# --- Base-URL (valgfri, defaulter) -----------------------------------------
URL_ROW="$(get_var KASUS_BASE_URL)"
URL_NAME="$(name_of "$URL_ROW")"
URL_VALUE="$(value_of "$URL_ROW")"

if [ -z "$URL_NAME" ]; then
  printf 'OK       %s = (usatt) → default https://app.kasus.io\n' "$(tried_names KASUS_BASE_URL)"
else
  case "$URL_VALUE" in
    http://*|https://*) printf 'OK       %s = %s\n' "$URL_NAME" "$URL_VALUE" ;;
    *)
      printf 'MANGLER: %s = «%s» — må starte med http:// eller https://\n' "$URL_NAME" "$URL_VALUE"
      PROBLEMS=$((PROBLEMS + 1))
      ;;
  esac
fi

# --- Timeout (valgfri, defaulter) ------------------------------------------
TMO_ROW="$(get_var KASUS_TIMEOUT_MS)"
TMO_NAME="$(name_of "$TMO_ROW")"
TMO_VALUE="$(value_of "$TMO_ROW")"

if [ -z "$TMO_NAME" ]; then
  printf 'OK       %s = (usatt) → default 30000 ms\n' "$(tried_names KASUS_TIMEOUT_MS)"
else
  case "$TMO_VALUE" in
    ''|*[!0-9]*)
      printf 'MANGLER: %s = «%s» — må være et positivt heltall (millisekunder)\n' "$TMO_NAME" "$TMO_VALUE"
      PROBLEMS=$((PROBLEMS + 1))
      ;;
    *) printf 'OK       %s = %s ms\n' "$TMO_NAME" "$TMO_VALUE" ;;
  esac
fi

# --- Artikkelmappe (valgfri, defaulter) ------------------------------------
DIR_ROW="$(get_var KASUS_ARTICLES_DIR)"
DIR_NAME="$(name_of "$DIR_ROW")"
DIR_VALUE="$(value_of "$DIR_ROW")"
if [ -z "$DIR_NAME" ]; then
  printf 'OK       %s = (usatt) → default ./artikler\n' "$(tried_names KASUS_ARTICLES_DIR)"
else
  printf 'OK       %s = %s\n' "$DIR_NAME" "$DIR_VALUE"
fi

# --- Kvitteringsfila (valgfri, defaulter) ----------------------------------
# Her ligger «siden sist». Stien SIES, fordi en kvittering ingen finner igjen er
# umulig å nullstille — og fordi en relativ sti tolkes fra der du står, ikke fra
# pluginmappa.
STATE_ROW="$(get_var KASUS_STATE_FILE)"
STATE_NAME="$(name_of "$STATE_ROW")"
STATE_VALUE="$(value_of "$STATE_ROW")"
if [ -z "$STATE_NAME" ]; then
  STATE_PATH="$PWD/.claude/kasus-state.json"
  printf 'OK       %s = (usatt) → default .claude/kasus-state.json\n' "$(tried_names KASUS_STATE_FILE)"
else
  case "$STATE_VALUE" in
    /*) STATE_PATH="$STATE_VALUE" ;;
    *) STATE_PATH="$PWD/$STATE_VALUE" ;;
  esac
  printf 'OK       %s = %s\n' "$STATE_NAME" "$STATE_VALUE"
fi
if [ -f "$STATE_PATH" ]; then
  printf 'OK       kvittering finnes: %s\n' "$STATE_PATH"
else
  printf 'OK       kvittering ikke opprettet ennå: %s (første runde viser siste 24 t)\n' "$STATE_PATH"
fi

# --- Mål-oppløsning --------------------------------------------------------
if [ "$RESOLVE" -eq 1 ]; then
  printf '\nMÅL-OPPLØSNING\n'
  printf '  Presedens per variabel: <BASE>_<ENV> vinner over <BASE>.\n'
  if [ -n "$ENV_NAME" ]; then
    printf '  Suffiks for «%s»: _%s\n' "$ENV_NAME" "$(env_suffix "$ENV_NAME")"
  else
    printf '  Uten miljønavn leses BARE den delte varianten.\n'
  fi
  printf '\n'
  if [ -z "$URL_NAME" ]; then
    printf '  Et kall ville truffet: app.kasus.io  (kilde: default, ingen konfigurasjon)\n'
  else
    printf '  Et kall ville truffet: %s  (kilde: %s)\n' \
      "$(printf '%s' "$URL_VALUE" | sed -e 's#^https\{0,1\}://##' -e 's#/.*$##')" "$URL_NAME"
  fi
  if [ -z "$KEY_NAME" ]; then
    printf '  Med nøkkel fra:        (ingen — kallet ville stoppet med MANGLER)\n'
  else
    printf '  Med nøkkel fra:        %s\n' "$KEY_NAME"
  fi
  printf '\n'
  printf '  Nøkkelen avgjør ORGANISASJONEN. Ingen organisasjons-id sendes, så et tomt\n'
  printf '  svar betyr «tomt for denne organisasjonen» — ikke «tomt i Kasus».\n'
fi

printf '\n'
if [ "$PROBLEMS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
  printf 'ALT OK\n'
  exit 0
fi
if [ "$PROBLEMS" -eq 0 ]; then
  printf 'OK med %s advarsel(er)\n' "$WARNINGS"
  exit 0
fi
printf '%s problem(er), %s advarsel(er)\n' "$PROBLEMS" "$WARNINGS"
exit 1
