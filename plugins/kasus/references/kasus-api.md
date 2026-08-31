# Kasus' offentlige API — kontrakten pluginen bygger på

Lastes ved behov. Den autoritative dokumentasjonen bor i kasus-repoet
(`docs/signals-api-README.md`, `docs/story-briefs-api-README.md`,
`docs/profile-api-README.md`); dette er det pluginen faktisk er avhengig av.

## Grunnlaget

- Base-URL: `KASUS_BASE_URL`, default `https://app.kasus.io`. Alle ruter under `/api/v1`.
- Auth: `Authorization: Bearer kasus_sk_…` (`x-api-key` godtas som fallback).
- **Nøkkelen avgjør organisasjonen.** Ingen `organizationId` sendes noe sted. Det
  har én konsekvens som må med i hvert svar: et tomt resultat betyr «tomt for
  DENNE organisasjonen», ikke «tomt i Kasus», og en 404 på en id betyr «finnes
  ikke ELLER tilhører en annen organisasjon».
- **Read-only.** Det finnes ingen skrivende ruter. Pluginen har heller ingen
  kodesti for annet enn GET.

## Ruter

| Rute | Query | Merk |
|---|---|---|
| `GET /api/v1/signals` | `status`, `type`, `hours`, `limit` (maks 100), `cursor` | Sortert på `detectedAt` desc |
| `GET /api/v1/signals/{id}` | — | 404 = finnes ikke eller annen org |
| `GET /api/v1/story-briefs` | `status`, `hours`, `limit` (maks 100), `cursor` | Sortert på `createdAt` desc |
| `GET /api/v1/story-briefs/{id}` | — | 404 = finnes ikke eller annen org |
| `GET /api/v1/profile` | — | Ett objekt per organisasjon |

`nextCursor` er `null` på siste side. `limit` over 100 finnes ikke — verktøyet
pagineres i stedet, og sier fra når taket er nådd.

**`origin` kan ikke filtreres serverside.** Verken på signaler eller briefs.
Verktøyet filtrerer lokalt med `--origin`/`--pattern` og oppgir både antall hentet
og antall som passerte, slik at et lokalt filter ikke forveksles med et tomt
datasett.

## Feltverdier som betyr noe redaksjonelt

**Signal-`status`:** `new`, `seen`, `promoted` (løftet til en brief), `dismissed`.

**Signal-`type` vs `origin`.** `type` sier hva signalet er, `origin` hvorfor vi har
det. Begge oppfølgingssøkene lagrer funnene som `market_signal`, så uten `origin`
er de ikke til å skille fra et vanlig temasøk-treff:

| `origin` | Betydning |
|---|---|
| `competitor_followup` | Oppfølging av en fersk konkurrentsak. Konkurrentenes egne domener er utelatt fra søket. |
| `own_followup` | Oppfølging av en av redaksjonens EGNE ferske saker. Egne domener er utelatt. |
| `null` + `type: market_signal` | Fritt temasøk. Uavhengig av publiseringstidspunkt, mest varierende relevans. |
| `null` + `type: competitor_article` | Sak fra en overvåket forside. Ikke et søketreff. |

Nye `origin`-verdier er ikke en brytende endring. En ukjent verdi behandles som
«annet opphav» framfor å avvise signalet.

**Brief-`status`:** `candidate`, `proposal` (klar for redaksjonen), `draft`,
`final`, `dismissed`.

**Brief-`origin`:** `innhold` (innholdspipelinen), `radar` (fra et signal), `url`
(innlimt lenke), `triage`.

**`matchedPattern`** på et signal eller en brief er samme streng som
`criteria.patterns[].name` i profilen. Det er koblingen mellom «hvorfor ble dette
plukket opp» og «hva fungerer for disse leserne».

## Hva som IKKE finnes i API-et

Interne pipeline-felt er utelatt serverside (`threadId`, `insightId`,
`radarSignalId`, `criteriaId`, `articleId`, `fullContent`, `researchPlan`,
`relevanceScore`, `organizationId`, `sourceId`, `searchId`, `bucketId`), og
profilen eksponerer ikke integrasjonskonfigurasjon, feature-flagg, modellvalg
eller `personas`.

`details` og `sources` på et signal er derimot **åpne** JSON-objekter satt sammen
av `metadata` + `agentContext`. Hva som havner der bestemmes av pipelinen. Derfor
maskerer verktøyet hemmelig-navngitte nøkler i dybden — en gard, ikke
hovedforsvaret.

## Feil, og hva de betyr

| Status | Tiltak |
|---|---|
| `400` | Ugyldig verdi i `status`/`type`/`hours`. Verktøyet validerer lokalt først, så dette skal normalt ikke skje. |
| `401` | Nøkkelen er ugyldig, utløpt eller tilbakekalt — eller hører til en annen installasjon. Sjekk variabelen `/kasus:env` oppgir. |
| `404` | Finnes ikke, ELLER tilhører en annen organisasjon. |
| `429` | For mange forespørsler. Vent. |
