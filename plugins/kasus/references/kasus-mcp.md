# Kasus' MCP-server — kontrakten pluginen bygger på

Lastes ved behov. Den autoritative dokumentasjonen bor i kasus-repoet
(`docs/internal/mcp-server.md`, koden i `apps/frontend/lib/mcp/`); dette er det
pluginen faktisk er avhengig av.

## Grunnlaget

- Pluginen har ingen egen kode. Alt går gjennom MCP-serveren `kasus`, som
  pluginen registrerer selv (`.mcp.json` i plugin-rota). Verktøyene heter fullt ut
  `mcp__plugin_kasus_kasus__<navn>`; i pluginens tekster står bare `<navn>`.
- Adresse: `KASUS_MCP_URL`, default `https://app.kasus.io/api/mcp`.
- **Pålogging med OAuth.** Første gang: `/mcp` → `kasus` → *Authenticate*, logg
  inn i Kasus, velg organisasjon og godkjenn. Tilkoblingen får `kasus:read` og
  `kasus:write`.
- **Tilkoblingen avgjør organisasjonen.** Ingen `organizationId` sendes noe sted.
  Et tomt resultat betyr «tomt for DENNE organisasjonen», ikke «tomt i Kasus», og
  «ikke funnet» på en id betyr «finnes ikke ELLER tilhører en annen organisasjon».
  `get_organization` sier hvilken organisasjon det er, og om tilkoblingen kan
  skrive (`auth.canWrite`).

## Notasjonen i pluginens tekster

Et verktøykall skrives som navnet og argumentene som JSON:

```
list_radar_signals { "hours": 24, "limit": 100 }
```

Argumenter som utelates har serverens default. Svarene er JSON.

## Lesing (`kasus:read`)

| Verktøy | Argumenter | Merk |
|---|---|---|
| `get_organization` | — | Organisasjonen, og `auth.canWrite` |
| `get_editorial_profile` | — | Redaksjonsprofil, mønstre (`criteria.patterns`) og radar-søk |
| `get_new_signals` | `hours`, `limit` (≤ 100, default 40), `include_dismissed` | **Saksløpets status.** Se under |
| `list_radar_signals` | `status`, `type`, `origin`, `hours`, `min_relevance`, `bucket_id`, `limit` (≤ 100), `cursor` | Nyeste først (`detectedAt`) |
| `search_radar_signals` | `query` + samme filtre | Ordsøk i tittel, sammendrag og kilde |
| `get_radar_signal` | `id` | Alle kilder og hele researchkonteksten |
| `list_articles` | `status`, `cms`, `hours`, `publication`, `limit` (≤ 100), `cursor` | Redaksjonens EGNE saker, med kort ingress, uten brødtekst |
| `search_articles` | `query` + samme filtre | Ordsøk, også i brødteksten |
| `get_article` | `id` | Hele teksten som ren tekst |
| `list_story_briefs` / `get_story_brief` / `search_story_briefs` | | Kasus' EGNE forslag. Et oppslag, se under |
| `list_story_proposals` / `get_story_proposal` | | Saksforslagene saksløpet har lagret |

`nextCursor` er `null` på siste side. Er den satt, finnes det MER enn det som ble
hentet — **taket er nådd**. Hent neste side med `cursor` framfor å late som lista
er hel. Et vindu på 200 artikler er derfor to kall.

### Signal-sammendraget

Hvert signal i listene har:

| Felt | Betyr |
|---|---|
| `category` | Pluginens firedeling, utledet serverside av `origin` og `type` lest SAMMEN: `egen_oppfolging`, `konkurrent_oppfolging`, `konkurrentsak`, `temasok` |
| `matchedPattern` | Samme streng som `criteria.patterns[].name` i profilen. `null` = radaren fant dette uten at profilen forklarer hvorfor — en opplysning, ikke en feil |
| `detectedAt` | Når radaren FANT signalet. Det `hours` måler |
| `publishedDate` | Når SAKEN ble publisert. Kan mangle |
| `storyAge` | `fresh`, `stale` (publisert mer enn 7 dager før den ble oppdaget — «GAMMEL SAK») eller `unknown`. Ukjent er IKKE fersk |
| `sourceCount` | Antall kilder bak signalet. Flere enn én: de andre står i `get_radar_signal` |
| `url` | Kan være `null` — da må signalet vurderes på tittelen alene |
| `summary` | Kortet til 400 tegn |

| `origin` | `category` | Betydning |
|---|---|---|
| `own_followup` | `egen_oppfolging` | Nye kilder på en av redaksjonens EGNE ferske saker. Egne domener er utelatt fra søket |
| `competitor_followup` | `konkurrent_oppfolging` | Andre kilder på en konkurrentsak. Konkurrentens domener er utelatt |
| `null` + `type: competitor_article` | `konkurrentsak` | Fra en overvåket forside. Ikke et søketreff |
| `null` + `type: market_signal` | `temasok` | Fritt temasøk, hentet uavhengig av publiseringstidspunkt |

**`hours` på signaler måles mot `detectedAt`, ikke publiseringsdato.** Et fritt
temasøk kan levere en sak fra 2023 som ble oppdaget i dag. Det er `storyAge` og
`publishedDate` som sier hvor gammel SAKEN er.

**Bare `status`, `type`, `origin`, `hours`, `min_relevance` og `bucket_id` filtrerer
serverside.** «Kun temasøk», «uten mønster», «uten lenke», «bare ferske» og et
bestemt mønster er ikke filtre: hent vinduet og les det. Sier du hva som ble lest
bort, så et utvalg ikke forveksles med et tomt datasett.

### `get_new_signals` — nytt siden sist

Det ENESTE som kjenner kvitteringen. Leser, skriver ingenting.

| Felt | Betyr |
|---|---|
| `checkpoint` | Når det sist ble kvittert, eller `null` (første saksløp) |
| `window.hours` / `window.basis` / `window.from` | Vinduet: kvitteringen minus 2 timers etterslep, rundet opp (`kvittering`); 24 t uten kvittering (`første saksløp`); eller `hours` (`overstyrt`) |
| `count` / `truncated` | Antall nye, og om taket (`limit`) ble nådd |
| `skipped.seen` / `skipped.dismissed` | Holdt utenfor fordi de alt er kvittert for / forkastet |
| `groups` | Signal-id-ene per `category`, med tittel og forklaring. Tomme kategorier er utelatt |
| `patternDistribution` | Antall per `matchedPattern`, flest først, med «uten mønstertreff» for seg |
| `staleStories` | Signalene der saken er gammel selv om signalet er ferskt |
| `signals` | Sammendragene |
| `ack` | Argumentene til `acknowledge_signals` hvis saksløpet fullføres, og de sendes uendret: `{ at, ids }`, eller `{ ids, ids_only: true }` når lista er avkortet — da ville et tidspunkt svelget eldre usette signaler |

### Story-briefs er et OPPSLAG, ikke en inngang

`list_story_briefs` svarer på «hva ligger det alt av forslag i Kasus?» — typisk før
man setter i gang. Men ingen ferdighet og ingen agent kaller dem, og det er
håndhevet i `/kasus:test`: saksløpet går fra et RÅTT radarsignal til et forslag
med research og et spor tilbake til opphavet, og en ferdig vurdert brief ville
vært et konkurrerende utgangspunkt.

Ordet «saksforslag» betyr derfor to ting, og de må ikke forveksles: **saksforslaget**
saksløpet lagrer (`create_story_proposal`), og **briefen** pipelinen har laget
inne i Kasus. Bare den ene har et signal, en dekningssjekk og daterte kilder bak
seg.

`hours` på briefs måles mot `createdAt` — når KASUS laget briefen. Brief-`status`
(`candidate`, `proposal`, `draft`, `final`, `dismissed`) er et enum; `candidate` og
`proposal` er ikke synonymer — forskjellen er om noen har vurdert saken ferdig.
Brief-`origin` (`innhold`, `radar`, `url`, `triage`) er ikke signalets `origin`.
`title`, `plot` og `angle` kan mangle, og `plot`, `angle` og `reason` er skrevet
av en modell — de er ikke kilder. `sources` er det eneste som peker utenfor Kasus.

### Egne artikler

**`hours` på artikler måles mot `published`.** Upublisert materiale faller derfor
utenfor når `hours` settes.

**Kladder skilles ut med `publication`**, ikke med `status`: `status` er fritekst
som speiler kundens CMS (`P`/`D` i Labrador og Sanity, egne verdier i WordPress).
`publication: "published"` gir bare publiserte saker; `"unpublished"` gir
kladdene. Uten filteret sorteres kladder bakerst og faller ut når taket nås — det
er ikke en regel, men en funksjon av redaksjonens størrelse. Si det når det
gjelder.

`search_articles` er et ORDSØK: samme sak skrevet med andre ord gir ikke treff.
«Har vi dekket dette før?» besvares derfor ved å lese et vindu av de nyeste
sakene (`list_articles`), med ordsøket som et supplement — aldri som svaret alene.
En tom treffliste betyr «ikke blant disse», aldri «ikke dekket».

## Skriving (`kasus:write`)

Bare pluginens EGNE data. Status på signaler, briefs og artikler endres i
web-appen, ikke herfra. Skriveverktøyene finnes bare når tilkoblingen er logget
inn med OAuth — med en API-nøkkel er tilkoblingen read-only, og saksløpet kan
verken kvittere eller lagre.

| Verktøy | Argumenter | Merk |
|---|---|---|
| `acknowledge_signals` | `at`, `ids`, `ids_only`, `reset` | **Det eneste som flytter kvitteringen.** Se under |
| `create_story_proposal` | `title`, `content`, `category`, `status`, `radar_signal_id`, `article_id`, `metadata` | Opphavet er påkrevd: `radar_signal_id`, `article_id` eller begge |
| `update_story_proposal` | `id` + feltene over | Bare oppgitte felt endres; `content` og `metadata` erstattes i sin helhet |

**Kvitteringen gjelder hele redaksjonen** — den er per organisasjon, ikke per
journalist. Et saksløp én journalist fullfører, flytter «siden sist» for alle.

| Kall | Virkning |
|---|---|
| `acknowledge_signals` med `ack` fra `get_new_signals`, uendret | Saksløpets kvittering: det som ble vist er sett — og når lista var hel, alt oppdaget før `at` |
| `acknowledge_signals { "ids": ["<id>"], "ids_only": true }` | Bare disse id-ene er sett; tidspunktet står. Trygt når bare én sak ble behandlet |
| `acknowledge_signals {}` | Alt oppdaget før NÅ er sett — også det ingen fikk se. Sies alltid |
| `acknowledge_signals { "reset": true }` | Kvitteringen fjernes; neste saksløp ser siste døgn |

Tidspunktet flyttes aldri bakover (bare `reset` gjør det), og samtidige kvitteringer
fra flere journalister overskriver ikke hverandre. `at` kan ikke ligge fram i tid (en tastefeil i årstallet ville slått av saksløpet
i stillhet). `unknownIds` i svaret er id-er som ikke finnes i organisasjonen og
ble ignorert. Inntil 300 id-er huskes.

## Feil, og hva de betyr

| Svar | Tiltak |
|---|---|
| Verktøyene finnes ikke | Pluginens MCP-server er ikke tilkoblet eller ikke logget inn: `/mcp` → `kasus`. Se `/kasus:env` |
| `acknowledge_signals` / `create_story_proposal` finnes ikke | Tilkoblingen kan bare lese (API-nøkkel, eller logget inn før `kasus:write` fantes). Logg inn på nytt med OAuth |
| `… ikke funnet` | Finnes ikke, ELLER tilhører en annen organisasjon |
| `403` | Brukeren er ikke lenger medlem av organisasjonen tilkoblingen er bundet til |
