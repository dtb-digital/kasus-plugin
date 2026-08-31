---
description: Vaktrunden — nye radarsignaler, du velger sak, sjekk mot egne artikler, bredt søk, og et saksforslag på disk
argument-hint: [--hours 24] [--limit 40] [--all]
allowed-tools: ["Bash", "AskUserQuestion", "Agent", "Task", "Read", "Write", "Glob", "WebSearch", "WebFetch"]
---

Kjør vaktrunden. Dette er **det eneste pluginen gjør**, og den gjør det i seks
steg:

1. Hent radarsignalene som har kommet inn **siden forrige runde**
2. Legg fram en prioritering — journalisten velger sak
3. Sjekk den valgte saken mot **redaksjonens egne artikler**
4. Gjør et **bredt søk** for å utvide og etterprøve
5. Skriv et **saksforslag** på disk, på redaksjonens premisser
6. Kvitter, og gå til neste sak

Steg 3–6 gjentas per valgt sak, og hele runden kan kjøres på nytt rett etterpå.
Du hopper ikke over et steg, og du velger ikke saken for journalisten.

## 1. Hent runden og premissene

Kjør begge i **samme melding**, så de går parallelt:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs nytt $ARGUMENTS --json
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs profile --json
```

`nytt` måler mot **kvitteringen** — tidspunktet forrige runde ble gjort, lagret i
`.claude/kasus-state.json`. Den skriver ingenting.

Profilen er ikke et vedlegg. Den er grunnlaget for både prioriteringen i steg 2 og
tonen i steg 5: uten `criteria.patterns` er en rangering magefølelse med tall på.

Tre svar krever noe annet enn å gå videre:

- **`MANGLER: …`** — oppsettet er ikke på plass. Si hva som mangler, foreslå
  `/kasus:env`, og stopp.
- **`nye: 0`** — ingenting nytt. Si når det sist ble kvittert, og hva som ble
  holdt utenfor (`holdtUtenfor`). Tilby et bredere vindu (`--hours 72`) eller
  `--all` for de forkastede. Ikke fyll runden med gamle signaler for å ha noe å
  vise.
- **`kvittering: null`** — første runde. Si at vinduet er siste 24 timer, og at en
  kvittering til slutt gjør «siden sist» presist neste gang.

## 2. Prioriter — si hva hvert signal ER, og begrunn i profilen

Hvert signal du legger fram skal være merket med **kategori**. De fire krever
ulike tiltak, og i rå API-felt ser de like ut:

| Kategori | Hva du har i hånda | Tiltaket |
|---|---|---|
| **Oppfølging av EGEN sak** (`own_followup`) | Nye kilder på noe redaksjonen alt har publisert. Egne domener er utelatt fra søket. | Ofte den billigste gode saken: vinklingen finnes, det som mangler er det nye. |
| **Oppfølging av KONKURRENTSAK** (`competitor_followup`) | Andre kilder på et sakskompleks en konkurrent har tatt. Konkurrentens egne domener er utelatt. | **Ikke** konkurrentens artikkel — kilder å bygge en egen sak på. Hastverk med et forsprang. |
| **Konkurrentsak direkte** (`competitor_article`) | Konkurrentens egen sak, fra en overvåket forside. | Ikke et søketreff og ikke research. Skal den følges opp, starter researchen på null — og det må sies at utgangspunktet er en konkurrent. |
| **Fritt temasøk** (`market_signal`, `origin: null`) | Søketreff på et tema, hentet **uavhengig av publiseringstidspunkt**. | Sjekk publisert-datoen FØR du prioriterer. Her ligger støyen, og her ligger de gamle sakene. |

`meta.grupper` har kategoriene ferdig oppdelt med id-er og forklaring. Bruk dem —
ikke utled kategorien selv.

**Ferskhet er to tall.** `oppdaget` er når radaren fant signalet, `publisert` er
hvor gammel saken er. `meta.gamleSaker` lister det som er publisert mer enn en uke
før det ble oppdaget — **si det ved hver slik sak**, og ranger den ned med mindre
det gamle er poenget. Mangler datoen, er svaret «ukjent dato», ikke «fersk».

Rangér så, i denne rekkefølgen:

1. **Mønstertreff.** `matchedPattern` peker på et mønster i profilen. Les
   `whatWorks` — treffer saken det, er den sterk. Står vinklingen i `whatToAvoid`,
   si det og ranger ned, uansett hvor fersk den er.
2. **Hastverk og eierskap**, etter tabellen over.
3. **Om det finnes en primærkilde å gå til i dag.** Et signal som peker på et
   sakspapir, en statistikkpublisering eller et vedtak kan researches nå. Et som
   bare peker på en omtale krever en telefon — og det er en annen slags dag.
4. **Publiseringsdato**, ikke oppdaget-tidspunkt.
5. **Nærhet til `keywords`** i profilen.

Si også i én linje **hva du vurderer som støy og hvorfor** — typisk frie temasøk
uten mønstertreff og utenfor `keywords`. En liste som later som alt er interessant
er ingen prioritering.

Finn ikke opp en begrunnelse. Er det uklart hvorfor et signal ble plukket opp, er
det svaret: «uten mønstertreff — vet ikke hvorfor denne er her».

## 3. Spør hva som skal jobbes med

Bruk **AskUserQuestion** med begge spørsmål i **samme kall**:

**Spørsmål 1 — «Hvilke signaler skal du jobbe med?»** (`multiSelect: true`)
Opptil fire alternativer: dine fire høyest rangerte. `label` er en kort tittel
(maks 5 ord), `description` er kategori + begrunnelse + id, slik at valget er
sporbart. Har lista flere kandidater, si i teksten hvilke som ikke kom med —
brukeren kan svare «Other» og skrive noe annet.

**Spørsmål 2 — «Hvor langt skal vi gå per sak?»** (ett valg)

| Alternativ | Betyr |
|---|---|
| Hele veien | Egne saker → bredt søk → saksforslag på disk. Anbefalt. |
| Stopp etter søket | Egne saker og bredt søk, men ingen skriving. Du vurderer selv om det holder. |
| Bare egne saker | Har vi dekket dette før? Ikke noe mer. |

## 4–6. Per valgt sak, én om gangen

Ta sakene **én om gangen**, i prioritert rekkefølge. To saker parallelt gir tolv
kilderapporter ingen leser.

### 4a. Hent signalet og sjekk egne saker

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs signal <signal-id> --json
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs articles --match "<signalets tittel>. <sammendrag>" --json
```

Dette steget avgjør tre ting samtidig: om saken er skrevet før (ikke gjenta), om
det finnes en egen sak å bygge videre på (billigere og bedre), og hvilken tone
redaksjonen faktisk har på temaet.

**Les forbeholdet i svaret, og gjenta det for brukeren.** Artikkel-API-et har
ingen tekstsøk, så matchingen er ordoverlapp mot et vindu av de nyeste artiklene.
`meta.ukjenteOrd` er ofte det mest opplysende: er alle søkeordene ukjente, er
temaet i praksis udekket. **«Ingen treff» betyr «ikke blant disse artiklene», ikke
«ikke dekket»** — og den forskjellen er det som skiller en ny sak fra en dublett.

Er det et sterkt treff, les den faktiske teksten:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs article <artikkel-id> --json
```

Legg fram for brukeren: er dette samme sak (ikke skriv), overlappende (ny vinkling
kreves), eller et fundament å bygge på? Er det samme sak, si det og gå videre til
neste signal framfor å skrive noe uansett.

### 4b. Bredt søk — utvid og etterprøv

Formulér **3–6 konkrete spørsmål** som må besvares. Hent dem, i denne rekkefølgen:

1. Hvert tall i signalet som ikke har en kilde: hvor kommer det fra, hva er
   grunnlaget, hvilken periode gjelder det?
2. Hver aktør i `details.actors`: hva har de faktisk sagt, og når?
3. Det signalets kilde IKKE svarer på.
4. Det åpenbare motargumentet.
5. Er dette et lokalt tilfelle eller et mønster? Søk bredt her — det er ofte
   forskjellen mellom en notis og en sak.

Et spørsmål skal kunne besvares med en kilde. «Se på boligmarkedet» er ikke et
spørsmål; «Hvor mye falt kvadratmeterprisen i Bodø i Q2, og fra hvilken kilde?» er.

Send ut `kasus-researcher`-agenter, **ett spørsmål per agent, alle i samme
melding**, maks 6. Hver agent får:

- spørsmålet, ordrett
- signalets tittel, sammendrag og URL
- `targetAudience` og `editorialProfile` fra profilen
- **domenene som ikke er svar i seg selv**: organisasjonens eget `siteUrl`, og
  konkurrentens domene når signalet er en konkurrentsak

Sammenstill svarene og **løs konfliktene** framfor å liste dem side om side: når
to kilder er uenige, si hvilken som er nærmest primærkilden og hvorfor.

### 4c. Skriv saksforslaget

Format: @${CLAUDE_PLUGIN_ROOT}/references/proposal-format.md — én fil per sak, med
frontmatter, egne saker, funn med URL-er, hull, utkast og kildetabell.

De fire reglene som avgjør om filen er brukbar:

1. **Hvert faktum i utkastet står i FUNN, med kilde.** Er det ikke der, står det
   som `[TRENGER VERIFISERING: …]`. Aldri fyll et hull med en plausibel setning —
   det er den ene feilen som gjør et forslag farlig framfor ufullstendig.
2. **Sitater er ordrette fra en kilde du har lest**, med URL. Ellers
   `[SITAT MANGLER: <hvem> må kontaktes om <hva>]`.
3. **Tonen fra `editorialProfile` og `whatWorks`, nivået fra `targetAudience`.**
   Er det funnet en egen sak på temaet, er den det beste tonebeviset som finnes.
4. **`whatToAvoid` er et forbud**, ikke et råd.

Si til slutt, i én setning: **er det nok her til å skrive saken?** Er svaret nei,
si hva som mangler og hvem som må ringes. Det er et ærligere svar enn et utkast
med hull.

### 4d. Kvitter for saken, og gå videre

Kvitter for **denne** saken alene, med en gang den er ferdig:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs kvitter --ids <signal-id> --ids-only
```

`--ids-only` flytter ikke kvitteringstidspunktet. Det betyr at saken er behandlet,
mens alt annet fortsatt er nytt neste runde — så en runde som blir avbrutt her
verken mister eller gjentar arbeid.

Er det flere valgte saker igjen, spør med **AskUserQuestion**: «Fortsett med neste
sak?» — *Ja, neste* / *Stopp her og kvitter resten* / *Stopp, ikke kvitter mer*.
Er det ingen igjen, gå til steg 5.

## 5. Avslutt runden

Spør med **AskUserQuestion** hva som skal skje med signalene som IKKE ble
behandlet:

| Alternativ | Kommando | Betyr |
|---|---|---|
| Kvitter hele runden | `kvitter --at <meta.kvitter.at> --ids <alle viste id-er>` | Alt som ble vist er sett. Neste runde starter her. |
| La resten stå | — | De ubehandlede kommer igjen neste runde. |

`meta.kvitter` i JSON-svaret fra steg 1 har tidspunktet og id-ene ferdig. Bruk dem
ordrett — ikke lag et tidspunkt selv.

**Runden kan kjøres på nytt umiddelbart.** Kom det inn noe mens dere jobbet, viser
`/kasus:runde` det nå; ellers sier den at det ikke er noe nytt. Det er den normale
rytmen: kjør runden, ta én sak, kvitter, kjør igjen.

## 6. Rapporter

Kort:

- hvilke saker som ble behandlet, med kategori, og hva som ble lagt til side
- for hver sak: stien til saksforslaget, og om egne artikler dekket temaet
- **hvert hull**: `[TRENGER VERIFISERING]`, `[SITAT MANGLER]`, og hvem som må
  kontaktes
- hva kvitteringen nå står på, og hva som dermed kommer igjen neste runde

Runden publiserer ingenting. Pluginen skriver til disk i dette repoet, og API-et
er read-only.
