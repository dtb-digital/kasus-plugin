---
description: Kom i gang — henter siste døgn av alt (radarsignaler, Kasus' egne story-briefs og redaksjonens egne artikler, pluss «nytt siden sist»), eller helt tilbake til forrige kvittering om det er lenger siden, legger det fram slik det er, og spør hva du vil gjøre: en oppfølger, en dybdeartikkel eller et spørsmål. `--hours N` overstyrer alle fire. Bearbeider ingenting, utfører ingenting
argument-hint: [--hours 72] [--all]
allowed-tools: ["Bash", "Agent", "Task", "AskUserQuestion"]
---

Legg fram **materialet slik det ligger**, og kom i gang. Fire kall og **ett
spørsmål** — ingen agent, ingen research, ingen fil på disk, **ingen kvittering.**

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
den er det bare `nytt` som kjenner.

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs nytt $ARGUMENTS --json
```

Regn ut vinduet `V` etter **vindusregelen** — den står i
[`references/vindu.md`](../references/vindu.md), og skal leses derfra framfor å
gjengis her: `V = brukerens --hours N` hvis oppgitt, ellers
`max(24, meta.vindu.hours)`. Døgnet er et **gulv**, ikke et tak.

Hent så de tre listene i **samme melding**, alle med `--hours V`:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs signals --kort --hours V --limit 100
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs story-briefs --hours V --limit 40
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs articles --kort --hours V --limit 60
```

Jobbes det mot et annet miljø, skal `--env <navn>` med på **alle fire**.

| Kall | Vindu | Tak |
|---|---|---|
| `nytt` | mot kvitteringen (24 t om den mangler) | `--limit`, default 40 |
| `signals --kort` | `V` | maks 100 |
| `story-briefs` | `V` | maks 40 |
| `articles --kort` | `V` | maks 60 |

**Perioden skal stå i svaret**, og den skal være den faktiske: «siste døgn» når
`V` er 24, «siste fem døgn — siden du kvitterte tirsdag» når kvitteringen hevet
den. En periode som ikke sies, leses som «alt».

Takene er satt over normalt døgnvolum. Vokser `V`, binder de oftere: en radar som
leverer seksti signaler i døgnet fyller `--limit 100` på under to døgn. Er
`taketNådd` sann, mangler svaret data — **si det, og hev `--limit`** framfor å
krympe vinduet. Det er nettopp de gamle usette signalene gulvet skulle fange.

Tre svar fra `nytt` krever noe annet enn å gå videre:

- **`MANGLER: …`** — oppsettet er ikke på plass. Da feiler alle fire likt. Si hva
  som mangler, foreslå `/kasus:env`, og stopp.
- **`nye: 0`** — ingenting nytt **siden sist**. Det er ikke det samme som at det
  ikke ligger noe der: de tre listene svarer på det andre spørsmålet, og de kan
  være fulle. Si når det sist ble kvittert, og gå videre.
- **`kvittering: null`** — første gang. Si at «nytt» da er siste 24 timer, og at en
  kvittering til slutt gjør «siden sist» presist neste gang.

## 2. Fire svar som måler fire forskjellige ting

Dette er den ene fella i kommandoen, og den er lett å gå i: **`--hours` betyr ikke
det samme i de tre listene.**

| Kall | `hours` måles mot | Et tomt svar betyr |
|---|---|---|
| `signals` | `detectedAt` — når radaren **fant** signalet | radaren har ikke funnet noe det siste døgnet |
| `story-briefs` | `createdAt` — når **Kasus laget** briefen | pipelinen har ikke laget noe det siste døgnet |
| `articles` | `published` — når **redaksjonen publiserte** | redaksjonen har ikke publisert det siste døgnet |

**Er `V` et døgn, er tomt vanlig.** En redaksjon som ikke publiserte i går har
ikke sluttet å publisere, og pipelinen kjører i puljer — så et tomt felt er et
fravær i perioden, aldri et fravær i Kasus. Er to av tre tomme, er tiltaket å
tilby et bredere vindu (`--hours 168`) framfor å konkludere med at det ikke er noe
å jobbe med.

Og innad i signalene er `oppdaget` og `publisert` to forskjellige tall: et fritt
temasøk hentes uavhengig av publiseringstidspunkt, så et signal oppdaget i dag kan
være en sak fra 2023. Er det merket `GAMMEL SAK`, si det.

Fra `nytt` er det tre linjer som ER statusen: **hvor gammel kvitteringen er**,
**antall nye av antall hentet** (og hva som ble holdt utenfor), og **`fordeling`** —
signaler per redaksjonelt mønster, flest først. Den ene linja som svarer på «hva
skjer» uten at man leser sju signaler. En topp på «uten mønstertreff» er også en
opplysning: radaren finner noe profilen ikke forklarer.

Signal-id-ene fra `nytt` brukes til én ting: å **merke** hvilke av signalene i den
rå lista som er nye siden sist. Et signal som lå der forrige gang også er fortsatt
en sak — det skal med, men det skal sies.

Alle id-ene fra `nytt` **skal** finnes i signal-lista, fordi vinduet er minst så
bredt som «siden sist» (vindusregelen). Finner du likevel en id som ikke er der,
er taket nådd på lista — ikke en feil i merkingen. Si det framfor å utelate
signalet i stillhet.

## 3. Legg fram kort, i tre bolker

Ikke tre lister i sin helhet. To hundre elementer i sin helhet er ikke et blikk,
det er en utskrift. **Fire til åtte linjer per bolk**, og bolkene i denne
rekkefølgen — nærmest redaksjonens eget arbeid først:

1. **EGNE FERSKE SAKER (oppfølger-materialet).** Alle, om det er få — er `V` et
   døgn, er det gjerne en håndfull. Dato, seksjon og **klikkbar url**. Dette er det
   billigste utgangspunktet som finnes: vinklingen er alt gjort, og det som mangler
   er det nye. Én linje om bildet: «sju saker i går, tyngst på samferdsel».
2. **RADARSIGNALER (dybde-materialet).** De tre-fem øverste, hver med kategori
   (`egen_oppfolging`, `konkurrent_oppfolging`, `konkurrentsak`, `temasok`), **begge
   datoer**, mønster og **klikkbar lenke**. Mangler et signal lenke, si det — da er
   det ingenting å lese seg opp på, og det er i seg selv en grunn til å prioritere
   det ned. Merk hvilke som er nye siden sist.
3. **KASUS' EGNE STORY-BRIEFS.** De tre-fem nyeste, med status (`kandidat`,
   `forslag`, …), opphav og tittel. Si hva de ER: pipelinens forslag inne i Kasus,
   ikke saksforslagene pluginen skriver på disk, og **ikke etterprøvd av noen** —
   `plot`, `angle` og `reason` er skrevet av en modell.

Pluss én linje om **totalene**, med perioden på: «Siste døgn: 58 signaler, tre
briefs, sju egne saker» er grunnlaget i én setning. Perioden i den linja er `V`,
og skal være det faktiske tallet — «siste døgn» bare når det er et døgn.

**Tre forbehold hører i svaret, ikke i en fotnote:**

- **Ingenting er konsolidert.** Er tre av signalene den samme SSB-saken, står de
  som tre. Ser du det, si det som en merknad — men ikke slå dem sammen selv, og
  ikke la lista se bearbeidet ut.
- **Ingenting er sjekket mot egen dekning.** Kommandoen feller ingen dekningsdom.
  Artiklene i vinduet er «hva vi publiserte nå», ikke «har vi skrevet om dette
  før?» — og `V` er *langt* fra nok til det siste, som leses mot 200 artikler av
  `kasus-archivist` inne i ferdigheten. Sier du noe annet, blir et fravær lest som
  en klarering.
- **Rekkefølgen er ikke en prioritering.** Profilen hentes ikke her — den er
  premisset for å prioritere og skrive, ikke for å velge hva man vil gjøre.
  Rangeringen mot `criteria.patterns` er ferdighetens første egne arbeid. Si det i
  én linje framfor å la lista se ut som en topplista den ikke er.

## 4. Ett spørsmål

Avslutt med **ett** — `AskUserQuestion`, ikke en oppfordring i prosa som blir
liggende ubesvart. Alternativene bygges på hva som faktisk sto på skjermen:

| Materialet viste | Alternativene (maks fire) |
|---|---|
| **både egne saker og signaler** | følg opp en av våre egne saker · dybdeartikkel fra et signal · spør om noe i materialet · ikke nå |
| **egne saker, men tørr radar** | følg opp en av våre egne saker · bredere vindu (`--hours 72`) · spør om noe i materialet · ikke nå |
| **signaler og briefs, ingen ferske egne saker** | dybdeartikkel fra et signal · spør om noe i materialet · bredere vindu (`--hours 72`) · ikke nå |
| **alt tomt** | bredere vindu (`--hours 72`) · ta med det forkastede (`--all`) · sjekk oppsettet (`/kasus:env`) · ikke nå |

Er ett av dem åpenbart best — en egen sak fra i går som radaren alt har levert nye
kilder på (`egen_oppfolging`) — legg det først og si hvorfor. Det er den billigste
gode saken som finnes.

**Spørsmålet gjelder hva som skal GJØRES, ikke hvilken sak som skal skrives.**
Valget av sak hører i ferdigheten, der et valg fører til research, en fil på disk
og en kvittering. Her velges bare inngangen:

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
  mellom to kjøringer er det bare `nytt` som svarer på.
- Header-linja sier hvilken installasjon og nøkkel-variabel som ble brukt.
  **Nøkkelen avgjør organisasjonen** — «ingenting» betyr «ingenting for DENNE
  organisasjonen», aldri «ingenting i Kasus».
- Mangler `KASUS_API_KEY`, stopper alle fire kallene med `MANGLER: …`. Kjør
  `/kasus:env`.
