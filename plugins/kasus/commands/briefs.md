---
description: Hent story-briefs fra Kasus — redaksjonens ferdig vurderte saksforslag
argument-hint: [--status proposal] [--origin radar] [--pattern «navn»] [--hours 24] [--limit 20] | <brief-id>
allowed-tools: ["Bash"]
---

Hent organisasjonens story-briefs fra Kasus.

En story-brief er et saksforslag som alt er vurdert redaksjonelt: plot, vinkling,
begrunnelse, aktører, nøkkeltall, åpne spørsmål og konverteringspotensial. Det er
det beste utgangspunktet for research og artikkel — bedre enn et rått signal.

**Er `$ARGUMENTS` en id** (én verdi, ingen flagg), hent den enkelte briefen med
hele teksten:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs brief $ARGUMENTS
```

**Ellers** list dem:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs briefs $ARGUMENTS
```

Listemodus klipper lange felt for å være mulig å skumme. Detaljmodus gjør det
ikke i samme grad, og `--json` klipper ingenting.

## Les outputen riktig

`status` er hvor briefen står redaksjonelt:

| Status | Betydning |
|---|---|
| `candidate` | Kandidat, ikke vurdert ferdig. |
| `proposal` | Forslag klart til redaksjonen — normalt det du vil jobbe videre med. |
| `draft` | Noen har begynt å skrive. |
| `final` | Ferdig. |
| `dismissed` | Forkastet. Ikke foreslå den videre uten at brukeren ber om det. |

`origin` sier hvor briefen kom fra: `innhold` (innholdspipelinen, basert på hva
som faktisk leses), `radar` (et radarsignal), `url` (noen limte inn en lenke) eller
`triage`.

`conversionPotential: pluss` betyr at saken er vurdert til å kunne gi abonnenter;
`conversionReason` sier hvorfor. Ta det med når du anbefaler hva som bør skrives.

Header-linja sier hvilken installasjon og nøkkel-variabel som ble brukt. Nøkkelen
avgjør organisasjonen, så en tom liste er tom **for denne organisasjonen**.

## Etter uthentingen

Ranger briefene og si hva du ville prioritert — begrunn i `reason`,
`matchedPattern` og konverteringsvurderingen, ikke i magefølelse. `openQuestions`
er ofte det mest nyttige feltet: det er de hullene en research må lukke.

Skal én skrives ut, er veien `/kasus:research <brief-id>` og deretter
`/kasus:article <brief-id>`.
