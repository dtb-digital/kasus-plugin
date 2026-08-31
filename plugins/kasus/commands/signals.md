---
description: Status — hva har skjedd siden sist? Lesende blikk i radarsignalene, uten å starte en runde
argument-hint: [--hours 72] [--pattern «navn»] [--origin own_followup] [--status new] [--type market_signal] [--limit 20]
allowed-tools: ["Bash"]
---

Gi en **status** på radarsignalene. Dette er blikket man tar før man bestemmer seg
for om det er verdt å sette av tid: hva har kommet inn, hvordan fordeler det seg,
er noe av det gammelt — og er det noe her i det hele tatt.

**Denne kommandoen kvitterer ALDRI.** Den flytter ikke «siden sist», den merker
ingenting som sett, og den skriver ingen filer. Det er hele poenget: du skal kunne
se hva som ligger der uten at det får konsekvenser, og uten å forplikte deg til å
gjøre noe med det. Arbeidet skjer i `/kasus:start`.

## Hvilket kall

Det avhenger av hva brukeren spurte om, og forskjellen er ikke kosmetisk:

**Ingen argumenter, eller bare `--hours`/`--limit`/`--all`** → status siden sist:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs nytt $ARGUMENTS
```

Denne måler mot kvitteringen og undertrykker det som alt er sett, så den svarer på
«hva er NYTT». Med `--hours` sier den selv at vinduet er overstyrt.

**Med `--pattern`, `--origin`, `--status` eller `--type`** → oppslag:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs signals $ARGUMENTS
```

`--all` finnes ikke her — den hører til statusformen. Blandes de to (`--all
--pattern X`), stopper verktøyet med «Ukjent flagg» framfor å tolke det; velg
hvilken av de to du vil ha.

Denne **ignorerer kvitteringen fullstendig** og lister alt som passer filteret,
sett eller ikke. Si det når du bruker den — en filtrert liste ser ut som «siden
sist» hvis ingen sier noe annet, og da er det umulig å vite om de sju treffene er
nye eller noe man så i går.

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

- **`--origin` og `--pattern` filtreres lokalt** — API-et støtter dem ikke.
  `signals` oppgir både hvor mange som ble hentet og hvor mange som passerte, så et
  lokalt filter ikke forveksles med et tomt datasett.
- Header-linja sier hvilken installasjon og nøkkel-variabel som ble brukt.
  **Nøkkelen avgjør organisasjonen** — «ingen signaler» betyr «ingen for DENNE
  organisasjonen», aldri «ingen i Kasus».
- Mangler `KASUS_API_KEY`, stopper kallet med `MANGLER: …`. Kjør `/kasus:env`.
