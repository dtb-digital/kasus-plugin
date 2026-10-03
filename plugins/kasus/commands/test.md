---
description: Selvtest av kasus-pluginen — syntaks, manifest-kontrakt, MCP-oppsett, enhetstester, og med --live et ekte kall mot Kasus
argument-hint: [--live]
allowed-tools: ["Bash", "mcp__plugin_kasus_kasus__get_organization", "mcp__plugin_kasus_kasus__list_radar_signals", "mcp__plugin_kasus_kasus__list_articles"]
---

Kjør selvtesten:

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/self-test.sh
```

Den dekker:

- syntaks på alle `*.sh` i **både bash og zsh** (Bash-verktøyet kan bruke begge,
  så en zsh-only feil dukker ellers opp hos brukeren) og `node --check` på alle `*.mjs`
- at `commands/`, `agents/`, `skills/` og `references/` ikke er tomme — komponentene
  oppdages fra mappa, så en tom mappe er en plugin uten kommandoer, ikke en
  feilmelding. `skills/` er den viktigste: arbeidsflytene bor der
- at `plugin.json` er gyldig JSON, og at versjonen der er den samme som i verktøyet
- at hver agents `name:` matcher filnavnet og hver ferdighets `name:` matcher
  MAPPENAVNET, ellers lastes de ikke
- at bare saksløpet flytter kvitteringen, og at ingen kommando eller agent kvitterer
  i det hele tatt — et løfte i en prompt er lett å bryte i en senere redigering
- at `/kasus:start` henter **alle fire**: vinduet og de tre listene — faller én ut i
  en forenkling, ser inngangen like komplett ut uten den
- at **ingen kommando sender ut researchagenter**. Researchen er saksløpets steg 4;
  en kommando som gjorde den ville hatt egne steg som kan drifte fra ferdighetens
- at **hjelpen nevner hver kommando, agent og ferdighet som finnes**, og selv ikke
  henter noe
- at `kasus.mjs --list --json` oppfyller manifest-kontrakten, og at **alle modi
  kommandoene refererer til finnes**
- at **`.mcp.json` kobler til serveren `kasus`** — heter den noe annet, peker hvert
  verktøynavn i pluginen på ingenting
- at hvert MCP-verktøy i en verktøyliste er et kjent leseverktøy, og at agentene
  har verktøyene teksten deres bruker
- at ingen instruks fortsatt nevner HTTP-API-et (`KASUS_API_KEY`, `/api/v1`), og at
  `scripts/` ikke har nettverkskode
- enhetstestene (`node --test`): kvitteringen, at to organisasjoner ikke deler
  «siden sist», at en ødelagt fil ikke nullstilles i stillhet, og at `vindu` aldri
  skriver

**Med `--live`** i tillegg (`$ARGUMENTS`): kall selv, i samme melding,

1. `get_organization` — virker innloggingen, og hvilken organisasjon gjelder den?
2. `list_radar_signals` med `limit: 1` — svarer radaren?
3. `list_articles` med `limit: 1, publication: "published"` — er det artikler
   synkronisert? Uten dem kan ingen dekningsdom felles, og det er bedre å vite nå
   enn midt i et saksløp.

Rapporter hvert av dem som OK/FEIL på samme måte som skriptet. Finnes ikke
verktøyene, eller ber de om autentisering, er det ikke en feil i pluginen: kjør
`/kasus:env`, som forklarer innloggingen.

Rapporter resultatet som det er. Feiler noe, si hvilken fil som må endres — ikke
bare at testen er rød.
