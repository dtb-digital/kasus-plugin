# Kasus' offentlige API — kontrakten pluginen bygger på

Lastes ved behov. Den autoritative dokumentasjonen bor i kasus-repoet
(`docs/signals-api-README.md`, `docs/articles-api-README.md`,
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
| `GET /api/v1/articles` | `status`, `cms`, `hours`, `limit` (maks 100), `cursor`, `include=body` | Redaksjonens EGNE saker. Nyest publisert først; upublisert sorteres sist. |
| `GET /api/v1/articles/{id}` | — | Alltid med `body`. 404 = finnes ikke eller annen org |
| `GET /api/v1/profile` | — | Ett objekt per organisasjon |

`/api/v1/story-briefs` finnes i API-et, men **pluginen bruker det ikke**. Runden
går fra rått radarsignal til saksforslag i én prosess, og et ferdig vurdert
saksforslag fra pipelinen ville vært et konkurrerende utgangspunkt i samme
arbeidsflyt.

`nextCursor` er `null` på siste side. `limit` over 100 finnes ikke — verktøyet
pagineres i stedet, og sier fra når taket er nådd.

**Artikkel-API-et har ingen tekstsøk.** Det finnes ingen `q`. «Har vi dekket dette
før?» besvares derfor ved å hente et VINDU av de nyeste artiklene (`--kort`, uten
brødtekst) og la `kasus-archivist` lese dem. Både vindusstørrelsen og
forbeholdet står i svaret: en tom treffliste betyr «ikke blant disse artiklene»,
aldri «ikke dekket».

**`hours` på artikler måles mot `published`.** Upublisert materiale faller derfor
utenfor når `hours` settes.

**Kladder er utenfor `--kort`-vinduet, alltid.** Her sto det tidligere at
`--limit` ble brukt framfor `hours` «slik at kladder er med». Det var usant:
ruten sorterer `published desc, nulls last`, så upublisert ligger BAKERST og
faller utenfor i det øyeblikket taket nås. Verifisert — 250 publiserte saker og 5
kladder ga 0 kladder i et vindu på 200, mens de samme 5 kom med når taket ble
hevet. Utelatelsen var altså ikke en regel, men en funksjon av redaksjonens
størrelse.

Verktøyet skiller dem derfor eksplisitt, på `published` framfor på `status` —
`status` er fritekst og varierer med CMS. Antallet oppgis som
`meta.utenPublisering`, og forbeholdet sier at «ingen treff» ikke er «ingen jobber
med dette». Kladdene er et eget oppslag: `articles --status D`.

**Signal-ruten har bare tre filtre:** `status`, `type` og `hours` — verifisert mot
`app/api/v1/signals/route.ts`. Alt annet redaksjonen faktisk spør om filtreres
lokalt av verktøyet: `--kategori` (pluginens firedeling, som krever at `origin` og
`type` leses samtidig), `--origin`, `--pattern`, `--uten-monster` (FRAVÆRET av et
mønster, som ikke kan uttrykkes med `--pattern`), `--uten-lenke`, `--gamle`,
`--ferske` og `--publisert <timer>`. Verktøyet oppgir antall hentet, antall som
passerte og hvilke filtre som var i bruk, slik at et lokalt filter ikke forveksles
med et tomt datasett.

**`hours` på signaler måles mot `detectedAt`, ikke publiseringsdato.** Det er
grensen som ikke kan lukkes serverside i det hele tatt: et fritt temasøk hentes
uavhengig av når saken ble publisert. `--publisert` og `--ferske` måler sakens egen
alder, lokalt — og et signal uten `details.publishedDate` faller ut av dem, med
antallet oppgitt som `meta.utenPubliseringsdato`. Ukjent dato er ikke «gammel».

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

**Pluginens kategorinavn**, som er de samme i runden og i
`meta.grupper`:

| API-felt | Kategori i pluginen |
|---|---|
| `origin: own_followup` | Oppfølging av EGEN sak (`egen_oppfolging`) |
| `origin: competitor_followup` | Oppfølging av KONKURRENTSAK (`konkurrent_oppfolging`) |
| `origin: null` + `type: competitor_article` | Konkurrentsak direkte (`konkurrentsak`) |
| `origin: null` + `type: market_signal` | Fritt temasøk (`temasok`) |
| ukjent `origin` | Annet opphav (`annet`) |

**`details.publishedDate` er ikke `detectedAt`.** Frie temasøk hentes uavhengig av
publiseringstidspunkt, så et signal oppdaget i dag kan være en sak fra 2023.
Pluginen viser begge og merker avvik over en uke som `GAMMEL SAK`. Feltet er
valgfritt: mangler det, er svaret «ukjent dato», ikke «fersk».

**Artikkel-`status`** er **fritekst**, ikke et enum: feltet speiler kundens CMS.
Labrador og Sanity bruker `P`/`D`, HubSpot mappes til `P`/`D`, mens WordPress
sender sine egne verdier (`draft`, `pending`, `private`) rett gjennom. En verdi som
ikke finnes gir en tom liste, ikke en feil. Det samme gjelder `cms` — lista over
kjente verdier vokser med nye integrasjoner, så verktøyet validerer dem ikke
lokalt.

**`body` er lagret slik CMS-et leverte den:** HTML fra Labrador, ren tekst fra
Sanity, WordPress og HubSpot. `excerpt` og `wordCount` er alltid regnet på ren
tekst, så de er sammenlignbare på tvers. Verktøyet stripper HTML for lesbarhet;
`--json` gir feltet urørt.

**`matchedPattern`** på et signal er samme streng som
`criteria.patterns[].name` i profilen. Det er koblingen mellom «hvorfor ble dette
plukket opp» og «hva fungerer for disse leserne».

## Hva som IKKE finnes i API-et

Interne pipeline-felt er utelatt serverside (`threadId`, `insightId`,
`radarSignalId`, `criteriaId`, `articleId`, `fullContent`, `researchPlan`,
`relevanceScore`, `organizationId`, `sourceId`, `searchId`, `bucketId`), og
profilen eksponerer ikke integrasjonskonfigurasjon, feature-flagg, modellvalg
eller `personas`. På artikler er `organizationId`, `siteId`, `imageId` og
`createdBy` utelatt — `bylines` er den redaksjonelle visningsstrengen.

**Ingen tekstsøk, ingen semantisk søk, ingen «relaterte saker».** Alt som ser ut
som relevansvurdering i denne pluginen er gjort på klienten — av en agent som
leser et vindu verktøyet har hentet — og sier at det er gjort der.

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
