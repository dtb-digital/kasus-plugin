---
description: Hent redaksjonell profil fra Kasus — profil, mønstre, innsikter og radarens mandat
argument-hint: [--env staging] [--json]
allowed-tools: ["Bash"]
---

Hent organisasjonens redaksjonelle profil:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs profile $ARGUMENTS
```

Svaret har fire deler:

1. **Redaksjonsprofilen** — `goals`, `targetAudience`, `editorialProfile`,
   `keywords`. Dette er teksten redaksjonen selv har skrevet, og den samme
   teksten som limes inn i hver prompt i Kasus' egen pipeline. Den sier hva som
   **er en sak for denne redaksjonen**, og hva leserne kan fra før.
2. **Redaksjonelle mønstre** (`criteria.patterns`) — utledet av hva som faktisk
   leses. `whatWorks` og `whatToAvoid` er konkrete instrukser, ikke bakgrunn.
   `name` er den samme verdien som `matchedPattern` på signaler og story-briefs,
   så et mønster her forklarer hvorfor et signal ble plukket opp.
3. **Innsikter** (`criteria.insights`) — segmenter, forfattermønstre, muligheter,
   innholdshull og koblinger.
4. **Radar-søk** — oppdragene radaren kjører. Deaktiverte søk er med i lista og
   merket, fordi et deaktivert søk forklarer hvorfor et tema har sluttet å komme.

## Bruk den til noe

Profilen er ikke et oppslagsverk — den er premisset for alt annet denne pluginen
gjør. Konkret:

- **Før research**: bruk `targetAudience` til å avgjøre hva som må forklares og
  hva som kan forutsettes, og `whatToAvoid` til å droppe vinklinger som ikke
  virker for disse leserne.
- **Før skriving**: `editorialProfile` og `whatWorks` styrer tonen og formen.
- **Ved vurdering av signaler**: et signal som ikke treffer noe mønster og ikke
  ligger i nærheten av `keywords` er sannsynligvis støy.

Er profilen tom (`(ikke fylt ut)`), si det — og si hva det betyr: uten profil har
verken Kasus' pipeline eller denne pluginen noe å styre etter, og resultatet blir
generisk. `criteria: null` betyr at innholdspipelinen ikke har kjørt for
organisasjonen ennå.
