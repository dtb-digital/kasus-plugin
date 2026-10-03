# Kasus' MCP-server — kontrakten pluginen bygger på

Lastes ved behov. Den autoritative dokumentasjonen bor i kasus-repoet
(`docs/internal/mcp-server.md`, koden i `apps/frontend/lib/mcp/server.ts`); dette
er det pluginen faktisk er avhengig av, og reglene den legger oppå.

## Grunnlaget

- Pluginen kobler til serveren via `.mcp.json` i pluginroten: server `kasus`,
  adresse `${KASUS_MCP_URL:-https://app.kasus.io/api/mcp}`. Verktøyene heter
  derfor `mcp__plugin_kasus_kasus__<verktøy>` — under står bare `<verktøy>`.
- **Innlogging med Kasus-kontoen (OAuth).** Første gang: `/mcp` → `plugin:kasus:kasus`
  → Authenticate. Har brukeren flere organisasjoner, velger hun én i nettleseren.
  Ingen API-nøkkel, og ingenting å sette i `settings.json`.
- **Tilkoblingen avgjør organisasjonen.** Ingen `organizationId` sendes noe sted.
  Det har én konsekvens som må med i hvert svar: et tomt resultat betyr «tomt for
  DENNE organisasjonen», ikke «tomt i Kasus», og «ikke funnet» på en id betyr
  «finnes ikke ELLER tilhører en annen organisasjon». `get_organization` sier
  hvilken organisasjon det er.
- **Serveren er read-only.** Den har ingen skriveverktøy og intet scope som kunne
  gitt dem, så ingenting pluginen gjør kan endre noe i Kasus. Status på signaler
  og briefs endres i web-appen; «hva har jeg sett» er journalistens egen
  kvittering, på disk.

## Verktøyene

| Verktøy | Argumenter | Merk |
|---|---|---|
| `get_organization` | — | Navn, `slug` og nettsted. Billig. `slug` er det kvitteringen nøkles på (`--org`). |
| `get_editorial_profile` | — | Redaksjonsprofil, `criteria.patterns`, innsikter og radar-søk. Har også `organization.slug`. |
| `list_radar_signals` | `status`, `type`, `origin`, `hours`, `min_relevance`, `bucket_id`, `limit` (maks 50), `cursor` | Sortert på `detectedAt`, nyeste først |
| `search_radar_signals` | `query` + samme filtre | **Ordsøk** i tittel, sammendrag og kilde. Alle ordene må treffe |
| `get_radar_signal` | `id` | Hele signalet: `details` (aktører, nøkkeltall), `sources`, mappe og briefs laget av det |
| `list_story_briefs` | `status`, `origin`, `hours`, `limit` (maks 50), `cursor` | Kasus' EGNE saksforslag, nyest laget først. Avviste utelates uten `status` |
| `search_story_briefs` | `query` + samme filtre | Ordsøk |
| `get_story_brief` | `id` | Hele briefen med kilder |
| `list_articles` | `status`, `cms`, `hours`, `publication`, `limit` (maks 50), `cursor` | Redaksjonens EGNE saker. Nyest publisert først; upublisert sist. Kort ingress, ingen brødtekst |
| `search_articles` | `query` + samme filtre | **Ordsøk** i tittel, undertittel, stikktittel, tags, seksjon og brødtekst |
| `get_article` | `id` | Hele artikkelen, brødtekst som ren tekst |

Alle svar er JSON. Lister har `nextCursor`; den er `null` på siste side.

### Paginering: et vindu er flere kall

`limit` er maks 50 per kall. Et vindu på 100 signaler er to kall, 200 artikler er
fire — send `cursor: <nextCursor>` fra forrige svar til du har nok eller
`nextCursor` er `null`. **Er `nextCursor` ikke null når du stopper, er taket
nådd**: det finnes MER enn det du hentet, og det skal sies. En liste som stopper
på 100 uten å si det, leses som «det finnes bare 100».

### `hours` måler tre ulike ting

| Verktøy | `hours` måles mot | Et tomt svar betyr |
|---|---|---|
| signaler | `detectedAt` — når radaren **fant** signalet | radaren har ikke funnet noe i perioden |
| story-briefs | `createdAt` — når **Kasus laget** briefen | pipelinen har ikke laget noe i perioden |
| artikler | `published` — når **redaksjonen publiserte** | redaksjonen har ikke publisert i perioden. Upublisert faller utenfor |

## Ordsøk er ikke en dekningssjekk

`search_radar_signals` og `search_articles` er **ordsøk**: alle ordene må stå der.
De er nyttige — «har vi en sak med ordet nettleie?» er ett kall — men de svarer
nei på nettopp de tilfellene som koster en dublett: «prisfall i Bodø» og «nedgang
i kvadratmeterprisen i Nordland» er samme sak for en leser og har ikke ett ord til
felles.

Derfor er regelen:

- **Et tema matches semantisk mot et VINDU** (de N nyeste), lest av deg eller en
  agent. Ordsøket er et TILLEGG som når lenger tilbake enn vinduet, ikke en
  erstatning for lesingen.
- **Et tomt ordsøk er ikke et nei.** «Ingen treff på ‹nettleie›» betyr at ordet
  ikke står der, ikke at temaet er udekket. Prøv to–tre ord og synonymer før du
  sier noe om det, og si hvilke du prøvde.

## Signalene

### De fire kategoriene

`type` sier hva signalet er, `origin` hvorfor vi har det. Begge oppfølgingssøkene
lagrer funnene som `market_signal`, så kategorien krever at de to leses
**samtidig**. Regn den ut slik, i denne rekkefølgen — og bare slik, så den betyr
det samme i hver kommando, ferdighet og agent:

| Felt | Kategori | Kort navn (arbeidsmateriale) |
|---|---|---|
| `origin: own_followup` | Oppfølging av EGEN sak | `egen_oppfolging` |
| `origin: competitor_followup` | Oppfølging av KONKURRENTSAK | `konkurrent_oppfolging` |
| en annen, ukjent `origin` | Annet opphav — ikke en feil, og ikke en grunn til å utelate signalet | `annet` |
| `origin: null` + `type: competitor_article` | Konkurrentsak direkte | `konkurrentsak` |
| `origin: null` + `type: market_signal` | Fritt temasøk | `temasok` |

Hva de betyr i praksis:

- **Oppfølging av EGEN sak** — nye kilder på noe redaksjonen alt har publisert.
  Egne domener er utelatt fra søket, så dette er andre som har noe å tilføye. Ofte
  den billigste gode saken på lista.
- **Oppfølging av KONKURRENTSAK** — andre kilder på et sakskompleks en konkurrent
  har tatt. Konkurrentenes egne domener er utelatt, så dette er IKKE konkurrentens
  artikkel — det er kildene den bygger på, eller nye.
- **Konkurrentsak direkte** — hentet fra en overvåket forside. Ikke et søketreff og
  ikke research: det er saken deres, slik den står.
- **Fritt temasøk** — søketreff på et tema, hentet UAVHENGIG av
  publiseringstidspunkt. Her varierer relevansen mest, og her ligger de gamle
  sakene.

`origin`-filteret i `list_radar_signals` tar bare de to kjente verdiene; «bare
temasøk» eller «bare konkurrentsaker» filtreres på det som er hentet, med `type`
og `origin: null` lest sammen.

### Oppdaget og publisert er to tall

`detectedAt` er når radaren fant signalet. `publishedDate` er når SAKEN ble
publisert. Et fritt temasøk kan levere en artikkel fra 2023 som ble «oppdaget for
45 minutter siden».

- **GAMMEL SAK**: `publishedDate` er mer enn **7 dager** før `detectedAt`. Si det
  ved hver slik sak, og rangér den ned med mindre det gamle er poenget.
- **Ukjent dato**: `publishedDate` er `null`. Det er IKKE «fersk», og ikke
  «gammel» — det er ukjent, og det sies. Et datofilter du gjør selv («bare saker
  publisert siste døgn») slipper dem ikke gjennom, og antallet som falt ut sies.

### Mønsteret

`matchedPattern` er samme streng som `criteria.patterns[].name` i profilen — koblingen
mellom «hvorfor ble dette plukket opp» og «hva fungerer for disse leserne».
`null` betyr at radaren fant signalet uten at profilen forklarer hvorfor; en topp
der er en opplysning, ikke en feil. «Uten mønstertreff» er derfor et eget svar i
fordelingen, ikke en utelatelse.

### Nytt siden sist

Hvilke signaler som er NYE er det bare kvitteringen som vet. Den ligger på disk og
leses med `kasus.mjs vindu --org <slug> --json` (se
[`vindu.md`](vindu.md)). Et signal fra `list_radar_signals` er:

| Regel, i denne rekkefølgen | Er |
|---|---|
| `status: dismissed` (med mindre brukeren ba om de forkastede) | **holdt utenfor** — noen har alt vurdert det. Antallet sies |
| `id` står i `meta.altSett` | **alt sett** |
| `detectedAt` er før `meta.vindu.fra` | **utenfor vinduet** — lå der forrige gang også |
| ellers | **nytt** |

Id-ene til de NYE er det som kvitteres for til slutt (`kvitter --ids`).

### Feltene i en liste

`list_radar_signals` gir per signal: `id`, `type`, `origin`, `status`, `title`,
`summary` (kortet ned til 400 tegn), `url`, `sourceLabel`, `matchedPattern`,
`relevanceScore` (1–10, satt av radaren), `detectedAt` og `publishedDate`. Hele
researchkonteksten — `details.actors`, `details.keyFigures`, alle `sources` —
står bare i `get_radar_signal`, og hentes for de få signalene som faktisk velges.

`url: null` betyr at signalet ikke kan åpnes og må vurderes på tittelen alene — en
grunn til å prioritere det ned, og noe som sies.

**Signal-`status`:** `new`, `seen`, `promoted` (løftet til en brief), `dismissed`.
Statusen settes i Kasus av redaksjonen, og er ikke kvitteringen.

## Story-briefs er et OPPSLAG, ikke en inngang

`list_story_briefs` svarer på «hva ligger det alt av forslag i Kasus?» — typisk før
man setter i gang, for ikke å gjøre arbeidet innholdspipelinen alt har gjort. Men
saksløpet går fra et RÅTT radarsignal til et forslag med research og et spor
tilbake til opphavet, og en ferdig vurdert brief ville vært et konkurrerende
utgangspunkt i samme arbeidsflyt. Ingen ferdighet og ingen agent starter derfra,
og det er håndhevet i `/kasus:test`.

Ordet «saksforslag» betyr derfor to ting som ikke må forveksles: fila pluginen
skriver på disk etter et saksløp, og briefen pipelinen har laget inne i Kasus.
Bare den ene har et signal, en dekningssjekk og daterte kilder bak seg.

- **Brief-`status`** (`candidate`, `proposal`, `draft`, `final`, `dismissed`):
  `candidate` og `proposal` ser ut som synonymer og er det ikke — forskjellen er om
  noen har vurdert saken ferdig.
- **Brief-`origin`** (`innhold`, `radar`, `url`, `triage`) er hvor briefen oppsto i
  Kasus, ikke signalets `origin`.
- `title` og `angle` kan være `null` — en `candidate` som ikke er skrevet ut ennå.
  Si det framfor å vise en blank linje.
- `plot`, `angle` og `reason` er skrevet av pipelinen: de er ikke kilder, og ingen
  har etterprøvd dem. `sources` er det eneste i en brief som peker utenfor Kasus.

## Artiklene

- **Vinduet for «har vi dekket dette før?»** er de 200 nyeste PUBLISERTE:
  `list_articles` med `publication: "published"`, `limit: 50`, fire sider. Både
  størrelsen og forbeholdet står i svaret: en tom treffliste betyr «ikke blant
  disse artiklene», aldri «ikke dekket».
- **Kladder** hentes for seg: `publication: "unpublished"`. De sorteres sist av
  serveren, så i en blandet liste faller de ut i det øyeblikket taket nås — derfor
  skilles de eksplisitt, på publiseringsdato framfor på `status`. En kladd på samme
  tema betyr at en kollega alt skriver saken: «ingen treff» blant de publiserte er
  ikke «ingen jobber med dette».
- **`status` er fritekst**, ikke et enum: feltet speiler kundens CMS. Labrador og
  Sanity bruker `P`/`D`, WordPress sender `draft`, `pending` og `private` rett
  gjennom. Bruk `publication` for publisert/upublisert.
- **Lista har tittelfelt og ingress (`excerpt`, maks 300 tegn), ikke brødtekst.**
  Står poenget i avsnitt fire, må artikkelen hentes med `get_article`.

## Feil, og hva de betyr

| Svar | Tiltak |
|---|---|
| Verktøyene finnes ikke, eller `kasus` står som «needs authentication» / «failed» i `/mcp` | Ikke innlogget, eller serveren nås ikke. `/mcp` → `plugin:kasus:kasus` → Authenticate. Se `/kasus:env`. |
| «… ikke funnet» | Finnes ikke, ELLER tilhører en annen organisasjon. |
| «Input validation error» | Ugyldig argument (en status som ikke finnes, `limit` over 50). Les meldingen og rett kallet. |
| 403 / avvist etter at det har virket | Brukeren er ikke lenger medlem av organisasjonen, eller appen er koblet fra i Kasus (Innstillinger → Tilkoblede apper). Logg inn på nytt via `/mcp`. |
