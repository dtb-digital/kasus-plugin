---
description: Kom i gang — sveiper alle signaler og alle publiserte egne saker, slår sammen det som er samme sak, luker det som alt er dekket, og spør hva du vil gjøre. Utfører ingenting selv
argument-hint: [--hours 72] [--limit 20] [--all]
allowed-tools: ["Bash", "Agent", "Task", "AskUserQuestion"]
---

Legg fram et **bearbeidet** grunnlag, og kom i gang. Journalisten skal ikke få en
rå liste med sju signaler som han må konsolidere i hodet — han skal få
kandidatsakene: det som er samme sak slått sammen, og det som alt er dekket merket
som dekket.

Ett kall, én agent og **ett spørsmål** — ingen research, ingen fil på disk, **ingen
kvittering.** Arbeidet gjør ferdighetene: `dybdeartikkel` for en ny sak fra
radaren, `oppfolgersak` for en oppfølger på noe redaksjonen alt har publisert.

Det er hele delingen: her bearbeides grunnlaget valget tas på, og valget avgjør
hvilken ferdighet som tar over.

## 1. Hent statusen, og sett i gang forarbeidet

Gjør begge i **samme melding**, så de går parallelt. Agenten bruker et par
minutter på tre hundre elementer; kallet er ferdig på et sekund.

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs nytt $ARGUMENTS
```

…og i samme melding, `kasus-triage` med:

- **plugin-roten**, som absolutt sti: skriv ut den faktiske verdien av
  `${CLAUDE_PLUGIN_ROOT}` i prompten, ikke variabelnavnet
- **`--env <navn>`**, hvis det jobbes mot et annet miljø
- **at forkastede signaler skal med**, hvis brukeren ga `--all`

Agenten henter selv de to vinduene den trenger — hele signalvinduet og
`articles --kort --limit 200` — konsoliderer signalene til kandidatsaker, og gir
hver av dem en foreløpig dekningsdom. **Ikke hent de vinduene her.** Tre hundre
elementer i denne samtalen er hele poenget med at agenten finnes.

`nytt` måler mot **kvitteringen** — tidspunktet forrige saksløp ble gjort — og
undertrykker det som alt er sett, så den svarer på «hva er NYTT». Den skriver
ingenting. Med `--hours` sier den selv at vinduet er overstyrt, `--all` tar med
det som er forkastet.

**De to har hvert sitt vindu, og det er med vilje.** `nytt` svarer på hva som har
kommet inn siden sist; agenten sveiper hele vinduet uansett kvittering, fordi en
sak journalisten så og lot ligge i går fortsatt er en sak — og fordi et signal fra
i går og ett fra i dag kan være den samme saken. **`$ARGUMENTS` gjelder bare
`nytt`.** Et bredere signalvindu endrer hva som regnes som nytt, ikke hva som
ligger der.

Tre svar fra `nytt` krever noe annet enn å gå videre:

- **`MANGLER: …`** — oppsettet er ikke på plass. Si hva som mangler, foreslå
  `/kasus:env`, og stopp. Agenten vil melde det samme.
- **`nye: 0`** — ingenting nytt **siden sist**. Det er ikke det samme som at det
  ikke ligger noe der, og agenten svarer på det andre spørsmålet: vent på den før
  du konkluderer. Si når det sist ble kvittert og hva som ble holdt utenfor
  (`holdtUtenfor`).
- **`kvittering: null`** — første saksløp. Si at «nytt» da er siste 24 timer, og at
  en kvittering til slutt gjør «siden sist» presist neste gang.

## 2. Les statusen

Fra `nytt` er det fire linjer som ER statusen:

- **hvor gammel kvitteringen er** — «siden sist» betyr ingenting uten den
- **antall nye av antall hentet**, og hva som ble holdt utenfor og hvorfor
- **`fordeling`** — signaler per redaksjonelt mønster, flest først. Den ene linja
  som svarer på «hva skjer» uten at man leser sju signaler. En topp på «uten
  mønstertreff» er også en opplysning: radaren finner noe profilen ikke forklarer.
- **antall gamle saker** — publisert lenge før de ble oppdaget

`oppdaget` og `publisert` er to forskjellige tall. Et fritt temasøk hentes
uavhengig av publiseringstidspunkt, så et signal oppdaget i dag kan være en sak
fra 2023. Er det merket `GAMMEL SAK`, si det.

## 3. Legg agentens liste over statusen

Agenten gir deg kandidatsakene — konsoliderte, med dekningsdom. `nytt` gir deg
hvilke signal-id-er som er **nye siden sist**. Merk hver kandidat ved å slå id-ene
opp mot hverandre:

- **alle signalene nye** → saken er ny siden sist
- **noen nye, noen ikke** → si det: «to av tre signaler er nye». Det er ofte den
  mest interessante formen — en sak journalisten så i går har fått en kilde til.
- **ingen nye** → saken lå der forrige gang også. Den skal med, men lenger ned, og
  det skal sies. Et «har ligget her siden fredag» er en opplysning journalisten
  bruker.

Slå ikke sammen og del ikke opp agentens kandidater. Er du uenig i en
konsolidering, si det som en merknad — journalisten kan overprøve den, og
signal-id-ene står der for nettopp det.

## 4. Legg fram kort, og spør

Ikke agentens svar i sin helhet, og ikke en gjennomgang av hvert signal. Fire til
seks linjer, pluss lista:

- **én linje om bildet**: hva som har kommet inn siden sist, og hvor mange
  kandidatsaker det ble etter konsolidering. «Ni signaler siden fredag, fem saker
  — to av dem har vi alt dekket» er hele forarbeidet i én setning.
- **de tre-fire øverste kandidatene**, med antall signaler, kategori, dekningsdom
  og **klikkbar lenke** — brukeren skal kunne åpne kilden herfra. Mangler et signal
  lenke, si det. Er saken en `OPPFØLGING` eller et `FUNDAMENT`, skal **lenka til
  vår egen sak** stå der også, med id og dato: det er den som gjør oppfølgeren
  billig.
- **det som er dekket, i én linje hver** — merket, ikke skjult. Journalisten skal
  kunne se hva som ble luket bort og si at dommen var feil.
- **hva som ble lagt til side**, i én linje: forkastede signaler, og de agenten
  ikke fikk plass til.

**Forbeholdet står i svaret, ikke i en fotnote.** Dekningsdommen fra agenten er en
**grovsortering** på signalets tittel og sammendrag. Den rangerer og advarer; den
klarerer ingenting. Velges saken, leser `kasus-archivist` det samme vinduet på nytt
med hele signalet, inne i ferdigheten. Sier du noe annet her, blir et `ÅPEN` lest
som at saken er klarert — og det er den ikke.

**Rekkefølgen er ikke en prioritering.** Agenten sorterer på dekningsstatus, ikke
på redaksjonell verdi, fordi profilen ikke hentes her: den er premisset for å
prioritere og skrive, ikke for å velge hva man vil gjøre, og en inngang som hentet
den ville vært et halvt saksløp. Rangeringen mot `criteria.patterns` skjer i
ferdigheten, som henter profilen selv. Si det i én linje framfor å la lista se ut
som en topplista den ikke er.

Avslutt med **ett spørsmål** — `AskUserQuestion`, ikke en oppfordring i prosa som
blir liggende ubesvart. Alternativene avhenger av hva som faktisk sto på skjermen:

| Statusen viste | Alternativene |
|---|---|
| **åpne kandidatsaker** | ta en sak fra lista · følg opp en av våre egne saker · spør om noe i signalene · ikke nå |
| **bare oppfølginger og fundament** | følg opp en av våre egne saker · ta en sak fra lista likevel · bredere vindu (`--hours 72`) · ikke nå |
| **alt dekket, eller `nye: 0` og ingen kandidater** | bredere vindu (`--hours 72`) · ta med det forkastede (`--all`) · følg opp en av våre egne saker · ikke nå |

Maks fire. Er ett av dem åpenbart best — en kandidat med tre signaler og en egen
sak å bygge på — legg det først og si hvorfor.

**Spørsmålet gjelder hva som skal GJØRES, ikke hvilken sak som skal skrives.**
Valget av sak hører i ferdigheten, der et valg fører til research, en fil på disk
og en kvittering. Her velges bare inngangen:

| Svaret | Hvem tar over |
|---|---|
| en ny sak fra radaren | ferdigheten **`dybdeartikkel`** |
| en oppfølger på en egen sak | ferdigheten **`oppfolgersak`** |
| et spørsmål om signalene | agenten **`kasus-lookout`** |
| ikke nå | ingen. Si ingenting mer — ingen kvittering, ingenting er «brukt opp», og signalene ligger der neste gang. |

Ferdigheten kjører **sitt eget steg 1**. Ikke prøv å gi den dataene dine i stedet:
den trenger profilen i tillegg, og `nytt` skriver ingenting, så det koster ett
kall å hente det to ganger — mot to ulike start-tilstander å virke i.

Men **forarbeidet er ikke bortkastet**: konsolideringen og dekningsdommene står i
samtalen, og ferdigheten skal bruke dem framfor å utlede noe annet av det samme
materialet. Det står i ferdighetens steg 2 og 4a.

**Ikke begynn arbeidet her**, uansett hvor tydelig svaret er.

## Merk

- **Du trenger ikke denne kommandoen for å spørre.** «Er det noe om strømpriser?»,
  «hvor mange signaler er det på mønsteret X?», «hvor mye av det er gamle saker?»
  går rett til `kasus-lookout`, som bygger filtrene selv og oppgir hvor mange som
  passerte av hvor mange hentede. Kommandoen finnes for morgenens blikk, ikke for
  oppslag — og den koster et par minutter fordi den leser tre hundre elementer for
  deg. Et oppslag skal ikke betale for det.
- **`--hours` måler oppdaget, ikke sakens alder.** Et fritt temasøk kan levere en
  sak fra 2023 som ble oppdaget i dag. Skal alderen filtreres, er det `--publisert`
  — og det er et spørsmål til `kasus-lookout`.
- Header-linja sier hvilken installasjon og nøkkel-variabel som ble brukt.
  **Nøkkelen avgjør organisasjonen** — «ingen signaler» betyr «ingen for DENNE
  organisasjonen», aldri «ingen i Kasus».
- Mangler `KASUS_API_KEY`, stopper kallet med `MANGLER: …`. Kjør `/kasus:env`.
