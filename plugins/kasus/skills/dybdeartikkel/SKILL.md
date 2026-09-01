---
name: dybdeartikkel
description: Prosessen for å lage en dybdeartikkel i denne redaksjonen — fra nytt radarsignal til et saksforslag på disk, i seks steg: nye signaler siden forrige saksløp pluss profilen og ukas egen produksjon, en prioritering journalisten velger fra, sjekk mot redaksjonens EGNE artikler, bredt søk med én agent per spørsmål, saksforslag i redaksjonens tone, og en kvittering. Skal brukes når noen vil JOBBE med en sak framfor bare å se hva som ligger der: «jeg skal skrive en dybdeartikkel», «finn meg en sak å skrive», «jeg trenger noe å jobbe med i dag», «lag et saksforslag», «kjør saksløpet», «kjør runden», «start et nytt saksløp», «ta en sak fra radaren», «kan du researche denne og skrive et forslag?», «følg opp signal <id>». Også når bestillingen er et TEMA framfor et signal («skriv en dybdeartikkel om strømpriser», «kan vi gjøre noe på boligmarkedet i Bodø?»): temaet matches da semantisk mot radarens vindu, fordi API-et ikke har tekstsøk — men saksløpet KREVER et signal, og stopper med en begrunnelse hvis radaren ikke har noe på temaet. Skal IKKE brukes på spørsmål om hva radaren har funnet («er det noe nytt?», «er det noe om strømpriser?») — det svarer kasus-lookout på uten å kvittere — eller på spørsmål om egen dekning alene, som er kasus-archivist. Er utgangspunktet en av redaksjonens EGNE publiserte artikler («følg opp saken vår om X»), er det ferdigheten `oppfolgersak`.
---

Gå fra radarsignal til saksforslag. Dette er **det eneste pluginen gjør**, og den
gjør det i seks steg:

1. Hent radarsignalene som har kommet inn **siden forrige saksløp**, og premissene:
   profilen og **ukas egen produksjon**
2. Legg fram en prioritering — journalisten velger sak
3. Sjekk den valgte saken mot **redaksjonens egne artikler**
4. Gjør et **bredt søk** for å utvide og etterprøve
5. Skriv et **saksforslag** på disk, på redaksjonens premisser
6. Kvitter, og gå til neste sak

Steg 3–6 gjentas per valgt sak, og hele saksløpet kan kjøres på nytt rett etterpå.
Du hopper ikke over et steg, og du velger ikke saken for journalisten.

## Før du starter: er dette saksløpet?

Saksløpet koster tid og **flytter kvitteringen**. To spørsmål ser like ut og skal
ikke hit:

- **«Er det noe nytt?», «er det noe om strømpriser?», «hva kom inn denne uka?»** —
  det er et spørsmål om hva som ligger der, ikke en beslutning om å jobbe.
  `kasus-lookout` svarer på det, og kvitterer aldri. `/kasus:start` gir samme
  blikk som en status.
- **«Har vi skrevet om X?», «hva har vi publisert i dag?»** — `kasus-archivist`
  alene. Ingen saksløp.
- **«Følg opp saken vår om X», «hva har skjedd siden vi skrev om dette?»** —
  utgangspunktet er en EGEN artikkel og ikke radaren. Det er ferdigheten
  `oppfolgersak`, som har vinklingen ferdig og bare trenger det nye.

Er det uklart om noen vil se eller jobbe, er det ett spørsmål verdt å stille før
steg 1 — men et signal-id, «skriv», «research», «forslag» eller «saksløpet» i
bestillingen er svaret allerede gitt.

Og uansett hvem som spør: **saksløpet krever et signal.** Finner radaren ingenting på
temaet, stopper den — se «Signalet er inngangsvilkåret».

## Vinduet: hvilke flagg saksløpet kjøres med

Uten noe sagt kjøres saksløpet på kvitteringen — «siden forrige saksløp». Ble det bedt
om noe annet, sett det på `nytt` i steg 1:

| Bestillingen | Flagget |
|---|---|
| «de siste tre døgnene», «litt bredere» | `--hours 72` |
| «bare siste døgn» | `--hours 24` |
| «ta med det som er forkastet» | `--all` |
| «vis flere» | `--limit 40` |

Ble ett bestemt signal nevnt (en id, eller en sak journalisten alt vet at hun vil
ha), hopp over steg 2 og 3 for valget — hent signalet med `signal <id> --json` og
gå rett til 4a. Steg 1 skal likevel kjøres: profilen og ukas produksjon er
premissene for både dekningssjekken og skrivinga.

Kom bestillingen som et **tema** framfor et signal, se neste avsnitt.

## Et tema uten signal

«Skriv en dybdeartikkel om strømpriser» er ikke saksløpets normaltilfelle, og du skal
ikke late som det er det: prioriteringen i steg 2 svarer på «hva har kommet inn»,
ikke på «hva har vi om strømpriser». **Match temaet mot radaren først.** Har den
alt funnet kilder på det, er de kildene gratis og ferske — og et signal gir saken
et sporbart utgangspunkt: `kasusSignalId` i forslaget, og noe å kvittere for.

**Kvitteringen er feil vindu for et tema.** Den svarer på hva DU har sett, mens
spørsmålet er hva radaren har på strømpriser — også det som ble vist og lagt til
side for tre dager siden. Kjør derfor dette i tillegg til de tre kallene i steg 1:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs signals --kort --hours 168 --limit 100 --json
```

`--kort` fordi vinduet skal leses her: tittel, kategori, begge datoer, mønster og
lenke, ikke researchkonteksten. Den henter du med `signal <id> --json` for den
saken som faktisk velges.

**Temaet er ikke et filter.** `/api/v1/signals` har ingen tekstsøk, og `--pattern`
matcher mønsternavn i profilen — ikke temaer. Match derfor selv, semantisk, mot
tittel og sammendrag: «strømstøtte», «nettleie» og «kraftpris» er samme tema som
«strømpriser», og har ikke ett ord til felles. Det er samme spørsmål
`kasus-lookout` besvarer, og et RENT spørsmål hører fortsatt der; forskjellen er
hva svaret skal brukes til. Her skal det velges fra, så lenkene må stå i samtalen.

**Fant du treff:** rangér etter steg 2 og legg dem fram med kategori, begge
datoer, mønster og klikkbar lenke — og si for hvert av dem **om det er nytt siden
sist eller alt sett**. Et signal fra i forgårs er ingen nyhet, og journalisten kan
ha lagt det til side selv. Gå så til steg 3 som normalt.

**Fant du ingen:** si det rett ut, og si hva det ikke betyr. «Radaren har
ingenting på dette i de siste sju døgnene» er ikke «det finnes ingen sak» —
radaren søker på redaksjonens egne mønstre, så et tema utenfor dem er usynlig for
den uansett hvor stor saken er. Men **saksløpet stopper her**, og det er ikke
forhandlingsbart. Se under.

Legg fram to veier med AskUserQuestion framfor å velge selv:

| Alternativ | Hva det er |
|---|---|
| Bredere vindu | `signals --kort --hours 720 --limit 100` — radaren kan ha hatt noe for en måned siden. Finner du et signal der, fortsetter saksløpet normalt. |
| Egen dekning først | `kasus-archivist` på temaet. Svarer på om redaksjonen alt har skrevet om det, og hva som i så fall ville vært en oppfølging. Det er en opplysning, ikke en inngang: uten et signal finnes det ingen nye kilder, og da er neste skritt en telefon framfor et saksløp. |

## Signalet er inngangsvilkåret

**Ingen saksløp uten et signal, og ingen fil på disk uten `kasusSignalId`.** Det
gjelder også når journalisten ber om det, og også når temaet er åpenbart en god
sak. Tre grunner, og de er ikke formaliteter:

1. **Sporet.** Saksforslaget er bygd rundt `kasusSignalId` og `signalUrl` — linja
   tilbake til hvorfor saken ble tatt opp. Uten den er filen et notat uten
   opphav, og en redaktør som spør «hvor kom dette fra?» får «noen nevnte det».
2. **Grunnlaget.** Et signal ER kilder: noe radaren har funnet, datert, og knyttet
   til et mønster i profilen. Uten det finnes ingen nye kilder å bygge på, bare et
   nettsøk hvem som helst kunne gjort — og et saksforslag i redaksjonens format
   ville sett ut som noe det ikke er.
3. **Kvitteringen.** Den gjelder signaler. En sak uten signal kan ikke kvitteres,
   så neste saksløp vet ikke at arbeidet er gjort, og saken kommer igjen.

Lån derfor **aldri** id-en til et signal som «nesten» handler om det samme for å
komme videre. Det er verre enn å stoppe: sporet peker da på en kilde som ikke er
grunnlaget, og feilen er usynlig i filen.

Si i stedet hva som mangler og hva som finnes: hvilket vindu som ble lest, at
radaren ikke har noe på temaet, og hva du KAN gjøre uten saksløpet — et
`kasus-researcher`-søk på ett konkret spørsmål, eller dekningssjekken over. Det er
research i samtalen, ikke et saksforslag: ingen fil, ingen kvittering, og si det.

## 1. Hent saksløpet og premissene

Kjør alle tre i **samme melding**, så de går parallelt:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs nytt --json
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs profile --json
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs articles --kort --hours 168 --limit 40 --json
```

`nytt` måler mot **kvitteringen** — tidspunktet forrige saksløp ble gjort, lagret i
`.claude/kasus-state.json`. Den skriver ingenting.

Profilen er ikke et vedlegg. Den er grunnlaget for både prioriteringen i steg 2 og
tonen i steg 5: uten `criteria.patterns` er en rangering magefølelse med tall på.

Det tredje kallet er **ukas produksjon**: de 40 nyeste publiserte sakene, siste
sju døgn. Profilen sier hva som fungerer for disse leserne i prinsippet; denne
sier hva redaksjonen faktisk holder på med akkurat nå. De to er ikke det samme, og
det er den andre journalisten kjenner igjen — «vi kjørte den saken på tirsdag».

Vinduet er lite med vilje. Det skal leses her, i samtalen, fordi det brukes til å
begrunne en rangering journalisten skal se. Er `taketNådd` sann, publiserte
redaksjonen mer enn 40 saker på en uke — si det, og behandle vinduet som «de 40
siste», ikke som uka.

Tre svar krever noe annet enn å gå videre:

- **`MANGLER: …`** — oppsettet er ikke på plass. Si hva som mangler, foreslå
  `/kasus:env`, og stopp.
- **`nye: 0`** — ingenting nytt. Si når det sist ble kvittert, og hva som ble
  holdt utenfor (`holdtUtenfor`). Tilby et bredere vindu (`--hours 72`) eller
  `--all` for de forkastede. Ikke fyll saksløpet med gamle signaler for å ha noe å
  vise.
- **`kvittering: null`** — første saksløp. Si at vinduet er siste 24 timer, og at en
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

**Gjør prioriteringen selv, her i samtalen.** `kasus-lookout` besvarer spørsmål om
signalene og er den rette agenten når noen bare vil vite hva som ligger der — men
den hører ikke i saksløpet. To grunner: den henter sitt eget vindu framfor saksløpets
«siden sist», og den svarer med en oppsummering, mens journalisten skal ha den
prioriterte lista med **klikkbare lenker foran seg før han velger**. En
oppsummering av en oppsummering er ikke noe man klikker på.

**Ferskhet er to tall.** `oppdaget` er når radaren fant signalet, `publisert` er
hvor gammel saken er. `meta.gamleSaker` lister det som er publisert mer enn en uke
før det ble oppdaget — **si det ved hver slik sak**, og ranger den ned med mindre
det gamle er poenget. Mangler datoen, er svaret «ukjent dato», ikke «fersk».

Rangér så, i denne rekkefølgen:

1. **Mønstertreff.** `matchedPattern` peker på et mønster i profilen. Les
   `whatWorks` — treffer saken det, er den sterk. Står vinklingen i `whatToAvoid`,
   si det og ranger ned, uansett hvor fersk den er.
2. **Kobling til ukas produksjon** — se under.
3. **Hastverk og eierskap**, etter tabellen over.
4. **Om det finnes en primærkilde å gå til i dag.** Et signal som peker på et
   sakspapir, en statistikkpublisering eller et vedtak kan researches nå. Et som
   bare peker på en omtale krever en telefon — og det er en annen slags dag.
5. **Publiseringsdato**, ikke oppdaget-tidspunkt.
6. **Nærhet til `keywords`** i profilen.

Si også i én linje **hva du vurderer som støy og hvorfor** — typisk frie temasøk
uten mønstertreff og utenfor `keywords`. En liste som later som alt er interessant
er ingen prioritering.

Finn ikke opp en begrunnelse. Er det uklart hvorfor et signal ble plukket opp, er
det svaret: «uten mønstertreff — vet ikke hvorfor denne er her».

### Koble signalene til ukas produksjon

Les artikkelvinduet mot signallista FØR du rangerer. Tre av koblingene endrer
prioriteringen, og de er lette å gå glipp av fordi radaren ikke kjenner dem:

1. **En oppfølging radaren ikke visste var en oppfølging.** Et fritt temasøk
   (`temasok`) har `origin: null` og ser ut som støy — men handler det om noe
   redaksjonen publiserte i går, er det i praksis en oppfølging av egen sak, og
   det er ofte den billigste gode saken på lista. Si koblingen eksplisitt, med
   **lenke til den egne saken**: «henger sammen med [vår sak fra tirsdag](url)».
   Dette er den mest verdifulle bruken av vinduet.
2. **Et tema redaksjonen står i akkurat nå.** Har uka fire saker om strømpriser,
   er et strømpris-signal ikke nøytralt. Si tallet framfor å tolke det:
   «redaksjonen har publisert fire saker om dette siden mandag». Om det er en
   grunn til å ta signalet (vi eier temaet, leserne forventer mer) eller la det
   ligge (vi har mettet det) er journalistens vurdering, ikke din.
3. **En åpenbar dublett, fanget før valget.** Ser et signal ut som noe som ble
   publisert i går, si det NÅ. Ellers velger journalisten saken, og oppdager det
   først i steg 4a — etter at en agent har lest to hundre artikler.

**Dette erstatter IKKE steg 4a.** Vinduet er sju døgn og 40 saker, valgt for å
svare på «hva holder vi på med», og det kan ikke svare på «har vi skrevet om dette
før?». Den sjekken går mot 200 artikler, gjøres semantisk av `kasus-archivist`, og
skal kjøres for hver valgte sak uansett hva du fant her. Et signal du IKKE koblet
til noe i dette vinduet kan godt være dekket for tre måneder siden.

Finner du ingen kobling, si det i én linje og gå videre. En oppdiktet forbindelse
til en egen sak er verre enn ingen: den flytter et signal opp i rangeringen på et
grunnlag som ikke finnes.

### Hvert signal skal være klikkbart

Journalisten skal kunne **åpne kildene og lese seg opp før han velger**. Derfor:

- **Hver sak i lista du legger fram har sin lenke, som en markdown-lenke på
  sakens egen linje** — `[SSB: kvadratmeterprisen falt 4,2 %](https://…)` — ikke
  som en fotnote, ikke som en samlet lenkeliste nederst, og ikke bare som en id.
- **Lenkene skal stå i teksten FØR du stiller spørsmålet.** Alternativene i
  AskUserQuestion er korte og ikke noe man klikker på, så en URL som bare står
  der er en URL journalisten ikke får åpnet. Legg fram den prioriterte lista med
  lenker, og still spørsmålet etterpå.
- **Har et signal flere kilder** (`+N kilder til` i outputen), si det og oppgi
  lenkene fra `sources` — for et oppfølgingssøk er det ofte de ANDRE kildene som
  er saken, ikke hovedlenka.
- **Mangler et signal lenke** (`LENKE: (ingen …)`), si det rett ut. Det er ikke
  en formalitet: et signal ingen kan åpne må vurderes på tittelen alene, og det
  er en grunn til å prioritere det ned.
- Skriv gjerne én linje om hva som er verdt å se etter i lenka, slik at
  klikkingen har en retning: «sjekk om sakspapiret oppgir hvilket kvartal».

## 3. Spør hva som skal jobbes med

Bruk **AskUserQuestion** med begge spørsmål i **samme kall**:

**Spørsmål 1 — «Hvilke signaler skal du jobbe med?»** (`multiSelect: true`)

`label` er en kort tittel (maks 5 ord), `description` er kategori + begrunnelse +
id, slik at valget er sporbart.

**Verktøyet tar maks fire alternativer**, og hvor mange av dem som skal være
signaler avhenger av hvor mange som finnes:

- **Fire eller færre nye signaler:** legg dem alle fram. Da er ingenting skjult,
  og et «vis meg resten»-alternativ ville vært et alternativ som ikke gjør noe.
- **Fem eller flere:** tre høyest rangerte, og det fjerde alternativet er
  **«List opp alle N forslag til artikler»**. Da er den fjerde plassen brukt på
  det som faktisk mangler — de andre kandidatene — framfor på kandidat nummer
  fire.

Navngi perioden i det alternativet, og hent den fra `meta.vindu`. Er vinduet rundt
et døgn, er «for siste døgn» riktig. Er kvitteringen fire dager gammel, holder
saksløpet fire dager, og da skal alternativet si det framfor å love et døgn. Er
vinduet mye bredere enn et døgn og lista lang, tilby i samme åndedrag at
`--hours 24` gir et saksløp på bare siste døgn.

**Blir alternativet valgt**, legg fram HELE lista — hvert signal i prioritert
rekkefølge, med kategori, begge datoer, mønster, eventuell kobling til ukas
produksjon, og **klikkbar lenke på sakens egen linje**. Nummerér dem, slik at
journalisten kan svare «3 og 7». Spør så på nytt med de samme to spørsmålene, men
**uten** listealternativet: alt er vist, og en gjentakelse ville vært en løkke.

Lenkene hører i teksten over spørsmålet, ikke i alternativene: journalisten skal
kunne lese seg opp i kildene og deretter svare. Får du «Other» med et krav om å se
noe annet, legg fram det framfor å gå videre.

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

Hent først signalet i full bredde:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs signal <signal-id> --json
```

Send så ut **én `kasus-archivist`** for dette signalet, med spørsmålet **«har vi
skrevet om dette før?»** — ordrett. Agenten besvarer spørsmål om egen dekning
generelt, så den må få vite hvilket spørsmål den stiller: det er denne formen som
har en fast dom per kandidat, og dommen er det du trenger her.

Svaret blir semantisk, og det er poenget — samme sak kan være skrevet med helt
andre ord, og det er nettopp de tilfellene som koster en dublett.

Agenten henter artiklene selv. Gi den:

- **spørsmålet**: «har vi skrevet om dette før?» — ordrett også når det er et tema
  og ikke et signal du spør på vegne av
- **plugin-roten**, som absolutt sti: `${CLAUDE_PLUGIN_ROOT}` — skriv ut den
  faktiske verdien i prompten, ikke variabelnavnet
- **`--env <navn>`** hvis saksløpet kjører mot et annet miljø
- **signalet**: tittel, sammendrag, og de av `details` som sier hva saken er —
  `publishedDate`, `actors`, `keyFigures`, `matchedPattern`

**Formulér** researchspørsmålene i 4b mens agenten jobber — de er uavhengige, og
den leser 200 artikler mens du tenker. Men **send ingen `kasus-researcher` før
dommen er inne.** Er svaret `SAMME SAK`, er de seks søkene bortkastet arbeid på en
sak som ikke skal skrives — og det er en dyrere feil enn å vente et halvminutt.

**Ikke hent dekningsvinduet selv.** Du har ukas 40 saker fra steg 1, og det er alt
du skal ha inline. Dekningssjekken går mot 200 artikler uten tidsgrense, og det
vinduet hører i agentens kontekst — ikke i din. Trenger du én bestemt artikkel i
full tekst etterpå, for tone eller for å bygge videre, er det
`article <id> --json` du bruker (uten `--json` klippes teksten på 6 000 tegn).

Og si til agenten hva du alt fant: fant du en kobling til ukas produksjon i steg 2,
skal den vite det, slik at den ikke bruker et av sine fem kandidatplasser på å
oppdage det samme på nytt.

Dette steget avgjør tre ting samtidig: om saken er skrevet før (ikke gjenta), om
det finnes en egen sak å bygge videre på (billigere og bedre), og hvilken tone
redaksjonen faktisk har på temaet.

**Gjenta begge forbeholdene fra agenten**, og hold dem fra hverandre:

- **Vindusgrensen.** Vurderingen gjelder de 200 nyeste artiklene, fordi API-et
  ikke har tekstsøk. **«Ingen treff» betyr «ikke blant disse artiklene», ikke
  «ikke dekket»** — en eldre sak om samme tema er usynlig. Den forskjellen er det
  som skiller en ny sak fra en dublett.
- **At det er en vurdering.** Den er ikke reproduserbar og kan bomme. Derfor står
  id, dato og url på hver kandidat: journalisten skal kunne overprøve den.

Har agenten ingen kandidater, si det som det er — og skill de to grunnene:
temaet er udekket i vinduet, eller organisasjonen har ingen artikler
synkronisert i det hele tatt. Det andre er ikke et svar på spørsmålet.

Legg fram kandidatene for brukeren **med klikkbar lenke til hver egen sak** — han
skal kunne åpne den og se hva som alt står der. Dommen fra agenten er
`SAMME SAK` (ikke skriv), `OPPFØLGING` (skriv, men som oppfølging), `FUNDAMENT`
(bygg på den) eller `SAMME TEMA` (ingen dublettrisiko, men tonebeviset). Er det
samme sak, si det og gå videre til neste signal framfor å skrive noe uansett.

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
melding**, maks 6. (`kasus-archivist` fra 4a er en annen agent med en annen jobb —
den leser egne artikler og søker ikke på nett.) Hver agent får:

- spørsmålet, ordrett
- signalets tittel, sammendrag og URL
- `targetAudience` og `editorialProfile` fra profilen
- **domenene som ikke er svar i seg selv**: organisasjonens eget `siteUrl`, og
  konkurrentens domene når signalet er en konkurrentsak

Sammenstill svarene og **løs konfliktene** framfor å liste dem side om side: når
to kilder er uenige, si hvilken som er nærmest primærkilden og hvorfor.

### 4c. Skriv saksforslaget

Formatet står i `${CLAUDE_PLUGIN_ROOT}/references/proposal-format.md` — **les fila
før du skriver**. Én fil per sak, med frontmatter, egne saker, funn med URL-er,
hull, utkast og kildetabell.

De fem reglene som avgjør om filen er brukbar:

1. **`kasusSignalId` og `signalUrl` er utfylt.** Er de ikke det, skriver du ikke
   filen — se «Signalet er inngangsvilkåret». En `null` der er ikke et tomt felt,
   det er et forslag uten opphav.
2. **Hvert faktum i utkastet står i FUNN, med kilde.** Er det ikke der, står det
   som `[TRENGER VERIFISERING: …]`. Aldri fyll et hull med en plausibel setning —
   det er den ene feilen som gjør et forslag farlig framfor ufullstendig.
3. **Sitater er ordrette fra en kilde du har lest**, med URL. Ellers
   `[SITAT MANGLER: <hvem> må kontaktes om <hva>]`.
4. **Tonen fra `editorialProfile` og `whatWorks`, nivået fra `targetAudience`.**
   Er det funnet en egen sak på temaet, er den det beste tonebeviset som finnes.
5. **`whatToAvoid` er et forbud**, ikke et råd.

Si til slutt, i én setning: **er det nok her til å skrive saken?** Er svaret nei,
si hva som mangler og hvem som må ringes. Det er et ærligere svar enn et utkast
med hull.

### 4d. Kvitter for saken, og gå videre

Kvitter for **denne** saken alene, med en gang den er ferdig:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs kvitter --ids <signal-id> --ids-only
```

`--ids-only` flytter ikke kvitteringstidspunktet. Det betyr at saken er behandlet,
mens alt annet fortsatt er nytt neste saksløp — så et saksløp som blir avbrutt her
verken mister eller gjentar arbeid.

Er det flere valgte saker igjen, spør med **AskUserQuestion**: «Fortsett med neste
sak?» — *Ja, neste* / *Stopp her og kvitter resten* / *Stopp, ikke kvitter mer*.
Er det ingen igjen, gå til steg 5.

## 5. Avslutt saksløpet

Spør med **AskUserQuestion** hva som skal skje med signalene som IKKE ble
behandlet:

| Alternativ | Kommando | Betyr |
|---|---|---|
| Kvitter hele saksløpet | `kvitter --at <meta.kvitter.at> --ids <alle viste id-er>` | Alt som ble vist er sett. Neste saksløp starter her. |
| La resten stå | — | De ubehandlede kommer igjen neste saksløp. |

`meta.kvitter` i JSON-svaret fra steg 1 har tidspunktet og id-ene ferdig. Bruk dem
ordrett — ikke lag et tidspunkt selv.

**Saksløpet kan kjøres på nytt umiddelbart.** Kom det inn noe mens dere jobbet, viser
et nytt saksløp det nå; ellers sier den at det ikke er noe nytt. Det er den normale
rytmen: kjør saksløpet, ta én sak, kvitter, kjør igjen.

## 6. Rapporter

Kort:

- hvilke saker som ble behandlet, med kategori, og hva som ble lagt til side
- for hver sak: stien til saksforslaget, og om egne artikler dekket temaet
- **hvert hull**: `[TRENGER VERIFISERING]`, `[SITAT MANGLER]`, og hvem som må
  kontaktes
- hva kvitteringen nå står på, og hva som dermed kommer igjen neste saksløp

Saksløpet publiserer ingenting. Pluginen skriver til disk i dette repoet, og API-et
er read-only.
