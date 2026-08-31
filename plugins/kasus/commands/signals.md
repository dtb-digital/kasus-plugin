---
description: Hent radarsignaler fra Kasus — filtrer på status, type, opphav, mønster og alder
argument-hint: [--status new] [--type market_signal] [--origin own_followup] [--pattern «navn»] [--hours 24] [--limit 20]
allowed-tools: ["Bash"]
---

Hent organisasjonens radarsignaler fra Kasus og presenter dem redaksjonelt.

Kjør verktøyet med argumentene brukeren ga (`$ARGUMENTS` kan være tomt — da er
default de 20 nyeste):

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs signals $ARGUMENTS
```

Trenger du hele teksten videre i en annen oppgave, kjør samme kall med `--json`.
Den klipper ikke lange felt.

## Les outputen riktig

Header-linja sier hvilken installasjon og hvilken nøkkel-variabel som ble brukt.
**Nøkkelen avgjør organisasjonen** — ingen organisasjons-id sendes. «Ingen
signaler» betyr derfor «ingen for DENNE organisasjonen», aldri «ingen i Kasus».
Si det slik hvis lista er tom.

`type` sier *hva* signalet er, `origin` sier *hvorfor vi har det*. De skiller tre
ting som ellers ser like ut:

| Det du ser | Hva det betyr |
|---|---|
| `type: competitor_article` | En sak fra en overvåket konkurrent-forside. Ikke et søketreff. |
| `origin: competitor_followup` | Oppfølgingssøk på en fersk konkurrentsak. Konkurrentenes egne domener er utelatt, så kildene er ANDRE kilder på samme sakskompleks. |
| `origin: own_followup` | Oppfølgingssøk på en av deres EGNE ferske saker — nye kilder som kan utvide den. |
| `origin: null` + `type: market_signal` | Fritt temasøk. Hentet uavhengig av publiseringstidspunkt, og varierer mest i relevans. |

En `origin`-verdi du ikke kjenner er «annet opphav» — ikke en feil, og ikke en
grunn til å utelate signalet. API-et kan legge til nye verdier.

## Etter uthentingen

Presenter signalene gruppert på opphav, med de ferskeste først, og pek på hvilke
som er verdt å gå videre på — konkret hvorfor, ikke bare «interessant». Er det
uklart hva som er verdt å følge, hent den redaksjonelle profilen først
(`/kasus:profile`): mønstrene der er premisset for hva som er en sak for denne
redaksjonen.

Skal ett signal researches videre, foreslå `/kasus:research <signal-id>`.

## Merk

- `--origin` og `--pattern` filtreres **lokalt** — API-et støtter dem ikke.
  Verktøyet sier hvor mange som ble hentet og hvor mange som passerte filteret,
  så et lokalt filter ikke forveksles med et tomt datasett.
- `--limit` over 100 pagineres automatisk. Når taket nås, sier verktøyet at det
  finnes mer.
- Mangler `KASUS_API_KEY`, stopper kallet med `MANGLER: …`. Kjør `/kasus:env`.
