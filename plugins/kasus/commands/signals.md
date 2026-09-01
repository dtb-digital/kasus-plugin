---
description: Status — hva har skjedd siden sist? Nye radarsignaler og ukas egen produksjon, og et spørsmål om hva du vil gjøre videre. Starter ingenting selv
argument-hint: [--hours 72] [--kategori temasok] [--gamle|--ferske] [--publisert 48] [--uten-monster] [--pattern «navn»] [--status new] [--limit 20] | [et spørsmål]
allowed-tools: ["Bash", "Agent", "Task", "AskUserQuestion"]
---

Gi en **status** på radarsignalene, eller svar på et **spørsmål** om dem. Dette er
blikket man tar før man bestemmer seg for om det er verdt å sette av tid: hva har
kommet inn, hvordan fordeler det seg, er noe av det gammelt — og er det noe her i
det hele tatt.

Statusen henter **to** ting: de nye signalene, og **ukas egen produksjon**. Det
andre er der fordi et signal ikke betyr det samme for en redaksjon som publiserte
fire saker om temaet siden mandag som for en som ikke har rørt det — og radaren
kjenner ingen av de koblingene. Den avsluttes med **ett spørsmål om hva du vil
gjøre videre**, og svaret er det eneste som kan sette noe i gang.

**Denne kommandoen kvitterer ALDRI.** Den flytter ikke «siden sist», den merker
ingenting som sett, og den skriver ingen filer. Det er hele poenget: du skal kunne
se hva som ligger der uten at det får konsekvenser, og uten å forplikte deg til å
gjøre noe med det. Arbeidet skjer i runden — ferdigheten `dybdeartikkel`.

## Hvilken av de tre

Det avhenger av hva brukeren spurte om, og forskjellen er ikke kosmetisk.

### A. Ingen argumenter, eller bare flagg → status, her

Kjør **begge i samme melding**, så de går parallelt:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs nytt $ARGUMENTS
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs articles --kort --hours 168 --limit 40 --json
```

Gjelder tom input og `--hours`/`--limit`/`--all`. `nytt` måler mot kvitteringen og
undertrykker det som alt er sett, så den svarer på «hva er NYTT». Med `--hours`
sier den selv at vinduet er overstyrt.

**Artikkelvinduet følger ikke `$ARGUMENTS`.** Det er alltid siste sju døgn: et
bredere signalvindu endrer hva radaren har funnet, ikke hva redaksjonen holder på
med nå. `--json` fordi dette vinduet skal **brukes**, ikke vises — 40 artikler lagt
fram i sin helhet er 300 linjer støy i et blikk som skal ta et halvt minutt. Er
`taketNådd` sann, publiserte redaksjonen mer enn 40 saker på uka: si det, og
behandle vinduet som «de 40 siste» framfor «uka».

**Med et filterflagg** — `--status`, `--type`, `--kategori`, `--origin`,
`--pattern`, `--uten-monster`, `--uten-lenke`, `--gamle`, `--ferske`,
`--publisert` — er det et oppslag
framfor en status:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs signals $ARGUMENTS
```

`--all` finnes ikke her — den hører til statusformen. Blandes de to (`--all
--pattern X`), stopper verktøyet med «Ukjent flagg» framfor å tolke det.
**Artikkelvinduet hører heller ikke til her:** et oppslag på `--pattern X` er et
spørsmål med et svar, ikke morgenens blikk, og ukas produksjon ville vært et
vedlegg ingen ba om.

Oppslaget **ignorerer kvitteringen fullstendig** og lister alt som passer
filteret, sett eller ikke. Si det når du bruker den — en filtrert liste ser ut som
«siden sist» hvis ingen sier noe annet, og da er det umulig å vite om de sju
treffene er nye eller noe man så i går.

**Begge formene kjører du selv, her i samtalen.** Outputen er alt lagd for å
leses, og lenkene skal være klikkbare for brukeren — en agent som oppsummerer den
ville gjort dem om til prosa.

### B. Et spørsmål → `kasus-lookout`

Er argumentet et spørsmål framfor flagg — «er det noe om strømpriser?», «hva har
kommet inn denne uka?», «hvor mange oppfølginger av egne saker ligger der?» —
send ut **én `kasus-lookout`** med spørsmålet ordrett.

Grunnen er den samme som på artikkelsiden: `/api/v1/signals` har ingen tekstsøk og
ingen `q`, så et tema er ikke et filter. Det må leses. Agenten henter selv opptil
hundre signaler og leser dem, uten at de fyller denne samtalen.

Gi den:

- **spørsmålet**, ordrett
- **plugin-roten**, som absolutt sti: `${CLAUDE_PLUGIN_ROOT}` — skriv ut den
  faktiske verdien i prompten, ikke variabelnavnet
- **`--env <navn>`** hvis det jobbes mot et annet miljø

Agenten kvitterer aldri, og svarer med klikkbar lenke, id, kategori og begge
datoer per signal. **Relayér lenkene videre** — de er poenget, og de forsvinner
hvis du bare oppsummerer.

Brukeren treffer ofte agenten direkte, uten denne kommandoen: «er det noe nytt å
skrive om?» går rett til `kasus-lookout`. Det er meningen. Kommandoen finnes for
den som vil ha statusen, eller vil styre filtrene selv.

## Les statusen

Fra `nytt` er det fire linjer som ER statusen:

- **hvor gammel kvitteringen er** — «siden sist» betyr ingenting uten den
- **antall nye av antall hentet**, og hva som ble holdt utenfor og hvorfor
- **`fordeling`** — signaler per redaksjonelt mønster, flest først. Dette er den
  ene linja som svarer på «hva skjer» uten at man leser sju signaler. Mønsteret er
  samme streng som i profilen, så en topp forteller hvilket av redaksjonens egne
  mønstre som er i bevegelse — og en topp på «uten mønstertreff» er også en
  opplysning: radaren finner noe profilen ikke forklarer.
- **antall gamle saker** — publisert lenge før de ble oppdaget

Signalene er gruppert på de fire kategoriene, med forklaringen ved hver gruppe:
oppfølging av EGEN sak, oppfølging av KONKURRENTSAK, konkurrentsak direkte, fritt
temasøk. Ikke slå dem sammen i oppsummeringen din — de krever ulike tiltak.

`oppdaget` og `publisert` er to forskjellige tall. Et fritt temasøk hentes
uavhengig av publiseringstidspunkt, så et signal oppdaget i dag kan være en sak fra
2023. Er det merket `GAMMEL SAK`, si det.

## Hold signalene mot ukas egen produksjon

Artikkelvinduet er ikke en liste du legger fram. Det finnes for **tre koblinger**,
og radaren kjenner ingen av dem:

- **En oppfølging radaren ikke visste var en oppfølging.** Et fritt temasøk har
  `origin: null` og ser ut som støy — men handler det om noe redaksjonen publiserte
  i går, er det i praksis en oppfølging av egen sak, og ofte den billigste gode
  saken på lista.
- **Et tema redaksjonen står i nå.** «Fire saker om dette siden mandag» er et tall,
  ikke en tolkning. Om det er en grunn til å ta signalet eller la det ligge, avgjør
  journalisten.
- **En åpenbar dublett**, fanget her framfor etter at en agent har lest to hundre
  artikler.

Match semantisk, mot tittel, stikktittel og emneknagger: «prisfall i Bodø» og
«nedgang i kvadratmeterprisen i Nordland» er samme sak og har ikke ett ord til
felles. Er det ingen kobling, sier du ingenting om artiklene — et vindu uten treff
er ikke verdt en linje.

**Dette erstatter ikke dekningssjekken.** Sju døgn og 40 saker svarer på «hva
holder vi på med», aldri på «har vi skrevet om dette før?». Det spørsmålet leses
mot 200 artikler av `kasus-archivist`, i runden. Sier du noe annet her, blir en
manglende kobling lest som en klarering.

## Oppsummer kort, og spør hva videre

Dette gjelder **statusen**. Et oppslag med filterflagg slutter med svaret sitt og
forbeholdet om hva filteret var — det er et spørsmål som er besvart, og et menyvalg
etterpå er påtrengende.

Tre til fem linjer, ikke en gjennomgang av hvert signal:

- hva som har kommet inn siden sist, fordelt på mønster og kategori
- **det ene eller to som ser mest ut som en sak**, med kategori og
  **klikkbar lenke** — brukeren skal kunne åpne kilden herfra. Mangler et signal
  lenke (`LENKE: (ingen …)`), si det.
- **koblingen til ukas produksjon**, hvis det finnes en. Med artikkel-id og dato,
  så den kan overprøves.
- hva som ser ut som støy, i én linje

Er lista tom, si når det sist ble kvittert og hva som ble holdt utenfor. «Ingen nye
signaler» er et fullgodt svar — ikke utvid vinduet på eget initiativ for å ha noe å
vise.

Avslutt med **ett spørsmål** — `AskUserQuestion`, ikke en oppfordring i prosa som
blir liggende ubesvart. Alternativene avhenger av hva statusen faktisk viste:

| Statusen viste | Alternativene |
|---|---|
| **nye signaler** | kjør runden på en av disse · følg opp en av våre egne saker · spør om noe i signalene · ikke nå |
| **`nye: 0`** | bredere vindu (`--hours 72`) · ta med det forkastede (`--all`) · følg opp en av våre egne saker · ikke nå |

Tilpass dem til det som står på skjermen, og hold deg til fire. Er ett av
alternativene åpenbart best — et signal som er en oppfølging av gårsdagens sak —
legg det først og si hvorfor.

**Spørsmålet gjelder hva som skal GJØRES, ikke hvilken sak som skal skrives.**
Valget av sak hører i runden, der et valg fører til research, en fil på disk og en
kvittering. Her er svaret bare hvilken inngang journalisten vil inn i:

- **runden** → ferdigheten `dybdeartikkel`. Den kjører sitt eget steg 1 på nytt —
  den trenger profilen i tillegg, og `nytt` skriver ingenting, så det koster
  ingenting å hente det to ganger. Ikke prøv å gi den dataene dine i stedet.
- **oppfølger** → ferdigheten `oppfolgersak`
- **et spørsmål** → `kasus-lookout`
- **ikke nå** → si ingenting mer. Ingen kvittering, ingenting er «brukt opp», og
  signalene ligger der neste gang.

**Ikke begynn arbeidet her**, uansett hvor tydelig svaret er.

## Merk

- **Bare `--status`, `--type` og `--hours` går til serveren.** Resten filtrerer
  det som alt er hentet, fordi API-et ikke støtter dem. `signals` oppgir hvor mange
  som ble hentet, hvor mange som passerte, og hvilke filtre som var i bruk — så et
  lokalt filter ikke forveksles med et tomt datasett. Er svaret smalt, hev
  `--limit` framfor å konkludere.
- **`--hours` måler oppdaget, `--publisert` måler sakens alder.** Et fritt temasøk
  kan levere en sak fra 2023 som ble oppdaget i dag, så «er det noe nytt?» er
  oftest `--publisert 48` og ikke `--hours 48`. Si hvilken du målte.
- **Et signal uten publiseringsdato faller ut av datofiltrene**, og antallet står i
  `meta.utenPubliseringsdato`. De er ukjente, ikke gamle.
- Header-linja sier hvilken installasjon og nøkkel-variabel som ble brukt.
  **Nøkkelen avgjør organisasjonen** — «ingen signaler» betyr «ingen for DENNE
  organisasjonen», aldri «ingen i Kasus».
- Mangler `KASUS_API_KEY`, stopper kallet med `MANGLER: …`. Kjør `/kasus:env`.
