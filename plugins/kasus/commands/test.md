---
description: Selvtest av kasus-pluginen — struktur, regler og at tilkoblingen til Kasus faktisk svarer
argument-hint: [--live]
allowed-tools: ["Bash", "mcp__plugin_kasus_kasus__get_organization", "mcp__plugin_kasus_kasus__get_new_signals", "mcp__plugin_kasus_kasus__list_radar_signals", "mcp__plugin_kasus_kasus__list_articles"]
---

Kjør den tørre selvtesten:

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/self-test.sh
```

Den krever bare `bash` og `python3`, og dekker:

- at `commands/`, `agents/`, `skills/` og `references/` ikke er tomme — komponentene
  oppdages fra mappa, så en tom mappe er en plugin uten kommandoer, ikke en
  feilmelding. `skills/` er den viktigste: arbeidsflytene bor der
- at `plugin.json`, `marketplace.json` og `.mcp.json` er gyldig JSON, at
  versjonene er like, og at MCP-serveren heter `kasus`
- at hver agents `name:` matcher filnavnet og hver ferdighets `name:` matcher
  MAPPENAVNET, ellers lastes de ikke
- at **alle MCP-verktøy tekstene refererer til finnes** på serveren — et verktøy
  som får nytt navn blir en rød test her framfor et kall som feiler hos brukeren
- at bare saksløpet flytter kvitteringen, at ingen kommando eller agent kvitterer
  eller lagrer i det hele tatt, og at agentene ikke har skriveverktøy — et løfte i
  en prompt er lett å bryte i en senere redigering
- at saksløpet faktisk kvitterer og lagrer, og krever et signal
- at `/kasus:start` henter alle fire kildene og sier at lista er rå
- at **ingen kommando sender ut researchagenter**
- at **hjelpen nevner hver kommando, agent og ferdighet som finnes**, og selv ikke
  henter noe
- at pluginen ikke har Node-kode igjen

Med `--live` i tillegg — gjør disse kallene selv, i samme melding, etter skriptet:

```
get_organization {}
get_new_signals { "limit": 1 }
list_radar_signals { "limit": 1 }
list_articles { "limit": 1 }
```

Rapporter: hvilken organisasjon tilkoblingen tilhører, om `auth.canWrite` er sann
(uten den kan saksløpet verken kvittere eller lagre), og om hvert kall svarte. En
tom artikkelliste er ikke en feil, men si at organisasjonen ikke har artikler
synkronisert — saksløpets dekningssjekk har da ingenting å lese. `--live`
kvitterer og lagrer ALDRI: en test som flyttet «siden sist» ville spist
redaksjonens saksløp.

Feiler et kall, kjør `/kasus:env` før du konkluderer.

Rapporter resultatet som det er. Feiler noe i skriptet, si hvilken fil som må
endres — ikke bare at testen er rød.
