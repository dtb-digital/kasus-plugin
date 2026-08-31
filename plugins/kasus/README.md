# kasus

Redaksjonell arbeidsflyt på Kasus-dataene dine, i Claude Code: hent radarsignaler,
story-briefs og redaksjonell profil fra det offentlige API-et, research en sak
videre med søk og skraping, og skriv den ut som en markdown-artikkel.

API-laget er **read-only**. Det pluginen skriver, skriver den til disk i ditt eget
repo.

## Kom i gang

1. Lag en API-nøkkel i Kasus: **Innstillinger → API-nøkler → Ny nøkkel**. Den
   vises kun én gang.
2. Sett den i runtime-env. `settings.json` → `env` (bruker, prosjekt eller
   `.claude/settings.local.json`, som er gitignorert) eller en eksport i skallet.
   **`.env`-filer leses ikke av Claude Code.**

   ```json
   {
     "env": {
       "KASUS_API_KEY": "kasus_sk_…"
     }
   }
   ```

3. Start sesjonen på nytt — `env`-innslag og komponenter plukkes opp ved oppstart.
4. Verifiser: `/kasus:env --resolve`

## Kommandoer

| Kommando | Gjør |
|---|---|
| `/kasus:signals` | Lister radarsignaler. Filtrer på `--status`, `--type`, `--origin`, `--pattern`, `--hours`, `--limit`. |
| `/kasus:briefs` | Lister story-briefs, eller åpner én med en id som argument. |
| `/kasus:profile` | Redaksjonell profil: profilteksten, de utledede mønstrene/innsiktene og radarens mandat. |
| `/kasus:research` | Researcher en brief eller et signal videre — én subagent per spørsmål, primærkilder, og et notat på disk. |
| `/kasus:article` | Skriver artikkelutkast som markdown, fra brief + researchnotat, i redaksjonens tone. |
| `/kasus:env` | Sjekker oppsettet. `--resolve` sier hvilken installasjon et kall treffer og hvilken variabel hver verdi kom fra. |
| `/kasus:test` | Selvtester pluginen. `--live` også tilkoblingen og at serveren avviser skriv. |

Den normale rekkefølgen er `/kasus:briefs` → `/kasus:research <id>` →
`/kasus:article <id>`. `/kasus:profile` hentes automatisk av de to siste — den
er premisset, ikke et vedlegg.

## Agent

`kasus-researcher` besvarer **ett** researchspørsmål: søker bredt, leser smalt,
går til primærkilden framfor omtalen, daterer alt, og skiller mellom bekreftet,
motstridende og ubekreftet. `/kasus:research` sender ut én per spørsmål, parallelt.

## Variabler

| Variabel | Påkrevd | Betydning |
|---|---|---|
| `KASUS_API_KEY[_<ENV>]` | **Ja** | Nøkkel fra Innstillinger → API-nøkler. Ekkoes aldri i output. |
| `KASUS_BASE_URL[_<ENV>]` | Nei | Default `https://app.kasus.io`. Sett den for staging eller egen installasjon. |
| `KASUS_TIMEOUT_MS[_<ENV>]` | Nei | Default `30000`. |
| `KASUS_ARTICLES_DIR[_<ENV>]` | Nei | Default `./artikler`. Hit skrives artikler og researchnotater. |

Per-miljø-variabelen vinner over den delte. Suffikset er miljønavnet i VERSALER
med bindestrek → understrek (`pre-prod` → `PRE_PROD`), og uten `--env` leses BARE
den delte varianten. `/kasus:env --resolve <miljø>` svarer på hva et kall faktisk
ville truffet.

Forutsetter Node 18+ på PATH. Verktøyet er avhengighetsfri ESM — ingen
`npm install`, ingen byggesteg.

## Det du bør vite før du stoler på outputen

- **Nøkkelen avgjør organisasjonen.** Ingen organisasjons-id sendes. «Ingen
  signaler» betyr «ingen for denne organisasjonen», og en `404` betyr «finnes
  ikke ELLER tilhører en annen organisasjon».
- **`--origin` og `--pattern` filtreres lokalt** — API-et støtter dem ikke.
  Verktøyet oppgir både hvor mange som ble hentet og hvor mange som passerte.
- **Menneskelig output klipper** lange tekstfelt og sier at den klipper. `--json`
  klipper ingenting.
- **Ingenting oppdiktes.** Mangler en kilde, står det
  `[TRENGER VERIFISERING: …]` eller `[SITAT MANGLER: …]` i utkastet framfor en
  plausibel setning. Antallet markører står i frontmatteren som `apenePunkter`.
- **Utkast er utkast.** Frontmatteren har `status: utkast` og
  `generertAv: claude-code/kasus-plugin`, også når teksten leser godt.

Prinsippene i sin helhet: [`references/principles.md`](./references/principles.md).
API-kontrakten: [`references/kasus-api.md`](./references/kasus-api.md).

## Utvikling

```bash
claude --plugin-dir plugins/kasus     # last pluginen lokalt
bash plugins/kasus/scripts/self-test.sh          # tørt
bash plugins/kasus/scripts/self-test.sh --live   # + ekte kall mot API-et
node --test plugins/kasus/scripts/kasus/         # bare enhetstestene
```

Nye kommandoer og agenter registreres ikke noe sted — de oppdages fra mappa, og
krever omstart av sesjonen. Endrer du verktøyets modi, oppdater `MODES` i
`scripts/kasus/kasus.mjs`; selvtesten sjekker at kommandoene ikke refererer til
en modus som ikke finnes, og at versjonen i `plugin.json` og verktøyet er den samme.
