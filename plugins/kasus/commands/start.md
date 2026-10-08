---
description: Kom i gang — henter siste døgn av alt (radarsignaler, Kasus' egne story-briefs og redaksjonens egne artikler, pluss «nytt siden sist»), eller helt tilbake til forrige kvittering om det er lenger siden, legger det fram slik det er, og spør hva du vil gjøre: en oppfølger, en dybdeartikkel eller et spørsmål. `--hours N` overstyrer alle fire. Bearbeider ingenting, utfører ingenting
argument-hint: [--hours 72] [--all]
allowed-tools: ["mcp__plugin_kasus_kasus__get_new_signals", "mcp__plugin_kasus_kasus__list_radar_signals", "mcp__plugin_kasus_kasus__list_story_briefs", "mcp__plugin_kasus_kasus__list_articles", "Agent", "Task", "AskUserQuestion"]
---

Legg fram **materialet slik det ligger**, og kom i gang. Fire kall og **ett
spørsmål** — ingen agent, ingen research, ingenting lagret, **ingen kvittering.**

Kommandoen henter **siste døgn** av tre ting journalisten ellers måtte be om hver
for seg: radarens signaler, **Kasus' egne story-briefs** (forslagene
innholdspipelinen har laget) og **redaksjonens egne ferske artikler** — og helt
tilbake til forrige kvittering, om det er lenger siden. Til sammen er det svaret på
«hva har vi å jobbe med i dag?» — og de tre kildene peker mot ulike neste steg: en
egen artikkel mot en **oppfølger**, et signal eller en brief mot en
**dybdeartikkel**.

Arbeidet gjør ferdighetene: `dybdeartikkel` for en ny sak, `oppfolgersak` for en
oppfølger på noe redaksjonen alt har publisert. Det er hele delingen — her hentes
grunnlaget valget tas på, og valget avgjør hvilken ferdighet som tar over.

**Kommandoen bearbeider ingenting.** Den slår ikke sammen signaler som er samme
sak, og den feller ingen dekningsdom. Det er et valg, og prisen står i steg 4:
lista kan inneholde tre signaler om det samme, og en sak redaksjonen skrev i fjor.
Vil journalisten ha det luket, finnes `kasus-triage` — se «Merk».

## 1. Hent statusen først, så listene

To runder, og det er ikke en forglemmelse: **vinduet kommer fra kvitteringen**, og
den er det bare `get_new_signals` som kjenner. Alle kallene går til Kasus'
MCP-server — notasjonen står i
[`references/kasus-mcp.md`](../references/kasus-mcp.md).

```
get_new_signals {}            # med { "hours": N } hvis $ARGUMENTS har --hours N,
                              # og { "include_dismissed": true } hvis --all
```

Regn ut vinduet `V` etter **vindusregelen** — den står i
[`references/vindu.md`](../references/vindu.md), og skal leses derfra framfor å
gjengis her: `V = brukerens --hours N` hvis oppgitt, ellers
`max(24, window.hours)`. Døgnet er et **gulv**, ikke et tak.

Hent så de tre listene i **samme melding**, alle med `"hours": V`:

```
list_radar_signals { "hours": V, "limit": 100 }
list_story_briefs  { "hours": V, "limit": 40 }
list_articles      { "hours": V, "limit": 60, "publication": "published" }
```

| Kall | Vindu | Tak |
|---|---|---|
| `get_new_signals` | mot kvitteringen (24 t om den mangler) | `limit`, default 40 |
| `list_radar_signals` | `V` | 100 |
| `list_story_briefs` | `V` | 40 |
| `list_articles` | `V` | 60 |

**Perioden skal stå i svaret**, og den skal være den faktiske: «siste døgn» når
`V` er 24, «siste fem døgn — siden du kvitterte tirsdag» når kvitteringen hevet
den. En periode som ikke sies, leses som «alt».

Takene er satt over normalt døgnvolum. Vokser `V`, binder de oftere: en radar som
leverer seksti signaler i døgnet fyller 100 på under to døgn. Er `nextCursor`
satt (eller `truncated` sann på `get_new_signals`), mangler svaret data — **si
det, og hent neste side** framfor å krympe vinduet. Det er nettopp de gamle usette signalene gulvet skulle fange. I
tråden er formen «det kan finnes mer enn dette»; flagget er ditt.

Tre svar fra `get_new_signals` krever noe annet enn å gå videre:

- **Verktøyet finnes ikke, eller kallet feiler på tilgang** — tilkoblingen er
  ikke på plass. Da feiler alle fire likt. Si det, foreslå `/kasus:env`, og stopp.
- **`count: 0`** — ingenting nytt **siden sist**. Det er ikke det samme som at det
  ikke ligger noe der: de tre listene svarer på det andre spørsmålet, og de kan
  være fulle. Si når det sist ble kvittert, og gå videre.
- **`checkpoint: null`** — første gang. Si at «nytt siden sist» derfor betyr siste
  24 timer, og at en kvittering til slutt gjør det presist neste gang.

## 2. Fire svar som måler fire forskjellige ting

Dette er den ene fella i kommandoen, og den er lett å gå i: **`--hours` betyr ikke
det samme i de tre listene.**

| Kall | `hours` måles mot | Et tomt svar betyr |
|---|---|---|
| `list_radar_signals` | `detectedAt` — når radaren **fant** signalet | radaren har ikke funnet noe det siste døgnet |
| `list_story_briefs` | `createdAt` — når **Kasus laget** briefen | pipelinen har ikke laget noe det siste døgnet |
| `list_articles` | `published` — når **redaksjonen publiserte** | redaksjonen har ikke publisert det siste døgnet |

**Er `V` et døgn, er tomt vanlig.** En redaksjon som ikke publiserte i går har
ikke sluttet å publisere, og pipelinen kjører i puljer — så et tomt felt er et
fravær i perioden, aldri et fravær i Kasus. Er to av tre tomme, er tiltaket å
tilby et bredere vindu (en uke, `"hours": 168`) framfor å konkludere med at det ikke er noe
å jobbe med.

Og innad i signalene er `oppdaget` og `publisert` to forskjellige tall: et fritt
temasøk hentes uavhengig av publiseringstidspunkt, så et signal oppdaget i dag kan
være en sak fra 2023. Er `storyAge` `stale`, si at det er en gammel sak.

Fra `get_new_signals` er det tre ting som ER statusen: **hvor lenge det er siden du så på
dette sist**, **hvor mye som er nytt av det som ligger der**, og **`patternDistribution`** —
hva funnene handler om, flest først. Den ene linja som svarer på «hva skjer» uten
at man leser sju signaler, og den sies med temaene i klartekst: «tolv om
boligmarkedet, åtte om samferdsel». En topp på «uten mønstertreff» er også en
opplysning — sagt som «og elleve som ikke ligner på noe dere pleier å dekke».

Signal-id-ene fra `get_new_signals` brukes til én ting: å **merke** hvilke av signalene i den
rå lista som er nye siden sist. Merkingen er et ord i tråden — «ny siden i går» —
ikke en id. Et signal som lå der forrige gang også er fortsatt en sak: det skal
med, men det skal sies.

Alle id-ene derfra **skal** finnes i signal-lista, fordi vinduet er minst så
bredt som «siden sist» (vindusregelen). Finner du likevel en id som ikke er der,
er taket nådd på lista — ikke en feil i merkingen. Si det framfor å utelate
signalet i stillhet.

## 3. Legg fram kort, i tre bolker

Ikke tre lister i sin helhet. To hundre elementer i sin helhet er ikke et blikk,
det er en utskrift. **Fire til åtte linjer per bolk**, og formen på hver sak er
den som står i [`references/samtaleform.md`](../references/samtaleform.md) —
**tittel, én til to linjer om hva saken er, klikkbar lenke**. Les den derfra
framfor å gjengi den her.

Kortversjonen, fordi den avgjør hele dette steget: journalisten skal kunne
**velge**, og id-er, kategorinavn, mønsternavn, feltnavn og flagg hjelper henne
ikke å velge. De blir liggende hos deg — du trenger dem i steg 4 og i ferdigheten
som tar over.

Bolkene i denne rekkefølgen — nærmest redaksjonens eget arbeid først:

1. **VÅRE EGNE FERSKE SAKER (oppfølger-materialet).** Uttrekket fra redaksjonens
   eget CMS — Labrador hos de fleste — og bare det som er **publisert**: ruten
   sorterer kladder bakerst, så de faller utenfor i det øyeblikket taket nås.
   Lista er «hva vi publiserte», ikke «hva noen sitter og jobber med»; kladdene er
   et eget oppslag (`"publication": "unpublished"`). Alle, om det er få — er `V` et døgn, er
   det gjerne en håndfull. Tittel, når den ble publisert, og lenka. Dette er det
   billigste utgangspunktet som finnes: vinklingen er alt gjort, og det som mangler
   er det nye. Én linje om bildet: «sju saker i går, tyngst på samferdsel».
2. **DET RADAREN HAR FUNNET (dybde-materialet).** De tre-fem øverste. Radaren er
   tre ting i ett — konkurrentenes forsider, redaksjonens egne ferske saker, og søk
   gjort på grunnlag av begge — og det avgjør hvor mye arbeid som gjenstår på hvert
   funn. **Si i klartekst hvilket av de fire slagene funnet er.** Kategorinavnet
   blir hos deg; betydningen skal på skjermen:

   - **oppfølging av EGEN sak** — «nytt om en sak vi alt har publisert». Egne
     domener er utelatt fra søket, så treffene er det andre har og vi ikke har.
   - **oppfølging av konkurrentsak** — «konkurrenten har denne, dette er kildene
     under den». Konkurrentenes egne domener er utelatt: dette er materialet til å
     gjøre saken bedre enn dem, ikke saken deres.
   - **konkurrentsak direkte** — «denne ligger på forsiden deres nå». Plukket fra
     en overvåket forside, ikke et søketreff.
   - **fritt temasøk** — «søketreff på et tema, så sjekk datoen». Hentet uavhengig
     av publiseringstidspunkt, og det slaget med mest varierende relevans.

   Si i tillegg hvor gammel saken er, og hva som er kommet inn siden forrige gang
   du så på dette. Mangler et signal lenke, si det: da er det ingenting å lese seg
   opp på, og det er i seg selv en grunn til å prioritere det ned.
3. **FORSLAG SOM ALT LIGGER I KASUS.** De tre-fem nyeste, med tittel og vinklingen
   i én linje. Si hva de ER: forslag innholdspipelinen har laget inne i Kasus,
   ikke saksforslagene journalistene lagrer fra saksløpet, og **ikke etterprøvd av noen** —
   plottet, vinklingen og begrunnelsen er skrevet av en modell. Kildelenkene er det
   eneste i en brief som peker utenfor Kasus — det er der etterprøvingen begynner.
   Er et av dem uten tittel, er det en kandidat ingen har skrevet ut ennå; si det
   framfor å vise en blank linje.

Pluss én linje om **totalene**, med perioden på: «I går fant radaren 58 saker, det
kom tre forslag i Kasus, og vi publiserte sju» er grunnlaget i én setning.
Perioden i den linja er `V`, og skal være det faktiske tallet — «siste døgn» bare
når det er et døgn.

**Tre forbehold hører i svaret, ikke i en fotnote** — og de sies på norsk, ikke som
feltnavn:

- **Ingenting er konsolidert.** Er tre av funnene den samme SSB-saken, står de som
  tre. Ser du det, si det som en merknad — men ikke slå dem sammen selv, og ikke la
  lista se bearbeidet ut.
- **Ingenting er sjekket mot egen dekning.** Kommandoen feller ingen dekningsdom.
  De egne sakene i bolk 1 er «hva vi publiserte nå», ikke «har vi skrevet om dette
  før?» — og perioden er *langt* fra nok til det siste, som leses mot de 200
  nyeste sakene inne i ferdigheten. Si det som «jeg har ikke sjekket om vi har
  skrevet om noe av dette før». Sier du noe annet, blir et fravær lest som en
  klarering.
- **Rekkefølgen er ikke en prioritering.** Profilen hentes ikke her — den er
  premisset for å prioritere og skrive, ikke for å velge hva man vil gjøre.
  Rangeringen mot `criteria.patterns` er ferdighetens første egne arbeid. Si det i
  én linje framfor å la lista se ut som en topplista den ikke er.

## 4. Ett spørsmål

Avslutt med **ett** — `AskUserQuestion`, ikke en oppfordring i prosa som blir
liggende ubesvart. Alternativene bygges på hva som faktisk sto på skjermen:

| Materialet viste | Alternativene (maks fire) |
|---|---|
| **både egne saker og signaler** | følg opp en av våre egne saker · skriv en ny sak på et av funnene · spør om noe i materialet · ikke nå |
| **egne saker, men tørr radar** | følg opp en av våre egne saker · se en uke tilbake · spør om noe i materialet · ikke nå |
| **funn og forslag, ingen ferske egne saker** | skriv en ny sak på et av funnene · spør om noe i materialet · se en uke tilbake · ikke nå |
| **alt tomt** | se en uke tilbake · ta med det som er forkastet · sjekk oppsettet · ikke nå |

**Alternativene sier hva som skal gjøres, i journalistens ord.** Flagget som får
det til å skje — `"hours": 168`, `"include_dismissed": true` — setter du selv etterpå; det er ikke noe
hun skal velge mellom. `/kasus:env` er unntaket: den skriver hun selv, så den kan
nevnes ved navn.

Er ett av dem åpenbart best — en egen sak fra i går som radaren alt har levert nye
kilder på — legg det først og si hvorfor. Det er den billigste gode saken som
finnes.

**Spørsmålet gjelder hva som skal GJØRES, ikke hvilken sak som skal skrives.**
Valget av sak hører i ferdigheten, der et valg fører til research, et lagret
saksforslag og en kvittering. Her velges bare inngangen:

| Svaret | Hvem tar over |
|---|---|
| en oppfølger på en egen sak | ferdigheten **`oppfolgersak`** |
| en dybdeartikkel fra et signal | ferdigheten **`dybdeartikkel`** |
| et spørsmål om signalene | agenten **`kasus-lookout`** |
| et spørsmål om egen dekning | agenten **`kasus-archivist`** |
| «rydd opp i dette først» | agenten **`kasus-triage`** — konsoliderer og luker |
| ikke nå | ingen. Si ingenting mer — ingen kvittering, ingenting er «brukt opp», og alt ligger der neste gang. |

Ferdigheten kjører **sitt eget steg 1**. Ikke prøv å gi den dataene dine i stedet:
den trenger profilen i tillegg, vinduet sitt er et annet, og uthentingen skriver
ingenting — så det koster ett kall, mot to ulike start-tilstander å virke i.

**Ikke begynn arbeidet her**, uansett hvor tydelig svaret er.

## Merk

- **En brief er ikke et utgangspunkt for saksløpet.** Story-briefene legges fram
  fordi de svarer på «er dette alt tenkt på?», og fordi en brief kan gi
  journalisten idéen. Men `dybdeartikkel` krever et **signal**: sporet tilbake til
  hvorfor saken ble tatt opp (`kasusSignalId`, `signalUrl`) er halve verdien av
  forslaget, og en brief har ikke det sporet. Vil journalisten jobbe med en brief,
  er veien å finne signalet den handler om — eller å skrive den ut selv, utenfor
  pluginen.
- **Kommandoen luker ikke.** Vil journalisten ha bildet bearbeidet — samme sak slått
  sammen, det dekkede merket — er det `kasus-triage`, som sveiper hele
  signalvinduet mot alle de 200 nyeste egne sakene og leverer kandidatsaker med
  dekningsdom. Den koster et par minutter, og den kan kjøres etter dette blikket:
  «rydd opp i signalene» holder.
- **Du trenger ikke denne kommandoen for å spørre.** «Er det noe om strømpriser?»
  går rett til `kasus-lookout`, «har vi skrevet om dette?» til `kasus-archivist`.
  Kommandoen finnes for morgenens blikk over alt materialet, ikke for oppslag — og
  et oppslag vil oftest ha et annet vindu enn et døgn.
- **Vinduet varierer med hvor lenge det er siden sist.** Kjøres kommandoen daglig,
  er det et døgn; har det ligget en uke, er det en uke — se
  [`references/vindu.md`](../references/vindu.md). Døgn-gulvet er rullerende og
  ikke «siden midnatt», og de tre listene kjenner ingen kvittering: hva som er NYTT
  mellom to kjøringer er det bare `get_new_signals` som svarer på.
- **Tilkoblingen avgjør organisasjonen** — «ingenting» betyr «ingenting for DENNE
  organisasjonen», aldri «ingenting i Kasus».
- Er Kasus ikke tilkoblet, finnes ikke verktøyene, og alle fire kallene stopper.
  Kjør `/kasus:env`.
