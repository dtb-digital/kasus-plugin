---
description: Status — hva har skjedd siden sist? Lesende blikk i radarsignalene, uten å starte en runde
argument-hint: [--hours 72] [--kategori temasok] [--gamle|--ferske] [--publisert 48] [--uten-monster] [--pattern «navn»] [--status new] [--limit 20] | [et spørsmål]
allowed-tools: ["Bash", "Agent", "Task"]
---

Gi en **status** på radarsignalene, eller svar på et **spørsmål** om dem. Dette er
blikket man tar før man bestemmer seg for om det er verdt å sette av tid: hva har
kommet inn, hvordan fordeler det seg, er noe av det gammelt — og er det noe her i
det hele tatt.

**Denne kommandoen kvitterer ALDRI.** Den flytter ikke «siden sist», den merker
ingenting som sett, og den skriver ingen filer. Det er hele poenget: du skal kunne
se hva som ligger der uten at det får konsekvenser, og uten å forplikte deg til å
gjøre noe med det. Arbeidet skjer i `/kasus:start`.

## Hvilken av de tre

Det avhenger av hva brukeren spurte om, og forskjellen er ikke kosmetisk.

### A. Ingen argumenter, eller bare flagg → status, her

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs nytt $ARGUMENTS
```

Gjelder tom input og `--hours`/`--limit`/`--all`. Denne måler mot kvitteringen og
undertrykker det som alt er sett, så den svarer på «hva er NYTT». Med `--hours`
sier den selv at vinduet er overstyrt.

**Med et filterflagg** — `--status`, `--type`, `--kategori`, `--origin`,
`--pattern`, `--uten-monster`, `--uten-lenke`, `--gamle`, `--ferske`,
`--publisert` — er det et oppslag
framfor en status:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs signals $ARGUMENTS
```

`--all` finnes ikke her — den hører til statusformen. Blandes de to (`--all
--pattern X`), stopper verktøyet med «Ukjent flagg» framfor å tolke det.

Oppslaget **ignorerer kvitteringen fullstendig** og lister alt som passer
filteret, sett eller ikke. Si det når du bruker den — en filtrert liste ser ut som
«siden sist» hvis ingen sier noe annet, og da er det umulig å vite om de sju
treffene er nye eller noe man så i går.

**Gjør begge disse selv, her i samtalen.** Outputen er alt lagd for å leses, og
lenkene skal være klikkbare for brukeren — en agent som oppsummerer den ville
gjort dem om til prosa.

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

## Oppsummer kort, og pek videre

Tre til fem linjer, ikke en gjennomgang av hvert signal:

- hva som har kommet inn siden sist, fordelt på mønster og kategori
- **det ene eller to som ser mest ut som en sak**, med kategori og
  **klikkbar lenke** — brukeren skal kunne åpne kilden herfra. Mangler et signal
  lenke (`LENKE: (ingen …)`), si det.
- hva som ser ut som støy, i én linje

Er lista tom, si når det sist ble kvittert og hva som ble holdt utenfor. «Ingen nye
signaler» er et fullgodt svar — ikke utvid vinduet på eget initiativ for å ha noe å
vise, men nevn at `--hours 72` finnes.

Er det noe her, avslutt med at `/kasus:start` er der man velger sak og jobber
videre — research, sjekk mot egne artikler og saksforslag. Ikke begynn på det
arbeidet her.

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
