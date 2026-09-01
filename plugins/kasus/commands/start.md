---
description: Kom i gang — henter nye radarsignaler og ukas egen produksjon, sier hva som henger sammen, og spør hva du vil gjøre. Utfører ingenting selv
argument-hint: [--hours 72] [--limit 20] [--all]
allowed-tools: ["Bash", "Agent", "Task", "AskUserQuestion"]
---

Hent dataene journalisten trenger for å bestemme seg, og kom i gang. To kall og
**ett spørsmål** — ingen research, ingen fil på disk, **ingen kvittering.**
Arbeidet gjør ferdighetene: `dybdeartikkel` for en ny sak fra radaren,
`oppfolgersak` for en oppfølger på noe redaksjonen alt har publisert.

Det er hele delingen: her hentes det som trengs for å velge, og valget avgjør
hvilken ferdighet som tar over.

## 1. Hent begge vinduene

Kjør dem i **samme melding**, så de går parallelt:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs nytt $ARGUMENTS
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs articles --kort --hours 168 --limit 40 --json
```

`nytt` måler mot **kvitteringen** — tidspunktet forrige saksløp ble gjort — og
undertrykker det som alt er sett, så den svarer på «hva er NYTT». Den skriver
ingenting. Med `--hours` sier den selv at vinduet er overstyrt, `--all` tar med
det som er forkastet.

**Artikkelvinduet følger ikke `$ARGUMENTS`.** Det er alltid siste sju døgn: et
bredere signalvindu endrer hva radaren har funnet, ikke hva redaksjonen holder på
med nå. `--json` fordi vinduet skal **brukes**, ikke vises — 40 artikler lagt fram
i sin helhet er tre hundre linjer støy i et blikk som skal ta et halvt minutt. Er
`taketNådd` sann, publiserte redaksjonen mer enn 40 saker på uka: si det, og
behandle vinduet som «de 40 siste» framfor «uka».

**Profilen hentes ikke her.** Den er premisset for å prioritere og skrive, ikke
for å velge hva man vil gjøre — og ferdigheten henter den selv sammen med resten
av sitt eget steg 1. Å hente den her ville gjort dette til et halvt saksløp.

Tre svar krever noe annet enn å gå videre:

- **`MANGLER: …`** — oppsettet er ikke på plass. Si hva som mangler, foreslå
  `/kasus:env`, og stopp.
- **`nye: 0`** — ingenting nytt. Si når det sist ble kvittert og hva som ble holdt
  utenfor (`holdtUtenfor`). Ikke utvid vinduet på eget initiativ for å ha noe å
  vise — det er et av alternativene i steg 4.
- **`kvittering: null`** — første saksløp. Si at vinduet er siste 24 timer, og at
  en kvittering til slutt gjør «siden sist» presist neste gang.

## 2. Les statusen

Fra `nytt` er det fire linjer som ER statusen:

- **hvor gammel kvitteringen er** — «siden sist» betyr ingenting uten den
- **antall nye av antall hentet**, og hva som ble holdt utenfor og hvorfor
- **`fordeling`** — signaler per redaksjonelt mønster, flest først. Den ene linja
  som svarer på «hva skjer» uten at man leser sju signaler. En topp på «uten
  mønstertreff» er også en opplysning: radaren finner noe profilen ikke forklarer.
- **antall gamle saker** — publisert lenge før de ble oppdaget

Signalene er gruppert på de fire kategoriene, med forklaringen ved hver gruppe:
oppfølging av EGEN sak, oppfølging av KONKURRENTSAK, konkurrentsak direkte, fritt
temasøk. Ikke slå dem sammen — de krever ulike tiltak.

`oppdaget` og `publisert` er to forskjellige tall. Et fritt temasøk hentes
uavhengig av publiseringstidspunkt, så et signal oppdaget i dag kan være en sak
fra 2023. Er det merket `GAMMEL SAK`, si det.

## 3. Hold signalene mot ukas egen produksjon

Artikkelvinduet er ikke en liste du legger fram. Det finnes for **tre koblinger**,
og radaren kjenner ingen av dem:

- **En oppfølging radaren ikke visste var en oppfølging.** Et fritt temasøk har
  `origin: null` og ser ut som støy — men handler det om noe redaksjonen
  publiserte i går, er det i praksis en oppfølging av egen sak, og ofte den
  billigste gode saken på lista.
- **Et tema redaksjonen står i nå.** «Fire saker om dette siden mandag» er et
  tall, ikke en tolkning. Om det er en grunn til å ta signalet eller la det ligge,
  avgjør journalisten.
- **En åpenbar dublett**, fanget her framfor etter at en agent har lest to hundre
  artikler.

Match semantisk, mot tittel, stikktittel og emneknagger: «prisfall i Bodø» og
«nedgang i kvadratmeterprisen i Nordland» er samme sak og har ikke ett ord til
felles. Er det ingen kobling, sier du ingenting om artiklene — et vindu uten treff
er ikke verdt en linje.

**Dette erstatter ikke dekningssjekken.** Sju døgn og 40 saker svarer på «hva
holder vi på med», aldri på «har vi skrevet om dette før?». Det spørsmålet leses
mot 200 artikler av `kasus-archivist`, inne i ferdigheten. Sier du noe annet her,
blir en manglende kobling lest som en klarering.

## 4. Legg fram kort, og spør

Tre til fem linjer, ikke en gjennomgang av hvert signal:

- hva som har kommet inn siden sist, fordelt på mønster og kategori
- **det ene eller to som ser mest ut som en sak**, med kategori og **klikkbar
  lenke** — brukeren skal kunne åpne kilden herfra. Mangler et signal lenke
  (`LENKE: (ingen …)`), si det.
- **koblingen til ukas produksjon**, hvis det finnes en. Med artikkel-id og dato,
  så den kan overprøves.
- hva som ser ut som støy, i én linje

Avslutt med **ett spørsmål** — `AskUserQuestion`, ikke en oppfordring i prosa som
blir liggende ubesvart. Alternativene avhenger av hva som faktisk sto på skjermen:

| Statusen viste | Alternativene |
|---|---|
| **nye signaler** | ta en sak fra radaren · følg opp en av våre egne saker · spør om noe i signalene · ikke nå |
| **`nye: 0`** | bredere vindu (`--hours 72`) · ta med det forkastede (`--all`) · følg opp en av våre egne saker · ikke nå |

Maks fire. Er ett av dem åpenbart best — et signal som er en oppfølging av
gårsdagens sak — legg det først og si hvorfor.

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

**Ikke begynn arbeidet her**, uansett hvor tydelig svaret er.

## Merk

- **Du trenger ikke denne kommandoen for å spørre.** «Er det noe om strømpriser?»,
  «hvor mange signaler er det på mønsteret X?», «hvor mye av det er gamle saker?»
  går rett til `kasus-lookout`, som bygger filtrene selv og oppgir hvor mange som
  passerte av hvor mange hentede. Kommandoen finnes for morgenens blikk, ikke for
  oppslag.
- **`--hours` måler oppdaget, ikke sakens alder.** Et fritt temasøk kan levere en
  sak fra 2023 som ble oppdaget i dag. Skal alderen filtreres, er det `--publisert`
  — og det er et spørsmål til `kasus-lookout`.
- Header-linja sier hvilken installasjon og nøkkel-variabel som ble brukt.
  **Nøkkelen avgjør organisasjonen** — «ingen signaler» betyr «ingen for DENNE
  organisasjonen», aldri «ingen i Kasus».
- Mangler `KASUS_API_KEY`, stopper kallet med `MANGLER: …`. Kjør `/kasus:env`.
