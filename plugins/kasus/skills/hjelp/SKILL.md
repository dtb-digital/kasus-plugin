---
name: hjelp
description: Forklarer hvordan kasus-pluginen brukes — hva den gjør, hva den kan spørres om, hvordan man får tak i signalene, hva et signal ER, hvilken inngang som hører til hvilken jobb, hva ordene i outputen betyr, og hva som er galt når noe ikke virker. Skal brukes på spørsmål OM pluginen framfor bestillinger TIL den: «hvordan bruker jeg denne?», «hva kan kasus?», «hva kan jeg spørre om?», «hjelp», «hvor begynner jeg?», «hva er et signal?», «hvor kommer signalene fra?», «hvordan finner jeg signaler om et tema?», «kan jeg filtrere signalene?», «hva ser radaren etter?», «hva er forskjellen på et saksløp og en oppfølger?», «hvorfor får jeg ingen signaler?», «hvor legger den saksforslagene?», «hva står i et saksforslag?», «hva betyr GAMMEL SAK / kvitteringen / SAMME SAK?», «kan den skrive noe tilbake til Kasus?», «hvordan kobler jeg til Kasus?», «hvordan logger jeg inn?». Skal IKKE brukes når bestillingen er selve arbeidet: «finn meg en sak å skrive» er ferdigheten dybdeartikkel, «er det noe nytt?» er kasus-lookout, «har vi skrevet om X?» er kasus-archivist. Svarer på spørsmålet som ble stilt og tilbyr å starte riktig inngang — henter aldri signaler eller artikler, skriver ingenting og kvitterer aldri.
---

Hjelp en journalist bruke pluginen. Den gjør **én ting**: går fra et radarsignal
til et saksforslag på disk, i seks steg — signaler siden sist, journalisten
velger sak, sjekk mot egne artikler, bredt søk, forslag, kvittering.

Alt annet i pluginen er enten et blikk inn i det samme materialet, eller
diagnostikk.

## Slik svarer du

1. **Svar på spørsmålet som ble stilt.** Ikke legg fram hele manualen fordi noen
   spurte om én ting. «Hvor havner saksforslagene?» er to setninger, ikke en
   omvisning. Denne filen er et oppslagsverk for deg, ikke et svar du gjengir.
2. **Bare når spørsmålet ER «hva kan denne?»** legger du fram tabellen under —
   som fire–fem linjer om hva journalisten kan si, ikke som en kommandoliste.
3. **Snakk om jobben, ikke om verktøyet.** Journalisten skal vite hva som må sies
   for å få gjort noe. Kommandonavn er en snarvei, ikke inngangen, og flaggene i
   denne filen er noe maskinen setter — ikke noe han skal skrive. **Agent- og
   ferdighetsnavnene i tabellen under er heller ikke svar**: «jeg leser sakene
   deres og sier hva vi har skrevet» er svaret, `kasus-archivist` er navnet mitt
   på den jobben. Formen på alt som legges fram står i
   [`references/samtaleform.md`](../../references/samtaleform.md) — slash-kommandoene
   er unntaket, for dem skriver han selv.
4. **Tilby å starte, og la journalisten bestemme.** «Vil du at jeg kjører saksløpet
   nå?» er riktig avslutning på et hjelpesvar. Å starte den uoppfordret er det
   ikke: saksløpet koster tid og **flytter kvitteringen**.
5. **Du gjør ikke arbeidet herfra.** Ingen signaler, ingen artikler, ingen
   research, ingen fil på disk, aldri en kvittering. Blir spørsmålet underveis en
   bestilling — «ok, finn meg en sak da» — går du over i riktig ferdighet
   framfor å svare på den her.

Du kan kjøre to ting selv, og begge er rent lokale — de leser env-variabler og
pluginens eget manifest, uten å røre nettverket:

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/check-env.sh --resolve
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs --list
```

Den første når spørsmålet er «hvorfor virker det ikke» — det er samme sjekk som
`/kasus:env`, og du skal si at det er den. Den andre når du er i tvil om hva
kvitteringsverktøyet faktisk har av modi, framfor å gjette. Om Kasus er koblet
til, ser du av om MCP-verktøyene finnes (`mcp__plugin_kasus_kasus__*`) — du kaller
dem ikke herfra.

## Hva journalisten kan si

Ingen av linjene i midterste kolonne må sies ordrett. Poenget er at bestillingen
i seg selv er inngangen — det finnes ikke noe kommandonavn man må huske først.

Navnene i høyre kolonne er pluginens indre, og de står her for deg: de sier
hvilken inngang som tar over. Svarer du journalisten, si hva som skjer framfor
hvem som gjør det.

| Vil du… | Si noe sånt som | Hva som skjer |
|---|---|---|
| **finne en sak å skrive** | «jeg skal skrive en dybdeartikkel», «finn meg en sak», «jeg trenger noe å jobbe med i dag», «kjør saksløpet» (eller «kjør runden» — det gamle ordet virker fortsatt) | Hele saksløpet — ferdigheten `dybdeartikkel`. Seks steg, du velger saken, den skriver et **saksforslag på disk** og kvitterer. |
| **jobbe med ett bestemt signal** | «følg opp signal 1234», «lag et forslag på denne» | Samme saksløp, men den hopper over prioriteringen. |
| **jobbe med et tema** | «kan vi gjøre noe på boligmarkedet i Bodø?» | Samme saksløp. Temaet matches mot radarens vindu først — **finner den ingen signaler, stopper den**, for et forslag uten opphav er bare et nettsøk. |
| **følge opp en av deres EGNE saker** | «hva har skjedd siden vi skrev om strømstøtte?», «kan vi følge opp denne?» | Ferdigheten `oppfolgersak`. Vinklingen finnes alt — den leter etter **det nye**, og stopper hvis det ikke finnes noe. |
| **bare se hva som ligger der** | «er det noe nytt å skrive om?», «er det noe om strømpriser?», «hva kom inn denne uka?» | `kasus-lookout` leser signalene og svarer. **Kvitterer aldri, skriver ingenting.** Se «Slik får du tak i signalene». |
| **vite hva dere selv har dekket** | «har vi skrevet om dette?», «hva publiserte vi i dag?», «hvem hos oss dekker samferdsel?» | Deres egne artikler leses, og svaret kommer med dato og lenke på hver sak — `kasus-archivist`. Se «Slik spør du om egen dekning». |
| **rydde i hele bildet på én gang** | «rydd opp i signalene», «hva av dette henger sammen?», «hva har vi alt dekket av dette?» | `kasus-triage` sveiper alle signalene og alle publiserte egne saker, slår sammen det som er samme sak og merker det som er dekket. Bearbeider — velger ingenting. |
| **komme i gang, uten å ha bestemt deg** | `/kasus:start` | **Siste døgn av alt, på én skjerm**: radarsignalene, Kasus' egne story-briefs, deres egne ferske saker og «hva er nytt siden sist» — og så **ett spørsmål**: en oppfølger, en dybdeartikkel, eller et spørsmål. Går på sekunder. Har du ikke kjørt den på en uke, henter den uka. `--hours 72` overstyrer. **Bearbeider ingenting**: ingenting er slått sammen, ingenting er dekningssjekket. Utfører ingenting selv — svaret ditt sender deg videre. |
| **vite hvorfor radaren fant noe** | «hva ser radaren etter?», «hvilke mønstre har vi?», «hva er profilen vår?» | Ett oppslag mot **profilen**. Se «Profilen — hvorfor signalet er der». |
| **se hva Kasus selv har foreslått** | «hva ligger det av saksforslag i Kasus?», «har pipelinen laget noe på dette?» | Ett oppslag mot **story-briefs** — Kasus' egne forslag, laget inne i systemet. Ikke det samme som saksforslagene pluginen skriver på disk, og **ikke et utgangspunkt for saksløpet**: det går fra et rått radarsignal. Se «Story-briefs — Kasus' egne forslag». |
| **sjekke oppsettet** | `/kasus:env`, eller `--resolve` for å se hvilken installasjon et kall treffer | Diagnostikk. |
| **sjekke at pluginen er hel** | `/kasus:test` | Diagnostikk. `--live` tester også tilkoblingen. |

Vil du velge en arbeidsflyt med vilje framfor å beskrive jobben, er
`/kasus:dybdeartikkel` og `/kasus:oppfolgersak` de samme to ferdighetene fra
menyen. `/kasus:hjelp` er denne.

Én agent står ikke i tabellen, med vilje — den er en arbeidshest, ikke en inngang:
**`kasus-researcher`** søker og leser primærkilder. Saksløpet sender ut én per
researchspørsmål, parallelt. Du bestiller den ikke selv.

## Hva et signal er

Et **signal** er ett funn fra Kasus' radar, med en lenke. Radaren jobber på
redaksjonens vegne mellom saksløpene: den overvåker forsidene til konkurrentene
og søker på temaene redaksjonens profil peker ut. Det den finner, legger den fram
som signaler.

Et signal er altså ikke en sak. Det er et **utgangspunkt** — og det er
inngangsvilkåret for et saksforslag: uten et signal har forslaget ikke noe opphav,
og da er det bare et nettsøk med pen formatering.

**Hvert signal bærer fire ting som avgjør hva det er verdt:**

- **kategorien** — hvorfor radaren har det. Fire muligheter, og de krever helt
  ulike tiltak:

  | Kategorien | Hva det er | Hva det er verdt |
  |---|---|---|
  | **Oppfølging av EGEN sak** | Nye kilder på noe redaksjonen alt har publisert | Ofte den billigste gode saken: vinklingen finnes, det nye er det som mangler |
  | **Oppfølging av KONKURRENTSAK** | Andre kilder på et sakskompleks en konkurrent har tatt. Konkurrentens egne domener er utelatt fra søket | Kilder å bygge en EGEN sak på, med et forsprang som forsvinner fort |
  | **Konkurrentsak direkte** | Konkurrentens egen sak, fra en overvåket forside | Ikke research. Skal den følges opp, starter arbeidet på null |
  | **Fritt temasøk** | Søketreff på et tema, hentet uavhengig av publiseringstidspunkt | Her ligger støyen — og her ligger de gamle sakene |

- **to datoer**, som ikke er det samme: **oppdaget** (da radaren fant det) og
  **publisert** (hvor gammel saken selv er). Et fritt temasøk hentes uavhengig av
  publiseringstidspunkt, så et signal oppdaget i dag kan være en sak fra 2023 —
  det merkes `GAMMEL SAK`. Mangler datoen, er svaret «ukjent dato», ikke «fersk».
- **mønsteret** — hvilket av redaksjonens egne mønstre i profilen som gjorde at
  radaren plukket det opp. Er det tomt, sies det: «uten mønstertreff» er en
  opplysning, ikke en feil. Da finner radaren noe profilen ikke forklarer.
- **lenka og kildene.** Et signal kan ha flere kilder på samme funn. Mangler
  lenka, må signalet vurderes på tittelen alene — og det sies.

Dypere ligger **researchkonteksten**: sammendrag, aktører, nøkkeltall,
utdrag. Den hentes ikke for hundre signaler av gangen, bare for det ene som
faktisk velges — «hent signal 1234» gir hele det bildet.

**Signalets `status` i Kasus er ikke kvitteringen din.** `new`, `seen`,
`promoted` (løftet videre i Kasus) og `dismissed` (forkastet der) er felt Kasus
eier, og **pluginen skriver dem aldri** — mot Kasus er alt lesing. Kvitteringen
er noe helt annet: en linje i ditt eget repo om hva DU har sett. Forkastede
signaler holdes utenfor med mindre man ber om dem, og antallet sies.

## Slik får du tak i signalene

**Søket i Kasus er et ordsøk.** Det finner signalet med ordet «nettleie», men ikke
det som handler om det samme med andre ord. Et tema er derfor ikke et filter — det
er noe som må **leses**, med ordsøket som et tillegg. Det er hele grunnen til at
`kasus-lookout` finnes: den henter et vindu av signaler
inn i sin egen kontekst, leser det, og svarer. Du trenger ingen kommando; du sier
hva du lurer på.

| Si | Du får |
|---|---|
| «er det noe å skrive om i dag?» | Døgnets signaler, med de to–tre som mest ser ut som en sak |
| «hva har kommet inn denne uka?» | Samme, med et vindu på sju døgn |
| «er det noe om strømpriser?» | Hele vinduet lest for temaet — en gjennomlesing, pluss et ordsøk lenger tilbake |
| «er det oppfølginger av våre egne saker?» | Bare kategorien som bygger på noe dere har publisert |
| «er det noe fra konkurrentene?» | Konkurrentsaker, og oppfølgingene av dem |
| «hvor mye av dette er bare temasøk?» | Et tall, med signalene bak |
| «hvor mange signaler er det på mønsteret X?» | Signalene som traff nettopp det mønsteret |
| «finner radaren noe profilen ikke forklarer?» | Signalene UTEN mønstertreff — fraværet er et eget spørsmål |
| «er det noe ferskt?» | Signaler der SAKEN er fersk, ikke bare funnet |
| «hvor mye av dette er gamle saker?» | De der publisert ligger mer enn en uke før oppdaget |
| «er det noen signaler vi ikke kan åpne?» | De uten lenke |
| «hva er løftet videre / forkastet i Kasus?» | Signaler med `promoted`- eller `dismissed`-status |
| «hent signal 1234» | Ett signal med alle kilder og hele researchkonteksten |
| «vis flere» / «gå lenger tilbake» | Et større vindu. Vinduet er hundre signaler som standard |
| «hva er NYTT siden sist?» | `/kasus:start` — den ene som måler mot kvitteringen din |
| «hva har vi å jobbe med i dag?» | `/kasus:start` — siste døgn av de tre kildene side om side: signaler, briefs, egne saker. Vinduet strekker seg tilbake til forrige kvittering om det er lenger siden, så ingenting «nytt siden sist» faller utenfor |

Tre ting er verdt å si videre til den som spør:

- **«I dag» kan bety to ting.** «Oppdaget siste døgn» og «saken er fra siste døgn»
  er ulike spørsmål, og svaret sier alltid hvilket av dem som ble målt. Et signal
  uten publiseringsdato faller ut av det siste, og antallet oppgis — de er
  *ukjente*, ikke gamle.
- **Et filter på et avkortet vindu er ikke et søk.** Noen av filtrene finnes
  serverside; resten sorterer det som alt er hentet. Derfor sier hvert svar hvor
  mange som passerte av hvor mange hentede, og om taket ble nådd. «2 treff» betyr
  «2 av de 100 vi så».
- **Tomt betyr tomt for DENNE organisasjonen.** Tilkoblingen avgjør hvilken — du
  valgte den da du logget inn. Det betyr aldri «ingenting i Kasus».

Ingen av disse spørsmålene rører kvitteringen, og ingen av dem starter et
saksløp. Du kan spørre så mye du vil uten å bruke opp noe.

## Slik spør du om egen dekning

Samme begrensning, andre side av huset: søket i egne artikler er også et ordsøk,
så «har vi skrevet om dette?» besvares ved at `kasus-archivist` henter et vindu av
de nyeste egne artiklene, leser det, og søker etter de bærende ordene i resten. Hvert svar kommer med dato og lenke, så du
kan åpne saken og overprøve det på tretti sekunder.

| Si | Du får |
|---|---|
| «har vi skrevet om dette før?» | Kandidatene fra vinduet, hver med en dom — se ordlista |
| «hva publiserte vi i dag / denne uka?» | Full liste for perioden, ikke et utsnitt |
| «hvem hos oss dekker samferdsel?» | Sakene på temaet, og hvem som har signert dem — signaturen står på artikkelen, så den hentes per sak |
| «hvilken tone har vi hatt på strømpriser?» | Tonebeviset: hvordan redaksjonen faktisk skriver om temaet |
| «hvilken sak var det vi kjørte om X i mars?» | Kandidatene nummerert, med dato og lenke, så du kan peke på riktig |
| «hva ligger i kladd?» | Et eget oppslag — kladder er utenfor det vanlige vinduet |
| «hent artikkel 4711» | Hele artikkelen i full tekst |

Vinduet er de **200 nyeste publiserte** sakene, og grensen står i svaret. Det er
den viktigste setningen på denne siden: «ingen treff» betyr «ikke blant disse
artiklene» — aldri «ikke dekket», og aldri «ingen kollega jobber med dette».

## Story-briefs — Kasus' egne forslag

Kasus lager sine egne saksforslag inne i systemet, av innholdspipelinen: en
**story-brief** med tittel, plott, vinkling, begrunnelse og en vurdering av
konverteringspotensial. De ligger i Kasus, ikke på disk, og journalisten kan slå
dem opp:

- **status** — `candidate` (plukket ut, ikke vurdert ferdig), `proposal` (vurdert
  og lagt fram), `draft` (noen har begynt å skrive), `final`, `dismissed`. De to
  første ser ut som synonymer og er det ikke.
- **opphav** — `innhold` (pipelinen holdt egne saker mot mønstrene), `radar` (et
  radarsignal), `url` (noen limte inn en lenke), `triage`.
- **`--hours` måler når KASUS laget briefen**, ikke når noe ble publisert. Et tomt
  svar betyr «ingenting ble laget i perioden».

To ting må sies når du svarer på et slikt spørsmål:

1. **Dette er ikke saksforslagene pluginen skriver.** Ordet betyr to ting. Bare
   fila på disk har et signal, en dekningssjekk mot egne artikler og daterte
   kilder bak seg — en brief er pipelinens vurdering, og ingen har etterprøvd
   `plot`, `angle` eller `reason`.
2. **Det er et oppslag, ikke en inngang.** Vil journalisten JOBBE med en sak, er
   det saksløpet fra et radarsignal — ikke en ferdig brief. To utgangspunkt i
   samme arbeidsflyt betyr at ingen kan se hvilket som gjelder for forslaget de
   leser, og det er derfor ingen ferdighet henter briefene.

## Profilen — hvorfor signalet er der

Profilen er redaksjonens eget premiss, lagret i Kasus: målgruppa, den
redaksjonelle profilen, **mønstrene** radaren søker på, innsiktene om hva som
fungerer for disse leserne, og radarens mandat. Den er koblingen som forklarer
hvorfor et bestemt signal ligger i lista — mønsteret på signalet er samme streng
som mønsteret i profilen.

Profilen er ikke en egen ferdighet eller agent, den er ett oppslag. Den hentes
automatisk som premiss i `dybdeartikkel` og `oppfolgersak` — for å rangere
signalene og for å treffe tonen i forslaget. Den hentes bevisst **ikke** i
`/kasus:start` og ikke av `kasus-triage`: en inngang henter materialet, en agent
bearbeider det, men prioriteringen krever premisset — og en rangering uten det
ville vært magefølelse med tall på.

Spør noen direkte «hva ser radaren etter?», er svaret ett kall unna — men det er
ikke hjelpen som gjør det. Si hva det koster (ingenting), og tilby det.

## De fire grensene som forvirrer mest

**Se eller jobbe.** «Er det noe nytt?» og «finn meg en sak» ser like ut og er det
ikke. Det første er et spørsmål om hva som ligger der, og det svarer en agent på
uten å røre noe. Det andre setter i gang et saksløp som researcher, skriver til
disk og **flytter kvitteringen**. Er du i tvil om hva du vil, spør først — det
koster ingenting, og spørsmålet kan ikke spise saksløpet ditt.

**Signal eller egen artikkel.** Saksløpet starter på noe radaren fant. Oppfølgeren
starter på noe redaksjonen alt har publisert. Det er to jobber: saksløpet må finne
både vinkling og nyhet, oppfølgeren har vinklingen ferdig og trenger bare det nye.

**Lookout eller archivist.** `kasus-lookout` vet hva radaren har funnet ute i
verden. `kasus-archivist` vet hva **dere** har publisert. «Er det noe om
strømpriser?» går til den første, «har vi skrevet om strømpriser?» til den andre.

**Ett spørsmål eller hele bildet.** `kasus-lookout` og `kasus-archivist` svarer på
ett spørsmål hver, fort. `kasus-triage` leser begge vinduene samtidig — hundre
signaler mot to hundre egne saker — slår sammen det som er samme sakskompleks til
én **kandidatsak**, og gir hver av dem en foreløpig dekningsdom. Den koster et par
minutter, og den kjøres **når noen ber om den**: `/kasus:start` legger materialet
fram rått og bearbeider ingenting, så «rydd opp i dette» er et eget steg etter
blikket. Et oppslag skal ikke betale for det.

**Dommen fra `kasus-triage` klarerer ingen sak.** Den er en grovsortering på
signalets tittel og sammendrag: god nok til å luke en åpenbar dublett og finne den
egne saken en oppfølger kan bygge på, ikke god nok til å avgjøre at noe skal
skrives. Velges saken, leser `kasus-archivist` det samme vinduet på nytt med hele
signalet. To nivåer, og bare det andre klarerer.

## Det du sitter igjen med: saksforslaget

Saksløpet og oppfølgeren leverer **én fil per sak**, i `./artikler/` — datert, med
tittelen som filnavn, og aldri en overskriving av noe som finnes. Filen er hele
leveransen, så en redaktør som skal sjekke ett tall slipper å lete i to
dokumenter:

- **hva utgangspunktet var** — signalet med lenke og datoer, eller den egne saken
  oppfølgeren bygger på
- **hva redaksjonen alt har skrevet** om det, med id, dato og lenke
- **funnene fra det brede søket**, delt i bekreftet, motstridende og ubekreftet
- **hullene** — det som må ringes på før saken kan publiseres
- **et utkast** i redaksjonens tone, og **kildelista** bak hvert tall

`status: forslag` står øverst, og det er en påstand om hva filen er: et utkast fra
en maskin, også når teksten leser godt. Ingenting i den er publisert noe sted.

## Første gang: oppsettet

Tre ting, og den tredje er den folk glemmer:

1. Pluginen installeres med **prosjekt-scope** i redaksjonens repo, så den følger
   repoet framfor din maskin. Den tar med seg tilkoblingen til Kasus.
2. **Start sesjonen på nytt.** Nye plugins og nye komponenter plukkes opp ved
   oppstart, ikke underveis.
3. **Logg inn.** Skriv `/mcp`, velg `plugin:kasus:kasus` og «Authenticate». Du
   logger inn med Kasus-kontoen din i nettleseren, og har du flere
   organisasjoner, velger du én der. Ingen API-nøkkel, og ingenting å lime inn.

Så: `/kasus:env`. Den sier hvilken installasjon tilkoblingen går mot, og hvilken
organisasjon du er logget inn i. Detaljene, inkludert de tre scopene, står i
[`README.md`](../../README.md).

## Når noe ikke virker

| Det du ser | Som regel fordi | Gjør dette |
|---|---|---|
| «Kasus er ikke koblet til», verktøyene finnes ikke, eller «needs authentication» | Du har ikke logget inn, innloggingen er utløpt, eller sesjonen er ikke startet på nytt etter installasjonen | `/mcp` → `plugin:kasus:kasus` → Authenticate. Står den ikke der, start sesjonen på nytt i prosjektmappa |
| «Ingen signaler» | Vinduet er tomt for **denne organisasjonen** — tilkoblingen avgjør hvilken | `/kasus:start` henter bare siste døgn, så prøv `--hours 168` først, eller spør `kasus-lookout` om en lengre periode. `/kasus:env` sier hvilken installasjon og organisasjon du er koblet til. Feil organisasjon: logg ut og inn igjen via `/mcp` |
| Saksløpet sier «ingenting nytt», men du vet det ligger signaler der | Kvitteringen er flyttet — de er sett før | Be om et bredere vindu, eller «ta med det som er forkastet». Vil du starte «siden sist» helt på nytt, kan kvitteringen nullstilles |
| Et spørsmål gir færre treff enn du tror finnes | Filteret kjørte på et avkortet vindu | Be om et større vindu. Svaret sier hvor mange som ble hentet, og om taket ble nådd |
| «ikke funnet» på et signal eller en artikkel | Finnes ikke, **eller** tilhører en annen organisasjon | Sjekk id-en, og hvilken organisasjon du er koblet til (`/kasus:env`) |
| Det virket i går, men avvises nå | Appen er koblet fra i Kasus (Innstillinger → Tilkoblede apper), eller du er ikke lenger medlem av organisasjonen | Logg inn på nytt via `/mcp` |
| Ferdigheten trigges ikke, eller `/kasus:…` finnes ikke | Sesjonen er ikke startet på nytt, eller pluginen er ikke slått på i dette prosjektet | Start på nytt i prosjektmappa, og sjekk `enabledPlugins` i `.claude/settings.json` |
| Saksforslagene dukker ikke opp der du venter | `./artikler` og `.claude/kasus-state.json` er **relative til der du står** | Sjekk at sesjonen kjører fra prosjektmappa |
| Noe annet er rart | — | `/kasus:test` sier om pluginen selv er hel, `/kasus:env` om tilkoblingen er det |

## Ordene du møter i outputen

Du møter færre av dem enn pluginen har: det som legges fram er ryddet etter
`references/samtaleform.md`, så id-er, kategorinavn, feltnavn og flagg står ikke i
svarene. Tabellen står fordi spørsmålet likevel kommer — fra et saksforslag på
disk, fra et eldre svar, eller fra en som har sett verktøyets egen utskrift.

| Ordet | Betyr |
|---|---|
| **signal** | Noe radaren har funnet. Alltid med en lenke, og det er inngangsvilkåret for et saksforslag |
| **kvitteringen / «siden sist»** | Tidspunktet forrige saksløp ble gjort, lagret i ditt eget repo. Derfor kan saksløpet si «tre nye» framfor «de 20 nyeste» — og derfor kommer ikke den samme saken tre ganger på en dag. Bare kvitteringssteget skriver den; å se på noe flytter den aldri |
| **oppdaget vs. publisert** | Når radaren fant signalet, kontra hvor gammel saken er. **To ulike tall** |
| **GAMMEL SAK** | De to datoene ligger mer enn en uke fra hverandre. Et fritt temasøk kan levere en sak fra 2023 «oppdaget for 45 min siden» |
| **ukjent dato** | Publiseringsdatoen mangler. Det er ikke det samme som gammel |
| **de fire kategoriene** | Oppfølging av EGEN sak, oppfølging av KONKURRENTSAK, konkurrentsak direkte, fritt temasøk. De krever ulike tiltak — se «Hva et signal er» |
| **mønster** | Hvilket av redaksjonens egne mønstre i profilen som fanget signalet. Tomt = radaren fant noe profilen ikke forklarer |
| **`new` / `seen` / `promoted` / `dismissed`** | Signalets status **i Kasus**, ikke din kvittering. Pluginen leser den og skriver den aldri |
| **SAMME SAK / OPPFØLGING / FUNDAMENT / SAMME TEMA** | Dommen dekningssjekken gir hver kandidat: ikke skriv / skriv som oppfølging / bygg på den / beslektet, og tonebevis. `ÅPEN` betyr at ingenting i vinduet ligner |
| **kandidatsak** | Én sak, satt sammen av de signalene som handler om det samme. `kasus-triage` konsoliderer, så tre kilder på samme SSB-tall blir én linje og ikke tre. `/kasus:start` gjør det IKKE — der står de som tre |
| **grovsortering** | Dekningsdommen fra inngangen, felt på signalets tittel og sammendrag. Den rangerer og advarer — den klarerer ingen sak |
| **forbeholdet** | Linja som sier hva vinduet faktisk dekket: hvor mange som ble hentet, hvilke filtre som var i bruk, og om taket ble nådd. Den er en del av svaret, ikke en fotnote |
| `[TRENGER VERIFISERING: …]`, `[SITAT MANGLER: …]` | Et hull som er markert framfor fylt ut. Antallet står i forslagets frontmatter som `apenePunkter` |
| **`status: forslag`** | Filen er et utkast fra en maskin, også når teksten leser godt |

## Det du bør si når noen stoler for mye på svaret

- **«Ingen treff» er ikke «ikke dekket».** Dekningssjekken leser et vindu på de
  200 nyeste egne artiklene. En eldre sak er usynlig for den, og **kladder er
  utenfor vinduet** — «ingen treff» betyr heller ikke «ingen kollega jobber med
  dette».
- **Ingenting her er et søk i alt.** Søket i Kasus finner ord, ikke saker. Hvert
  svar er et vindu som er lest, og størrelsen på vinduet står i svaret.
- **Tilkoblingen avgjør organisasjonen.** Ingen organisasjons-id sendes noe sted.
- **Ingenting dikter pluginen opp.** Mangler en kilde, står det som en markør.
- **Mot Kasus er alt lesing.** Ingen status endres, ingenting løftes, ingenting
  forkastes — også når innloggingen din ville tillatt det. Det pluginen skriver, skriver den til disk i ditt eget repo:
  forslagene i `./artikler`, kvitteringen i `.claude/kasus-state.json`.

Vil noen ha begrunnelsene bak dette framfor reglene, ligger de i
[`references/principles.md`](../../references/principles.md).
