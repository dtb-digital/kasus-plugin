#!/usr/bin/env bash
# /kasus:test — selvtest av pluginen.
#
# Tørt (default): syntaks på alle skript, at komponentmappene ikke er tomme, at
# ferdighetene har navn som matcher mappa, at saksløpet bare kvitteres fra ett sted
# og krever et signal, at statusen henter begge vinduene sine, at hjelpen nevner
# alle inngangene som finnes, at inngangen henter alle fire kildene og sier at
# lista er rå, at inngangen og saksløpet deler vindusregel, at ingen ferdighet
# starter fra en story-brief, at alt brukervendt legger fram etter den felles
# samtaleformen, at
# manifestene er gyldig JSON, at verktøyets --list-kontrakt holder, at
# kommandoene bare refererer til modi som FINNES, at MCP-oppsettet er på plass,
# at hvert MCP-verktøy i en verktøyliste finnes, og at enhetstestene er grønne.
#
# Tilkoblingen til Kasus testes ikke her: den er en MCP-server Claude Code
# kobler til, og bare Claude kan kalle den. `/kasus:test --live` gjør det.

set -u

if [ -n "${ZSH_VERSION:-}" ]; then setopt shwordsplit; fi

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

for arg in "$@"; do
  case "$arg" in
    --help|-h) printf 'Bruk: self-test.sh\n'; exit 0 ;;
    *) printf 'Ukjent argument: %s (tilkoblingen testes av /kasus:test --live, ikke her)\n' "$arg" >&2; exit 2 ;;
  esac
done

FAILED=0
pass() { printf 'OK    %s\n' "$1"; }
fail() { printf 'FEIL  %s\n' "$1"; FAILED=$((FAILED + 1)); }

printf 'kasus — selvtest\n\n'

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
# Kommandoer, agenter og ferdigheter registreres ikke noe sted — de oppdages fra
# mappa. En tom mappe er derfor en plugin uten kommandoer, ikke en feilmelding.
# `skills/` er den viktigste av dem: SAKSLØPET bor der, og den har ingen kommando —
# er mappa tom, finnes ikke arbeidsflyten.
for dir in commands agents skills references; do
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

# En ferdighets `name:` må matche MAPPENAVNET (ikke filnavnet — fila heter alltid
# SKILL.md), ellers lastes den ikke.
for f in $(find "$ROOT/skills" -name 'SKILL.md' 2>/dev/null | sort); do
  dirname_="$(basename "$(dirname "$f")")"
  declared="$(sed -n 's/^name:[[:space:]]*//p' "$f" | head -1)"
  if [ "$dirname_" = "$declared" ]; then
    pass "ferdighet-navn matcher mappenavn: $dirname_"
  else
    fail "ferdigheten $dirname_ har name: «${declared}» — må matche mappenavnet"
  fi
  if ! sed -n '2,20p' "$f" | grep -q '^description:'; then
    fail "ferdigheten $dirname_ mangler description: — uten den trigges den aldri i fritekst"
  fi
done

# Saksløpet er selve pluginen, og den har ingen kommando som ville feilet i stedet:
# får ferdigheten nytt navn eller forsvinner, er arbeidsflyten borte uten at noe
# annet sier fra. Derfor er den navngitt her.
ROUND_SKILL="$ROOT/skills/dybdeartikkel/SKILL.md"
if [ -f "$ROUND_SKILL" ]; then
  pass "saksløpet finnes som ferdighet: skills/dybdeartikkel/SKILL.md"
else
  fail "skills/dybdeartikkel/SKILL.md mangler — pluginen har ingen arbeidsflyt"
fi

# `/kasus:start` henter dataene og spør hva journalisten vil gjøre. Den skal ikke
# GJØRE det: researchen er saksløpets steg 4, og en kommando som sender ut
# researchagenter har sluttet å være en inngang og blitt en halv arbeidsflyt med
# egne steg som kan drifte fra ferdighetens. `kvitter`-forbudet over dekker
# skrivingen; dette dekker arbeidet før den.
RESEARCHERE=""
for f in $(find "$ROOT/commands" -name '*.md' 2>/dev/null | sort); do
  if grep -q 'kasus-researcher' "$f"; then
    RESEARCHERE="$RESEARCHERE ${f#"$ROOT"/}"
  fi
done
if [ -n "$RESEARCHERE" ]; then
  fail "disse kommandoene sender ut researchagenter:$RESEARCHERE — arbeidet skjer i ferdighetene"
else
  pass "ingen kommando gjør researchen (den hører i saksløpet)"
fi

# --- 4. Verktøy-kontrakten -------------------------------------------------
LIST_JSON="$(node "$ROOT/scripts/kasus/kasus.mjs" --list --json 2>/dev/null || printf '')"
if [ -z "$LIST_JSON" ]; then
  fail "kasus.mjs --list --json ga ingen output"
else
  if printf '%s' "$LIST_JSON" | python3 -c '
import json, sys
m = json.load(sys.stdin)
assert m["tool"] == "kasus", "tool skal være kasus"
assert m["network"] is False, "verktøyet skal ikke ha nettverk — dataene kommer fra MCP"
assert m["modes"], "ingen modi i manifestet"
for mode in m["modes"]:
    navn = mode["name"]
    assert navn, "modus uten navn"
    assert mode["summary"], "modus " + navn + " mangler summary"
    assert isinstance(mode["flags"], list) and mode["flags"], "modus " + navn + " mangler flagg"
    for common in ("org", "json"):
        assert common in mode["flags"], "modus " + navn + " mangler --" + common
' 2>/dev/null; then
    pass "kasus.mjs --list --json oppfyller manifest-kontrakten"
  else
    fail "kasus.mjs --list --json bryter manifest-kontrakten"
  fi
fi

# Kommandoene, agentene og ferdighetene kaller verktøyet med modus-navn. En modus som fjernes eller får
# nytt navn skal bli en rød test her, ikke en kommando som feiler hos brukeren.
MODES="$(printf '%s' "$LIST_JSON" | python3 -c 'import json,sys;print(" ".join(m["name"] for m in json.load(sys.stdin)["modes"]))' 2>/dev/null || printf '')"
USED="$(grep -rhoE 'kasus\.mjs[[:space:]]+[a-z][a-z-]*' "$ROOT/commands" "$ROOT/agents" "$ROOT/skills" 2>/dev/null | awk '{print $2}' | sort -u)"
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

# --- 4b. Hvem som får kvittere -------------------------------------------
# Kommandoene og agentene lover at de ALDRI kvitterer, og et løfte i en prompt er
# lett å bryte ved en senere redigering — så det håndheves her.
#
# Agentene er den farlige halvparten: de har Bash, de trigges av naturlig språk,
# og en kvittering fra en av dem ville tømt saksløpet for signaler UTEN at noen ba
# om det. En kvittering er heller ikke til å angre — «siden sist» er borte.
KVITTERERE=""
for f in $(find "$ROOT/commands" "$ROOT/agents" -name '*.md' 2>/dev/null | sort); do
  [ -f "$f" ] || continue
  if grep -qE 'kasus\.mjs[[:space:]]+kvitter' "$f"; then
    KVITTERERE="$KVITTERERE ${f#"$ROOT"/}"
  fi
done
if [ -n "$KVITTERERE" ]; then
  fail "disse kaller «kvitter», men skal være rent lesende:$KVITTERERE"
else
  pass "kommandoer og agenter kvitterer aldri (bare ferdighetene gjør det)"
fi

# Ferdighetene får kvittere, men bare SAKSLØPET får flytte tidspunktet. En
# oppfølgersak behandler ett signal av gangen og skal kvittere for nettopp det
# (`--ids-only`) — en full kvittering derfra ville svelget en hel dags signaler
# journalisten aldri fikk se, og det er ikke til å angre (prinsipp 9).
for f in $(find "$ROOT/skills" -name 'SKILL.md' 2>/dev/null | sort); do
  [ "$f" = "$ROUND_SKILL" ] && continue
  rel="${f#"$ROOT"/}"
  ANTALL="$(grep -cE 'kasus\.mjs[[:space:]]+kvitter' "$f" 2>/dev/null | tr -d ' ')"
  if [ "${ANTALL:-0}" -eq 0 ]; then
    pass "$rel kvitterer ikke"
    continue
  fi
  BARE_IDS=1
  while IFS= read -r linje; do
    case "$linje" in
      ""|*--ids-only*) ;;
      *) BARE_IDS=0 ;;
    esac
  done <<KVITT
$(grep -hE 'kasus\.mjs[[:space:]]+kvitter' "$f" 2>/dev/null)
KVITT
  if [ "$BARE_IDS" -eq 1 ]; then
    pass "$rel kvitterer bare med --ids-only (flytter ikke tidspunktet)"
  else
    fail "$rel kvitterer UTEN --ids-only — bare saksløpet får flytte «siden sist»"
  fi
done

# ...og saksløpet må FAKTISK kvittere. Et steg som forsvinner i en omskriving gir
# et saksløp som viser de samme signalene i morgen, uten at noe feiler.
if grep -qE 'kasus\.mjs[[:space:]]+kvitter' "$ROUND_SKILL" 2>/dev/null; then
  pass "saksløpet kvitterer (steg 4d/5 er intakt)"
else
  fail "saksløpet kaller ikke «kvitter» — «siden sist» ville stått stille"
fi

# --- 4b-bis. En brief er ikke opphavet til et saksforslag -----------------
# `story-briefs` henter Kasus' EGNE saksforslag, laget av innholdspipelinen.
# Inngangen LEGGER DEM FRAM — «er dette alt tenkt på?» er et reelt spørsmål før
# man setter i gang — men ingen FERDIGHET får bygge et saksforslag på en brief.
# Saksløpet krever et signal: sporet tilbake til hvorfor saken ble tatt opp
# (`kasusSignalId`, `signalUrl`) er halve verdien av fila, og en brief har ikke
# det sporet. Kunne en ferdighet starte fra en brief, ville forslaget fått et
# opphav ingen kan slå opp — og det er usynlig i filen etterpå.
#
# Grensen går derfor mellom å VISE og å STARTE FRA: commands/ er utenfor,
# skills/ og agents/ er innenfor.
BRIEFBRUKERE=""
for f in $(find "$ROOT/agents" "$ROOT/skills" -name '*.md' 2>/dev/null | sort); do
  [ -f "$f" ] || continue
  if grep -qE '(list|get|search)_story_briefs?' "$f"; then
    BRIEFBRUKERE="${BRIEFBRUKERE} ${f#"$ROOT"/}"
  fi
done
if [ -n "$BRIEFBRUKERE" ]; then
  fail "disse henter story-briefs:${BRIEFBRUKERE} — en ferdighet kan ikke bygge et forslag på en brief"
else
  pass "ingen ferdighet eller agent starter fra en story-brief (saksløpet krever et signal)"
fi

# --- 4c. Signalet er inngangsvilkåret -------------------------------------
# Saksløpet skriver ikke et saksforslag uten et signal: sporet tilbake til hvorfor
# saken ble tatt opp (`kasusSignalId`, `signalUrl`) er halve verdien av filen, og
# et forslag uten opphav ser ut som noe det ikke er. Regelen sto i prosa i to
# filer og ble myket opp én gang før — så den håndheves her.
if grep -q 'Signalet er inngangsvilkåret' "$ROUND_SKILL" 2>/dev/null; then
  pass "saksløpet krever et signal (vilkåret står i SKILL.md)"
else
  fail "SKILL.md mangler «Signalet er inngangsvilkåret» — saksløpet kan skrive uten opphav"
fi

# Oppfølgersaken har sitt eget inngangsvilkår: et NYTT faktum med kilde. Uten det
# er en oppfølger den samme saken publisert to ganger.
FOLLOWUP_SKILL="$ROOT/skills/oppfolgersak/SKILL.md"
if [ -f "$FOLLOWUP_SKILL" ]; then
  if grep -q 'Vilkåret: noe NYTT' "$FOLLOWUP_SKILL"; then
    pass "oppfølgersaken krever noe nytt (vilkåret står i SKILL.md)"
  else
    fail "oppfolgersak mangler «Vilkåret: noe NYTT» — en gjentakelse ville passert"
  fi
fi

# Formatet må dokumentere BEGGE opphav, ellers skriver en av ferdighetene en fil
# med felt formatet ikke kjenner.
FORMAT="$ROOT/references/proposal-format.md"
if grep -q 'kasusArtikkelId' "$FORMAT" && grep -q 'kasusSignalId' "$FORMAT"; then
  pass "proposal-format dokumenterer begge opphav (signal og egen artikkel)"
else
  fail "proposal-format mangler ett av opphavene — kasusSignalId og kasusArtikkelId"
fi

# En `kasusSignalId: null` noe sted er signalfri-stien som sniker seg inn igjen.
NULLSIGNAL="$(grep -rl 'kasusSignalId: *null' "$ROOT/skills" "$ROOT/references" 2>/dev/null | sed "s|$ROOT/||" | tr '\n' ' ')"
if [ -n "$NULLSIGNAL" ]; then
  fail "disse tillater et saksforslag uten signal: $NULLSIGNAL"
else
  pass "ingen «kasusSignalId: null» — forslaget kan ikke skrives uten opphav"
fi

# --- 4c-bis. Inngangen legger fram ALT materialet -------------------------
# `/kasus:start` er statusen «hva er nytt siden sist» (`nytt`, som kjenner
# kvitteringen) PLUSS de tre kildene journalisten velger mellom: radarsignalene,
# Kasus' egne story-briefs og redaksjonens egne ferske artikler. Faller én av dem
# ut i en forenkling, forsvinner et helt neste-steg fra inngangen uten at noe sier
# fra — mangler artiklene, kan ingen velge en oppfølger; mangler signalene, kan
# ingen velge en dybdeartikkel.
#
# Inngangen BEARBEIDER ikke, og gjør det med vilje: den henter vinduene selv
# framfor å sende ut `kasus-triage`, så journalisten ser materialet slik det
# ligger. Prisen er kontekst (~200 elementer i samtalen) og at ingenting er luket
# — begge forbeholdene skal stå i kommandoen, og det sjekkes under.
STATUS_CMD="$ROOT/commands/start.md"
TRIAGE_AGENT="$ROOT/agents/kasus-triage.md"
if [ -f "$STATUS_CMD" ]; then
  MANGLENDE_KALL=""
  grep -qE 'kasus\.mjs[[:space:]]+vindu' "$STATUS_CMD" || MANGLENDE_KALL="${MANGLENDE_KALL} vindu"
  for verktoy in get_organization list_radar_signals list_story_briefs list_articles; do
    grep -q "$verktoy" "$STATUS_CMD" || MANGLENDE_KALL="${MANGLENDE_KALL} ${verktoy}"
  done
  if [ -z "$MANGLENDE_KALL" ]; then
    pass "inngangen henter alle fire: vindu + signaler + story-briefs + artikler"
  else
    fail "commands/start.md henter ikke:${MANGLENDE_KALL} — et neste-steg mangler i inngangen"
  fi

  # Uten forbeholdet leses en rå liste som en bearbeidet: et fravær av treff blir
  # en klarering, og tre signaler om samme sak blir tre saker. Det er nettopp det
  # `kasus-triage` gjorde, og som inngangen nå IKKE gjør.
  if grep -q 'Ingenting er konsolidert' "$STATUS_CMD" && grep -q 'Ingenting er sjekket mot egen dekning' "$STATUS_CMD"; then
    pass "inngangen sier at ingenting er konsolidert eller dekningssjekket"
  else
    fail "commands/start.md mangler forbeholdet om at lista er RÅ (konsolidering/dekning)"
  fi

  # Grovsorteringen er ikke borte, den er frivillig. Er veien dit ikke nevnt, er
  # den i praksis utilgjengelig: agenten oppdages fra mappa og har ingen kommando.
  if grep -q 'kasus-triage' "$STATUS_CMD"; then
    pass "inngangen peker på kasus-triage for den som vil ha bildet luket"
  else
    fail "commands/start.md nevner ikke kasus-triage — grovsorteringen blir usynlig"
  fi
fi

# ...og agenten må FAKTISK hente begge. Ett vindu er ingen dekningsdom: uten
# artiklene kan den konsolidere, men ikke si hva som alt er skrevet.
if [ -f "$TRIAGE_AGENT" ]; then
  if grep -q 'list_radar_signals' "$TRIAGE_AGENT" && grep -q 'list_articles' "$TRIAGE_AGENT"; then
    pass "forarbeidet sveiper begge vinduene (signaler + artikler)"
  else
    fail "agents/kasus-triage.md mangler ett av vinduene (list_radar_signals + list_articles)"
  fi
fi

# --- 4c-quater. Vinduet er definert ETT sted ------------------------------
# `/kasus:start` og saksløpet henter det SAMME vinduet: døgnet som gulv, hevet til
# tiden siden kvitteringen. Sto regelen i begge filene, ville de drevet fra
# hverandre uten at noe sa fra — og da viser inngangen ett vindu mens
# arbeidsflyten den sender deg til viser et annet. Det var nettopp skjøten regelen
# ble skrevet for å lukke: «nytt» måles mot kvitteringen, listene mot timer, og
# signaler som faller utenfor lista kan ikke merkes.
WINDOW_REF="$ROOT/references/vindu.md"
if [ ! -f "$WINDOW_REF" ]; then
  fail "references/vindu.md mangler — vinduet har ingen felles definisjon"
else
  UTEN_VINDU=""
  for f in "$STATUS_CMD" "$ROUND_SKILL"; do
    [ -f "$f" ] || continue
    grep -q 'vindu\.md' "$f" || UTEN_VINDU="${UTEN_VINDU} ${f#"$ROOT"/}"
  done
  if [ -z "$UTEN_VINDU" ]; then
    pass "inngangen og saksløpet leser vinduet fra references/vindu.md"
  else
    fail "disse henter uten den felles vindusregelen:${UTEN_VINDU}"
  fi

  # Gulvet er hele poenget. Står tallet ikke i regelen, er den ikke en regel.
  if grep -q 'max(24' "$WINDOW_REF"; then
    pass "vindusregelen har døgnet som gulv (max(24, siden sist))"
  else
    fail "references/vindu.md mangler gulvet max(24, …) — skjøten mot «siden sist» er åpen igjen"
  fi
fi

# --- 4c-ter. Dommen er definert ETT sted ----------------------------------
# SAMME SAK / OPPFØLGING / FUNDAMENT / SAMME TEMA felles to steder: som
# grovsortering i inngangen og som dom i saksløpet. Sto tabellen i begge
# agentene, ville de drevet fra hverandre uten at noe sa fra — og da betyr
# «OPPFØLGING» én ting i inngangen og en annen i saksløpet.
VERDICT_REF="$ROOT/references/dekningsdom.md"
if [ ! -f "$VERDICT_REF" ]; then
  fail "references/dekningsdom.md mangler — dommen har ingen felles definisjon"
else
  UTEN_REF=""
  for f in "$ROOT/agents/kasus-archivist.md" "$TRIAGE_AGENT"; do
    [ -f "$f" ] || continue
    grep -q 'dekningsdom\.md' "$f" || UTEN_REF="$UTEN_REF ${f#"$ROOT"/}"
  done
  if [ -z "$UTEN_REF" ]; then
    pass "begge som feller dommen leser den fra references/dekningsdom.md"
  else
    fail "disse feller dommen uten å lese den felles definisjonen:$UTEN_REF"
  fi
fi

# --- 4c-quinquies. Samtaleformen er definert ETT sted ---------------------
# Journalisten leser meldinger i en tråd, ikke JSON. Id-er, kategori-enumer,
# feltnavn og flagg er arbeidsmateriale — de kan ikke åpnes, ikke ringes, og de
# tar plassen til det som avgjør valget: hva saken er og hvor den står. Formen på
# det som legges FRAM står derfor i references/samtaleform.md, og hver brukervendt
# fil leser den derfra. Sto den i åtte filer, ville halvparten drevet tilbake til
# å ramse opp felt — og en enkelt fil som gjør det, gjør hele tråden teknisk igjen.
#
# `kasus-researcher` er utenfor med vilje: rapporten dens er fakta med URL til
# orkestratoren, aldri en liste noen velger fra. Det samme gjelder env og test,
# som er diagnostikk der variabelnavnet ER svaret.
VOICE_REF="$ROOT/references/samtaleform.md"
if [ ! -f "$VOICE_REF" ]; then
  fail "references/samtaleform.md mangler — samtaleformen har ingen felles definisjon"
else
  UTEN_FORM=""
  for f in "$STATUS_CMD" "$ROOT/agents/kasus-lookout.md" "$ROOT/agents/kasus-archivist.md" \
           "$TRIAGE_AGENT" $(find "$ROOT/skills" -name 'SKILL.md' | sort); do
    [ -f "$f" ] || continue
    grep -q 'samtaleform\.md' "$f" || UTEN_FORM="${UTEN_FORM} ${f#"$ROOT"/}"
  done
  if [ -z "$UTEN_FORM" ]; then
    pass "alt brukervendt legger fram etter references/samtaleform.md"
  else
    fail "disse legger fram uten den felles samtaleformen:${UTEN_FORM}"
  fi

  # Regelen er hele poenget. Står de tre tingen ikke der, er filen en holdning.
  if grep -q 'klikkbar lenke\|Lenka' "$VOICE_REF" && grep -q 'id-ene bæres, de skrives ikke ut' "$VOICE_REF"; then
    pass "samtaleformen har regelen: tittel, hva saken er, lenke — og id-er som ikke skrives ut"
  else
    fail "references/samtaleform.md mangler selve regelen (lenke framfor id)"
  fi
fi

# --- 4d. Hjelpen skal kjenne alle inngangene ------------------------------
# `hjelp` er kartet journalisten får når hun spør «hva kan denne?». Et kart som
# mangler en inngang er verre enn ingen: hun konkluderer med at inngangen ikke
# finnes. Kommandoer, agenter og ferdigheter oppdages fra mappa, så en ny av dem
# sier ikke fra noe sted — den blir bare usynlig i hjelpen. Derfor sier den fra her.
HELP_SKILL="$ROOT/skills/hjelp/SKILL.md"
if [ ! -f "$HELP_SKILL" ]; then
  fail "skills/hjelp/SKILL.md mangler — pluginen har ingen hjelp"
else
  MANGLER=""
  for f in $(find "$ROOT/commands" -name '*.md' | sort); do
    base="$(basename "$f" .md)"
    grep -q "/kasus:$base" "$HELP_SKILL" || MANGLER="$MANGLER /kasus:$base"
  done
  for f in $(find "$ROOT/agents" -name '*.md' | sort); do
    base="$(basename "$f" .md)"
    grep -q "$base" "$HELP_SKILL" || MANGLER="$MANGLER $base"
  done
  for f in $(find "$ROOT/skills" -name 'SKILL.md' | sort); do
    base="$(basename "$(dirname "$f")")"
    [ "$base" = "hjelp" ] && continue
    grep -q "$base" "$HELP_SKILL" || MANGLER="$MANGLER $base"
  done
  if [ -z "$MANGLER" ]; then
    pass "hjelpen nevner alle kommandoer, agenter og ferdigheter"
  else
    fail "hjelpen nevner ikke:$MANGLER — inngangen er usynlig for journalisten"
  fi

  # Hjelpen orienterer, den arbeider ikke. Et kall herfra ville gjort den til et
  # alternativt sted å gjøre jobben (prinsipp 0) — og et hjelpesvar som henter
  # signaler er et saksløp som startet fordi noen spurte hvordan man starter en.
  if grep -qE 'kasus\.mjs[[:space:]]+[a-z]|(list|get|search)_(radar_signals?|story_briefs?|articles?|editorial_profile)' "$HELP_SKILL"; then
    fail "hjelpen kaller verktøyet eller et MCP-verktøy — den skal bare orientere (--list er unntaket)"
  else
    pass "hjelpen henter ingenting fra Kasus"
  fi
fi

# --- 5. Enhetstester -------------------------------------------------------
if node --test "$ROOT"/scripts/kasus/*.test.mjs >"${TMPDIR:-/tmp}/kasus-unit-$$.log" 2>&1; then
  pass "enhetstester ($(grep -c '^ok ' "${TMPDIR:-/tmp}/kasus-unit-$$.log" | tr -d ' ') tester)"
else
  fail "enhetstester feilet:"
  sed -n '/^not ok/,+8p' "${TMPDIR:-/tmp}/kasus-unit-$$.log" | sed 's/^/      /'
fi
rm -f "${TMPDIR:-/tmp}/kasus-unit-$$.log"

# --- 6. MCP-oppsettet -----------------------------------------------------
# Dataene kommer fra Kasus' MCP-server, og den kobles til av `.mcp.json` i
# pluginroten. Mangler fila, eller heter serveren noe annet enn `kasus`, finnes
# ikke verktøyene — og ALLE navnene i kommandoene og agentene
# (`mcp__plugin_kasus_kasus__*`) peker på ingenting, uten at noe sier fra før
# journalisten prøver.
MCP_JSON="$ROOT/.mcp.json"
if MCP_FILE="$MCP_JSON" python3 -c '
import json, os
m = json.load(open(os.environ["MCP_FILE"]))
s = m["mcpServers"]["kasus"]
assert s["type"] == "http", "type skal være http"
assert s["url"].startswith("${KASUS_MCP_URL:-https://"), "url skal være ${KASUS_MCP_URL:-…}"
assert "headers" not in s, "ingen headere — innloggingen er OAuth"
' 2>/dev/null; then
  pass ".mcp.json kobler til serveren «kasus» over http, med OAuth"
else
  fail ".mcp.json mangler, er ugyldig, eller serveren heter ikke «kasus» — verktøyene finnes da ikke"
fi

# Verktøyene Kasus' MCP-server har — alle leseverktøy, serveren er read-only.
# Alt annet med prefikset er en skrivefeil: et verktøy agenten aldri får.
PREFIX="mcp__plugin_kasus_kasus__"
LESEVERKTOY="get_organization get_editorial_profile list_radar_signals search_radar_signals get_radar_signal list_signal_buckets list_story_briefs search_story_briefs get_story_brief list_articles search_articles get_article"

# Hvert MCP-verktøy i en `tools:`/`allowed-tools:`-liste må finnes. En skrivefeil
# der er et verktøy agenten aldri får, og den oppdager det først midt i jobben.
# Det fanger også et verktøy noen tror finnes: serveren har ingen skriveverktøy.
UKJENTE=""
for f in $(find "$ROOT/commands" "$ROOT/agents" -name '*.md' | sort); do
  for navn in $(sed -n '1,8p' "$f" | grep -E '^(tools|allowed-tools):' | grep -oE "${PREFIX}[a-z_]+" | sed "s/^${PREFIX}//"); do
    case " $LESEVERKTOY " in
      *" $navn "*) ;;
      *) UKJENTE="${UKJENTE} ${f#"$ROOT"/}:${navn}" ;;
    esac
  done
done
if [ -z "$UKJENTE" ]; then
  pass "alle MCP-verktøy i verktøylistene er kjente leseverktøy"
else
  fail "ukjente MCP-verktøy i verktøylister:${UKJENTE}"
fi

# Agentene henter selv. Står et verktøy i teksten men ikke i `tools:`, får agenten
# det ikke — og svarer med «jeg har ikke tilgang» midt i et saksløp.
for f in $(find "$ROOT/agents" -name '*.md' | sort); do
  rel="${f#"$ROOT"/}"
  LISTE="$(sed -n '1,8p' "$f" | grep -E '^tools:')"
  MANGLER_I_LISTE=""
  for navn in $LESEVERKTOY; do
    if sed '1,8d' "$f" | grep -q "\b${navn}\b" && ! printf '%s' "$LISTE" | grep -q "${PREFIX}${navn}"; then
      MANGLER_I_LISTE="${MANGLER_I_LISTE} ${navn}"
    fi
  done
  if [ -z "$MANGLER_I_LISTE" ]; then
    pass "$rel har verktøyene teksten bruker"
  else
    fail "$rel bruker verktøy som ikke står i tools::${MANGLER_I_LISTE}"
  fi
done

# Ingen rester av HTTP-laget. API-nøkkelen og /api/v1 hører til før MCP, og en
# instruks som fortsatt nevner dem sender journalisten til et oppsett som ikke
# finnes lenger. Diagnostikken (env, test) er unntatt: den nevner restene for å
# si at de ikke er i bruk.
RESTER="$(grep -rlE 'KASUS_API_KEY|KASUS_BASE_URL|/api/v1/' "$ROOT/commands" "$ROOT/agents" "$ROOT/skills" "$ROOT/references" 2>/dev/null | grep -vE '/commands/(env|test)\.md$' | sed "s|$ROOT/||" | tr '\n' ' ')"
if [ -z "$RESTER" ]; then
  pass "ingen rester av HTTP-API-et (KASUS_API_KEY, /api/v1) i instruksene"
else
  fail "disse nevner fortsatt HTTP-API-et: $RESTER"
fi

# --- 7. Ingen nettverk i scripts/ -----------------------------------------
# Scriptet er bare kvitteringen. Nettverkskode her ville vært en vei utenom
# MCP-tilkoblingen — med egen auth, egen feilhåndtering og egne svar.
if grep -rnE '\bfetch[[:space:]]*\(|node:https?|curl ' "$ROOT/scripts" --include='*.mjs' --include='*.sh' 2>/dev/null | grep -vE 'self-test\.sh|\.test\.mjs' >/dev/null; then
  fail "et skript i scripts/ har nettverkskode — dataene skal komme fra MCP"
else
  pass "ingen nettverkskode i scripts/"
fi

printf '\n'
if [ "$FAILED" -eq 0 ]; then
  printf 'ALT OK\n'
  exit 0
fi
printf '%s test(er) feilet\n' "$FAILED"
exit 1
