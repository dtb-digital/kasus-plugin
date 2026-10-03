---
description: Sjekk at oppsettet for kasus-pluginen er komplett — lokalt, og at innloggingen mot Kasus virker og hvilken organisasjon den gjelder
argument-hint: [--resolve]
allowed-tools: ["Bash", "mcp__plugin_kasus_kasus__get_organization"]
---

To ting, i denne rekkefølgen.

**1. Det lokale oppsettet.** Kjør miljøsjekken:

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/check-env.sh $ARGUMENTS
```

Skriptet er den **ene kilden til sannhet** for hva pluginen krever lokalt: Node
til kvitteringen, `.mcp.json` som kobler til Kasus, hvilken installasjon den peker
på (`KASUS_MCP_URL`, default `app.kasus.io`), og at kvitteringen kan skrives.
Presenter resultatet som det er, og si for hver `MANGLER:`-linje konkret hva
brukeren skal gjøre. En `ADVARSEL:` om `KASUS_API_KEY` betyr bare at variabelen er
en rest fra før pluginen gikk over til innlogging — den kan fjernes, og den
avgjør ingenting.

Med `--resolve`: forklar hva mål-oppløsningen betyr. Installasjonen er
`KASUS_MCP_URL` om den er satt, ellers `app.kasus.io`. Kvitteringen er nøklet på
installasjonen og organisasjonen, så staging og produksjon — eller to
organisasjoner i samme repo — ikke deler «siden sist».

**2. Innloggingen.** Skallet kan ikke se den, så kall MCP-verktøyet
`get_organization`.

- **Svarer det**, si hvilken organisasjon tilkoblingen gjelder (navn og nettsted),
  og at tilkoblingen bare kan lese — Kasus' MCP-server har ingen skriveverktøy.
  Minn om at det er **innloggingen** som avgjør
  organisasjonen, ikke noe som sendes med: er det feil organisasjon, logg inn på
  nytt via `/mcp` og velg en annen.
- **Finnes ikke verktøyet, eller ber det om autentisering**, er Kasus ikke koblet
  til. Si hva brukeren skal gjøre:
  1. Skriv `/mcp`, velg `plugin:kasus:kasus`, og «Authenticate».
  2. Logg inn med Kasus-kontoen i nettleseren. Har du flere organisasjoner, velg
     den redaksjonen pluginen skal jobbe for, og gi tilgang.
  3. Står ikke `plugin:kasus:kasus` i lista, er sesjonen ikke startet på nytt etter
     at pluginen ble installert — eller pluginen er ikke slått på i dette
     prosjektet (`enabledPlugins` i `.claude/settings.json`).
- **Avvises det etter at det har virket**, er appen koblet fra i Kasus
  (Innstillinger → Tilkoblede apper), eller brukeren er ikke lenger medlem av
  organisasjonen. Logg inn på nytt via `/mcp`.

Ingen API-nøkkel trengs, og ingen skal limes inn noe sted.
