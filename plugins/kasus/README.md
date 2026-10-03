# kasus

Fra radarsignal til saksforslag, for en journalist i Claude Code. **Én
arbeidsflyt** — ferdigheten `dybdeartikkel` — og den gjør seks ting i rekkefølge:

1. Henter radarsignalene som har kommet inn **siden forrige saksløp**, pluss
   premissene: profilen og **ukas egen produksjon**
2. Legger fram en prioritering — **du velger saken**, og kan be om hele lista
   framfor bare de fire øverste
3. Sjekker saken mot **redaksjonens egne artikler**: skrevet før? noe å bygge på?
4. Gjør et **bredt søk** for å utvide og etterprøve
5. Skriver et **saksforslag** på disk, i redaksjonens tone
6. Kvitterer, og går til neste sak

Prosessen er laget for å gjentas rett etter hverandre: kjør saksløpet, ta én sak,
kvitter, kjør igjen.

**Det finnes ingen kommando for å starte den, og det er med vilje.** Saksløpet er en
ferdighet, så den trigges på fritekst — «jeg skal skrive en dybdeartikkel», «finn
meg en sak å skrive», «jeg trenger noe å jobbe med i dag», «kjør saksløpet», «lag et
saksforslag på dette signalet». Vil du starte den med vilje, er
`/kasus:dybdeartikkel` den samme ferdigheten valgt fra menyen. Stegene står ett
sted: [`skills/dybdeartikkel/SKILL.md`](./skills/dybdeartikkel/SKILL.md).

**Kommer bestillingen som et tema** — «skriv en dybdeartikkel om strømpriser» —
matches temaet først mot radarens vindu, semantisk, fordi radarens søk bare er et
ordsøk og et tema derfor ikke er et filter. Vinduet er da ikke «siden sist»:
kvitteringen svarer på hva DU har sett, mens spørsmålet er hva radaren har på
temaet, så saksløpet leser sju døgn og sier for hvert treff om det er nytt eller alt
sett. Finner radaren ingenting, sies det — og det betyr ikke at det ikke finnes en
sak, bare at temaet ligger utenfor mønstrene radaren søker på.

**Men da stopper saksløpet: signalet er inngangsvilkåret.** Ingen saksløp uten et
signal, og ingen fil på disk uten `kasusSignalId` — heller ikke når temaet
åpenbart er en god sak. Sporet tilbake til hvorfor saken ble tatt opp er halve
verdien av forslaget; et signal ER kilder, mens et tema bare er et nettsøk hvem
som helst kunne gjort; og kvitteringen gjelder signaler, så en sak uten ett kan
ikke kvitteres og kommer igjen. Tilbudet er derfor et bredere vindu, eller en
dekningssjekk som sier om det finnes en egen sak å ringe videre på — ikke et
saksforslag på tynt grunnlag.

Grensa mot agentene er **hvem som vil jobbe**. «Er det noe nytt?» er et spørsmål
om hva som ligger der — det svarer `kasus-lookout` på, uten å kvittere. Saksløpet
researcher, skriver til disk og flytter kvitteringen, og skal derfor ikke starte
fordi noen lurte på om det var noe.

Dataene kommer fra **Kasus' MCP-server**, som er read-only — ingen status i
Kasus endres. Det pluginen skriver, skriver den i
prosjektet:
saksforslagene i `./artikler`, kvitteringen «siden sist» i
`.claude/kasus-state.json`. Begge stiene er relative til der du står, så to
prosjekter teller sine egne saksløp.

## Kom i gang

Pluginen hører til **prosjektet** — redaksjonens eget repo, der artiklene,
saksforslagene og kvitteringen ligger. Da følger den med repoet, og hvilken
versjon som gjelder står i git framfor i en maskin.

1. Installer med **prosjekt-scope**, i prosjektmappa. `--scope project` er
   poenget: uten det havner oppføringen i din egen `~/.claude/settings.json`, og
   da har du pluginen mens redaksjonen ikke har den.

   ```bash
   claude plugin marketplace add dtb-digital/kasus-plugin --scope project
   claude plugin install kasus@kasus --scope project
   ```

   Begge skriver til prosjektets `.claude/settings.json` — **sjekk fila inn.**
   Dette er hva de skriver, hvis du heller vil sette det selv:

   ```json
   {
     "extraKnownMarketplaces": {
       "kasus": {
         "source": { "source": "github", "repo": "dtb-digital/kasus-plugin" }
       }
     },
     "enabledPlugins": { "kasus@kasus": true }
   }
   ```

   De tre scopene: `project` er fila over, som deles; `local` er
   `.claude/settings.local.json`, som er prosjektet men bare deg; `user` er
   `~/.claude/settings.json`, deg på tvers av prosjekter, riktig bare hvis du
   bruker Kasus i repoer som ikke skal dele oppsett.

2. Start sesjonen på nytt i prosjektmappa — marketplacet hentes, pluginen
   installeres, og komponentene og MCP-tilkoblingen til Kasus plukkes opp ved
   oppstart.
3. **Logg inn**: `/mcp` → `plugin:kasus:kasus` → **Authenticate**. Du logger inn
   med Kasus-kontoen i nettleseren, og har du flere organisasjoner, velger du den
   redaksjonen pluginen skal jobbe for. Ingen API-nøkkel, og ingenting å lime inn.
   Tilkoblingen kan kobles fra i Kasus under **Innstillinger → Tilkoblede apper**.
4. Verifiser: `/kasus:env` — den sier hvilken organisasjon du er logget inn i.
5. Kom i gang: `/kasus:start` går gjennom alt som ligger der, bearbeider det, og
   spør hva du vil gjøre. Vet du det alt, si det i stedet — «jeg skal skrive en
   dybdeartikkel»

Neste person som kloner repoet trenger bare å logge inn — resten står i
`.claude/settings.json`.

**Fra en tidligere versjon med API-nøkkel?** `KASUS_API_KEY` brukes ikke lenger, og
kan fjernes fra `env` (`/kasus:env` sier fra om den står der). Kvitteringen er nå
nøklet på organisasjonen framfor nøkkelen, så første saksløp etter oppgraderingen
ser 24 timer tilbake.

## Inngangene

| Inngang | Gjør |
|---|---|
| **fritekst** — «jeg skal skrive en dybdeartikkel», «finn meg en sak å skrive» | **Hele arbeidsflyten.** Ferdigheten `dybdeartikkel` trigges av bestillingen selv, uten at noen må huske et kommandonavn. |
| `/kasus:dybdeartikkel` | Samme ferdighet, startet med vilje fra menyen. Tar `--hours 72` for et bredere vindu, og «ta med det som er forkastet». |
| **fritekst** — «skriv en oppfølger på saken om X», «hva har skjedd siden vi skrev om dette?» | **Oppfølger på en egen sak.** Ferdigheten `oppfolgersak` — se under. |
| `/kasus:oppfolgersak` | Samme ferdighet, startet fra menyen. |
| **fritekst** — «hvordan bruker jeg denne?», «hva kan kasus?», «hjelp» | **Forklaring, ikke arbeid.** Ferdigheten `hjelp` — hvilken inngang som hører til hvilken jobb, hva ordene i outputen betyr, og hva som er galt når noe ikke virker. Også `/kasus:hjelp`. |
| `/kasus:start` | **Kom i gang.** Henter **siste døgn av alt materialet** — radarsignalene, Kasus' egne story-briefs og deres egne ferske saker, eller helt tilbake til forrige kvittering om det er lenger siden — legger det fram slik det ligger, og **spør hva du vil gjøre**: en oppfølger, en dybdeartikkel, eller et spørsmål. `--hours 72` overstyrer. Svaret sender deg videre i riktig ferdighet. **Bearbeider ingenting**, kvitterer aldri, skriver ingenting, gjør ingen research. |
| `/kasus:env` | Sjekker oppsettet, og hvilken organisasjon du er logget inn i. `--resolve` sier hvilken installasjon tilkoblingen går mot og hvor kvitteringen ligger. |
| `/kasus:test` | Selvtester pluginen. `--live` også tilkoblingen til Kasus. |

Arbeidet skjer i ferdighetene. `/kasus:start` er inngangen for den som ikke har
bestemt seg: den legger fram grunnlaget valget tas på, og spør. Der går grensa —
den kan spørre, men ikke utføre. Velger du saksløpet, kjører **ferdigheten** sitt
eget steg 1; kommandoen prøver ikke å gi den dataene sine, og profilen hentes ikke
der, fordi en inngang som hentet premissene ville vært et halvt saksløp. De to
siste er diagnostikk.

**Inngangen henter, agentene bearbeider.** `/kasus:start` legger materialet fram
slik det ligger — se [«Alt materialet, før du velger»](#alt-materialet-før-du-velger).
Vil du ha det konsolidert og luket, er det ett steg til:
[«Lista kan lukes, hvis du ber om det»](#lista-kan-lukes-hvis-du-ber-om-det).

Et **spørsmål** trenger heller ingen kommando: «er det noe om strømpriser?», «hvor
mange signaler er det på mønsteret X?» går rett til `kasus-lookout`, som bygger
filtrene selv. Det var oppslagsformen den gamle `/kasus:signals` hadde, og den er
bedre stilt som et spørsmål.

`hjelp` er den samme regelen en gang til: den forklarer inngangene og gjør ingen
av jobbene. Prisen for at ingenting har et kommandonavn man MÅ huske, er at
«hvordan bruker jeg denne?» er et reelt spørsmål — og det er et spørsmål **om**
pluginen framfor en bestilling **til** den, så det skal ikke starte et saksløp. Den
henter ingenting fra Kasus, kvitterer aldri, og tilbyr å starte riktig inngang
framfor å gjøre arbeidet selv. At den nevner hver kommando, agent og ferdighet
som faktisk finnes, er en test i `/kasus:test`: komponentene oppdages fra mappa,
så en ny inngang blir ellers bare usynlig i kartet.

## Oppfølger på en egen sak

`oppfolgersak` starter der saksløpet slutter: på en artikkel redaksjonen alt har
publisert. Vinklingen finnes, leserne kjenner saken, og det som mangler er **det
nye**. Det er ofte den billigste gode saken redaksjonen kan gjøre — og den
farligste å gjøre dårlig, for en oppfølger uten noe nytt er den samme saken
publisert to ganger.

Derfor har den sitt eget inngangsvilkår, like hardt som signalet er i saksløpet:
**ingen oppfølger uten et nytt faktum med kilde og dato.** «Saken er fortsatt
viktig» og «det har gått en måned» er ikke noe nytt. Finner den ingenting,
stopper den og sier hva som ville gjort det til en sak — hvilket tall som kommer,
når, eller hvem som må ha bestemt seg.

Den leser artikkelen i full tekst (`article <id>` gir alltid brødteksten), henter
premissene fra profilen, og spør så tre ting:

1. **Har radaren funnet noe?** Oppfølgingssøkene (`origin: own_followup`) er
   oppfølgingssøkene: kilder på redaksjonens egne saker, med egne domener
   utelatt — altså andre kilder enn artikkelen selv. Hele vinduet leses også,
   fordi et fritt temasøk kan gjelde saken uten at radaren visste det.
2. **Har vi alt fulgt den opp?** `kasus-archivist` med spørsmålet «har vi alt
   fulgt opp denne saken?». Agenten får beskjed om å se bort fra artikkelen selv
   — den ligger i vinduet og er det sterkeste `SAMME SAK`-treffet som finnes.
3. **Hva er det nye?** Fire slag, og de er ikke like sterke: et **nytt tall**
   (samme måling, ny periode), en **ny handling** (vedtak, klage, granskning),
   **konsekvensen** (det saken varslet om — skjedde det?) eller **løftet** (det en
   aktør lovet i saken — er det holdt?). Det siste er den sterkeste oppfølgeren
   som finnes, og den ingen andre kan gjøre: den forutsetter at man har den
   forrige saken, og sitatet står i brødteksten.

Researchen har **datogolv**: artikkelens egen publiseringsdato. Uten det kommer
agentene tilbake med kildene den forrige saken var bygget på, og seks rapporter
som bekrefter det du visste er verre enn ingen — de ser ut som funn.

Forslaget skrives i samme format som saksløpet, med `kategori: egen_oppfolging`,
`kasusArtikkelId` framfor `kasusSignalId`, og en påkrevd seksjon **«Den forrige
saken»**: hva den slo fast, sitatet som etterprøves, og hva som er nytt. Det er
den seksjonen som lar en redaktør se forskjellen mellom en oppfølger og en
gjentakelse på tretti sekunder.

## De fire kategoriene

Hvert signal merkes med hva det faktisk er. De krever ulike tiltak, og i rå
felt ser de like ut — `origin` og `type` må leses samtidig, og begge
oppfølgingssøkene lagrer funnene som `market_signal`:

| Kategori | Hva du har i hånda | Tiltaket |
|---|---|---|
| **Oppfølging av EGEN sak** | Nye kilder på noe redaksjonen alt har publisert. Egne domener er utelatt fra søket. | Ofte den billigste gode saken: vinklingen finnes, det som mangler er det nye. |
| **Oppfølging av KONKURRENTSAK** | Andre kilder på et sakskompleks en konkurrent har tatt. Konkurrentens domener er utelatt. | *Ikke* artikkelen deres — kilder å bygge en egen sak på. Hastverk med et forsprang. |
| **Konkurrentsak direkte** | Konkurrentens egen sak, fra en overvåket forside. | Ikke et søketreff og ikke research. Følges den opp, starter researchen på null. |
| **Fritt temasøk** | Søketreff på et tema, hentet **uavhengig av publiseringstidspunkt**. | Sjekk publisert-datoen før du prioriterer. Her ligger støyen, og de gamle sakene. |

**Ferskhet er to tall.** `detectedAt` er når radaren fant signalet,
`publishedDate` er hvor gammel saken er. Et temasøk kan levere en artikkel fra 2023 som «oppdaget for
45 min siden», så saksløpet viser begge og merker `GAMMEL SAK` når de er mer enn en
uke fra hverandre. Mangler datoen, står det «ukjent dato» — ikke «fersk».

## Alt materialet, før du velger

`/kasus:start` svarer på ett spørsmål: **hva har vi å jobbe med i dag?** Den henter
fire ting i samme melding — **siste døgn** av hver — og legger dem fram slik de
ligger:

| Kilde | Vindu | Peker mot |
|---|---|---|
| **radarsignalene** | `V`, maks 100 | en **dybdeartikkel** — noe andre har publisert, som dere ikke har |
| **Kasus' egne story-briefs** | `V`, maks 40 | forslagene innholdspipelinen alt har laget. Ikke etterprøvd av noen |
| **deres egne ferske saker** | `V`, maks 60 | en **oppfølger** — vinklingen finnes, det som mangler er det nye |
| **«nytt siden sist»** | mot kvitteringen | hva du ikke har sett før. Det ene som kjenner kvitteringen |

**`V` er døgnet som gulv, hevet til tiden siden du sist kvitterte.** Kjører du
kommandoen daglig, er det et døgn — perioden en journalist planlegger for, og kort
nok til at listene er et blikk framfor en utskrift. Har det ligget en uke, er det
en uke. `--hours N` overstyrer alt. Regelen står ett sted,
[`references/vindu.md`](./references/vindu.md), og at både inngangen og saksløpet
leser den derfra er en test.

Gulvet finnes fordi «nytt siden sist» måles mot kvitteringen mens listene måler i
timer. Var
listene alltid et døgn, ville «siden sist» kunne dekke fem døgn med signaler som
ikke fantes i lista de skulle merkes i — og de ville blitt usynlige, selv om
telleren hadde dem med.

**Er `V` et døgn, er tomt vanlig.** En redaksjon som ikke publiserte i går har ikke
sluttet å publisere, og pipelinen kjører i puljer. Et tomt felt er et fravær i
perioden, aldri et fravær i Kasus — og tiltaket er et bredere vindu, ikke en
konklusjon. **Perioden står alltid i svaret**, med det faktiske tallet.

**De tre listene måler tre ulike datoer** — `detectedAt` på et signal (når radaren
fant det), `createdAt` på en brief (når Kasus laget den), `published` på en egen
sak. «Ingenting siste måned» betyr derfor tre forskjellige ting, og kommandoen
sier hvilket.

**Kommandoen bearbeider ingenting, og det er et valg.** Er tre av signalene den
samme SSB-saken, står de som tre. Er saken skrevet i fjor, er det ikke merket.
Artiklene fra det siste døgnet svarer på «hva publiserte vi nå», aldri på «har vi
skrevet om dette før?» — det leses mot 200 artikler, av `kasus-archivist`, inne i
ferdigheten. Begge forbeholdene står i outputen framfor i denne README-en, fordi
et fravær ellers leses som en klarering.

Prisen er at journalisten ser materialet rått. Vil du ha det luket, er det ett
steg til — «rydd opp i signalene» — og det er avsnittet under.

## Lista kan lukes, hvis du ber om det

`kasus-triage` gjør forarbeidet du ellers gjorde i hodet, med sju linjer foran deg:
*er disse tre egentlig den samme SSB-saken? har vi ikke skrevet om det der i vår?*

Den sveiper **hele signalvinduet** og **alle de 200 nyeste publiserte egne sakene**,
og leverer tilbake:

- **kandidatsaker framfor signaler.** Signalene som er samme sakskompleks er slått
  sammen til én linje, med begrunnelsen for hvorfor. Tre kilder på det samme
  SSB-tallet er én sak med tre kilder, ikke tre halve — og et `temasok` som er
  siste ledd i en konflikt du fulgte forrige uke, hører til den konflikten.
- **en dekningsdom per sak.** `SAMME SAK`, `OPPFØLGING`, `FUNDAMENT`, `SAMME TEMA`
  eller `ÅPEN`, mot deres egne artikler — så det som alt er dekket står merket,
  og det som har en egen sak å bygge på står med lenke til den.
- **hva dere står i nå.** «Redaksjonen har publisert fire saker om dette siden
  mandag» — tallet, ikke tolkningen.

**Det dekkede skjules ikke, det merkes.** En sak du ikke får se kan du ikke
overprøve, og dommen er en lesing som kan bomme.

**Dommen derfra klarerer ingenting.** Den er en grovsortering på signalets tittel
og sammendrag: god nok til å luke en åpenbar dublett, ikke god nok til å avgjøre
at en sak skal skrives. Velger du saken, leser `kasus-archivist` det samme vinduet
på nytt med hele signalet — se [«Har vi dekket dette før?»](#har-vi-dekket-dette-før).

**Rekkefølgen er ikke en prioritering.** Agenten sorterer på dekningsstatus, fordi
profilen ikke hentes her. Rangeringen mot `criteria.patterns` er ferdighetens
første egne arbeid.

Prisen er tid: et par minutter, fordi tre hundre elementer skal leses. De ligger i
**agentens** kontekst og ikke i samtalens, og det er derfor det går an i det hele
tatt. Derfor er den også et eget steg: du ber om den når du vil ha bildet
bearbeidet — «rydd opp i signalene», «hva av dette har vi alt dekket?» — framfor å
betale for den hver gang du bare vil se hva som ligger der.

## Produksjonen siden sist, før du velger

Saksløpet henter de 40 nyeste publiserte sakene i **samme vindu som inngangen**
(`V` — se over), så det journalisten så i `/kasus:start` er det saksløpet jobber
videre på. Profilen sier hva som fungerer for disse leserne i prinsippet; dette
sier hva redaksjonen faktisk holder på med nå — og det er den andre en journalist
kjenner igjen.

Kjøres saksløpet daglig, er det en håndfull saker. Det er tynt som grunnlag for
«hva står vi i nå», og da skal det sies framfor å utvides i stillhet: «én sak siden
i går» er en opplysning, ikke et hull.

Tre koblinger endrer prioriteringen, og radaren kjenner ingen av dem:

- **En oppfølging radaren ikke visste var en oppfølging.** Et fritt temasøk har
  `origin: null` og ser ut som støy — men handler det om noe som ble publisert i
  går, er det i praksis en oppfølging av egen sak. Ofte den billigste gode saken
  på lista.
- **Et tema redaksjonen står i nå.** «Fire saker om dette siden mandag» er et
  tall, ikke en tolkning. Om det er en grunn til å ta signalet eller la det ligge,
  avgjør journalisten.
- **En åpenbar dublett, fanget før valget** — framfor etter at en agent har lest
  to hundre artikler.

Vinduet er lite (~2 000 tokens) fordi det skal leses i samtalen og begrunne en
rangering du skal se. **Det erstatter ikke dekningssjekken:** sju døgn og 40 saker
kan svare på «hva holder vi på med», ikke på «har vi skrevet om dette før?».

Kom du hit fra `/kasus:start`, er koblingene alt funnet — mot 200 artikler framfor
40. Da arver saksløpet konsolideringen og dommene framfor å utlede noe annet av
det samme materialet, og bruker steget på det grovsorteringen ikke kunne:
rangeringen mot profilen.

## Hva du ser i tråden

Alt du får presentert har **én form**: tittel, én til to linjer om hva saken er,
og en klikkbar lenke. Ikke id-er, ikke `egen_oppfolging`, ikke feltnavn,
ikke argumentene pluginen kjørte med. Den formen er definert ett sted —
[`references/samtaleform.md`](./references/samtaleform.md) — og at hver
brukervendt del leser den derfra er en test i `/kasus:test`.

Grunnen er at en id ikke er en opplysning for den som skal velge en sak: den kan
ikke åpnes og ikke ringes, og den tar plassen til det som avgjør. Verktøyet
trenger den, du gjør ikke. **Etterprøvbarheten flyttes derfor til lenka og
datoen** — de gjør samme jobb bedre, siden en url kan åpnes på tretti sekunder.
Id-ene bæres videre i det som faktisk trenger dem: oppslag i Kasus,
kvitteringen, og frontmatteren i saksforslaget, som er redaktørens spor tilbake
til opphavet.

Det som IKKE forsvinner er forbeholdene, men de sies på norsk: perioden svaret
gjelder for, at ingenting her er et søk i alt, at et signal mangler lenke, at
saken er gammel selv om den kom inn i dag, og hvert hull i utkastet. Et forbehold
som ikke kan forstås er ikke et forbehold.

Er en liste lang, er den **nummerert** — «ta nummer 3» er håndtaket, framfor en
streng. Unntakene er diagnostikken (`/kasus:env`, `/kasus:test`), der
variabelnavnet er hele svaret, og de gangene du spør om id-en selv.

## «Har vi dekket dette før?»

For hver valgte sak vurderes signalet mot redaksjonens egne artikler. Det svarer
på tre ting samtidig: er saken skrevet før (ikke gjenta), finnes det en egen sak å
bygge videre på (billigere og bedre), og hvilken tone har redaksjonen på temaet.

**Dette er andre gang spørsmålet stilles, og bare denne gangen klarerer det.**
Grovsorteringen i `/kasus:start` leste alle sakene på tittel og sammendrag; her
leses én sak med hele signalet — `details`, aktørene, tallene, datoene. Steg 3
kjører uansett hva grovsorteringen fant, og et `ÅPEN` derfra er et fravær av treff
på tittelen, ikke en klarering. Kostnadene er asymmetriske: å vise en artikkel som
ikke var samme sak koster tretti sekunders lesing, å skjule en publisert sak koster
en dublett på nett. De fire dommene er definert ett sted, i
[`references/dekningsdom.md`](./references/dekningsdom.md), så de betyr det samme
begge steder.

**Søket i egne artikler er et ordsøk.** Spørsmålet kan derfor ikke stilles til
serveren. `kasus-archivist` henter i stedet et vindu på de 200 nyeste egne
artiklene — tittelfelt, emneknagger, ingress og dato, uten brødtekst — leser dem,
og bruker ordsøket som et tillegg for å nå lenger tilbake.

Vurderingen er semantisk, og det er poenget: «prisfall i Bodø» og «nedgang i
kvadratmeterprisen i Nordland» er samme sak for en leser og har ikke ett ord til
felles. Hver kandidat får én av fire dommer:

| Dom | Betyr |
|---|---|
| **SAMME SAK** | Samme hendelse, samme periode. Ikke skriv. |
| **OPPFØLGING** | Samme sakskompleks, men noe er nytt — et annet kvartal, en ny aktør. Skriv, som oppfølging. |
| **FUNDAMENT** | Dekker bakgrunnen, ikke nyheten. Bygg på den. |
| **SAMME TEMA** | Beslektet, ikke samme sak. Ingen dublettrisiko — men det er tonebeviset. |

Datoen avgjør oftere enn tittelen: signalet gjelder Q2, artikkelen fra i vår
gjelder Q1, og det er en sak framfor en gjentakelse. Står forskjellen i
brødteksten, hentes de avgjørende kandidatene i full tekst.

**Kladder er utenfor vinduet.** Ikke fordi de er uinteressante — en kladd på samme
tema er det mest verdifulle treffet sjekken kan gi, fordi den betyr at en kollega
alt skriver saken — men fordi alternativet ikke er «kladder er med». Kasus
sorterer upublisert bakerst, så i en blandet liste ville en redaksjon med 250
publiserte saker fått null kladder i et vindu på 200, mens en med 100 fikk alle
sine. Samme oppslag, ulikt svar. Utelatelsen er derfor eksplisitt — vinduet er
bare de publiserte — og kladdene er et eget oppslag.

Tre forbehold følger hvert svar, og de er ikke det samme:

- **Vindusgrensen.** **«Ingen treff» betyr «ikke blant disse artiklene»**, aldri
  «ikke dekket». En sak eldre enn vinduet, skrevet med andre ord, er usynlig for
  enhver vurdering — det er en egenskap ved lesingen, ikke ved vurderingen.
- **Kladdene.** «Ingen treff» er ikke «ingen jobber med dette».
- **At det er en vurdering.** Ikke en regning, og ikke reproduserbar. Derfor står
  dato og lenke på hver kandidat: dommen skal kunne overprøves på tretti
  sekunder, ved å åpne saken.

## «Siden sist»

Saksløpet måler mot en **kvittering**: tidspunktet forrige saksløp ble gjort, lagret i
`.claude/kasus-state.json`. Det er derfor den kan svare «tre nye signaler» framfor
«de 20 nyeste», og derfor den samme saken ikke kommer igjen tre ganger på en dag.

- **Bare kvitteringssteget skriver.** Å hente saksløpet flytter ingenting, så en
  saksløp som blir avbrutt mister ikke signalene sine.
- **Etterslep er tatt høyde for.** Neste saksløp ser to timer bakover forbi
  kvitteringen for å fange det som ble indeksert i etterkant, og undertrykker det
  du alt har sett.
- **Rakk du bare noen av sakene**, kvitteres de alene — resten er fortsatt nytt
  neste gang. Saksløpet sier hvilken av de to som ble gjort.
- Fila inneholder verter, organisasjoners slug, tidspunkter og id-er. **Ingenting
  som kan autentisere.** Organisasjoner skilles på slugen, installasjoner på
  verten. Legg den i `.gitignore`: kvitteringen er DITT saksløp, ikke redaksjonens, og en
  delt kvittering ville sagt at du har sett noe du ikke har sett.

## Agenter

De tre første finnes av samme grunn: **søket i Kasus er et ordsøk**, verken på
signaler eller artikler et semantisk søk. Et tema er ikke et filter — det må leses.
Agentene henter vinduet selv, så de hundre eller to hundre elementene blir liggende
i deres kontekst framfor i samtalens.

De trigges på naturlig språk. Du trenger ingen kommando for å spørre.

`kasus-lookout` besvarer **ett spørsmål om radarsignalene**: «er det noe nytt å
skrive om?», «er det noe om strømpriser?», «hva kom inn denne uka?», «hvor mange
oppfølginger av egne saker ligger der?». Den svarer med tittel, hva saken er, hvor
gammel den er og en klikkbar lenke per signal — og **kvitterer aldri**. Et spørsmål om hva
som ligger der skal ikke kunne spise saksløpet, så forbudet er håndhevet i
`/kasus:test` framfor å være et løfte i en prompt.

Den bygger sitt eget filter. Noe går til serveren (`status`, `type`, `origin`,
`hours`, `min_relevance`); resten gjør den på det som er hentet, fordi serveren
ikke kan uttrykke det:

| Spørsmålet | Hvorfor det ikke er et serverfilter |
|---|---|
| «er det noe fra konkurrentenes forsider?» / «hvor mye er temasøk?» | `origin` er `null` for begge, så kategorien krever at `type` leses samtidig |
| «finner radaren noe profilen ikke forklarer?» | fraværet av et mønstertreff kan ikke uttrykkes som et filter |
| «er det noe FERSKT å skrive om?» | `hours` måler når radaren fant signalet, ikke hvor gammel saken er |
| «hvor mye av det er gamle saker?» | `GAMMEL SAK` er pluginens egen utregning |
| «er det signaler vi ikke kan åpne?» | — |

**`hours` og publiseringsdatoen er ikke samme spørsmål.** Et fritt temasøk hentes
uavhengig av publiseringstidspunkt, så `hours: 24` kan gi en sak fra 2023 som ble
oppdaget i dag. Et signal uten publiseringsdato faller ut av datofiltrene, og
antallet oppgis: de er *ukjente*, ikke gamle.

Hvert svar sier hvor mange som passerte av hvor mange hentede, og hvilke filtre som
var i bruk — et filter på et avkortet vindu er ikke et søk.

`kasus-archivist` besvarer **ett spørsmål om redaksjonens egne artikler**. Den
velger vinduet spørsmålet krever, henter det selv, og svarer med tittel, dato og
url på hvert punkt — pluss forbeholdet om hva vinduet dekket. De 200 artiklene
blir liggende i agentens kontekst, ikke i saksløpets.

Saksløpet bruker den til «har vi skrevet om dette før?», som er den formen som har en
fast dom per kandidat. Men spørsmålet er ikke begrenset til det: spør du «hva har
vi skrevet om i dag?», «hvem hos oss dekker samferdsel?» eller «hvilken tone har
vi hatt på strømpriser?», er det samme agent — og for et spørsmål med tidsgrense
er svaret fullstendig framfor et utsnitt, fordi vinduet da kan dekke hele
perioden.

`kasus-triage` er den eneste som leser **begge** vinduene samtidig, og den eneste
som ikke besvarer et spørsmål: den bearbeider. Hele signalvinduet holdt mot alle de
200 nyeste publiserte egne sakene, signalene som er samme sakskompleks slått
sammen til kandidatsaker, og en foreløpig dekningsdom på hver. Den kjøres når noen
ber om den — «rydd opp i signalene» — og er det naturlige neste steget etter
`/kasus:start`, som bearbeider ingenting. Se
[«Lista kan lukes, hvis du ber om det»](#lista-kan-lukes-hvis-du-ber-om-det).
Den prioriterer ikke (profilen hentes ikke der) og **kvitterer aldri**, som ingen
av de andre.

`kasus-researcher` besvarer **ett** researchspørsmål: søker bredt, leser smalt,
går til primærkilden framfor omtalen, daterer alt, og skiller mellom bekreftet,
motstridende og ubekreftet. Saksløpet sender ut én per spørsmål, parallelt, maks
seks. Redaksjonens egne og konkurrentens domener er aldri et svar i seg selv.

## Tilkoblingen og variablene

Pluginen kobler til Kasus med `.mcp.json` i pluginroten: serveren `kasus`, over
HTTP, med innlogging (OAuth). Verktøyene heter `mcp__plugin_kasus_kasus__*`, og
kontrakten pluginen bygger på står i
[`references/kasus-mcp.md`](./references/kasus-mcp.md).

| Variabel | Påkrevd | Betydning |
|---|---|---|
| `KASUS_MCP_URL` | Nei | Default `https://app.kasus.io/api/mcp`. Sett den for staging eller egen installasjon — samme variabel styrer tilkoblingen og hvilken installasjon kvitteringen gjelder. |
| `KASUS_ARTICLES_DIR` | Nei | Default `./artikler`. Hit skrives saksforslagene. |
| `KASUS_STATE_FILE` | Nei | Default `.claude/kasus-state.json`, tolket fra der du står. Kvitteringen «siden sist» måles mot. |

Forutsetter Node 18+ på PATH, til kvitteringen. Den er avhengighetsfri ESM — ingen
`npm install`, ingen byggesteg — og har ingen nettverkskode.

## Det du bør vite før du stoler på outputen

- **Innloggingen avgjør organisasjonen.** Ingen organisasjons-id sendes. «Ingen
  signaler» betyr «ingen for denne organisasjonen», og «ikke funnet» betyr «finnes
  ikke ELLER tilhører en annen organisasjon».
- **Artikkel-sjekken er en vurdering av et vindu**, ikke et fulltekstsøk. Den er
  ikke reproduserbar, og vinduet er 200 artikler. Se over.
- **Listene fra Kasus klipper** lange tekstfelt; enkeltoppslagene gjør det ikke.
  Svarene er arbeidsmateriale — det som legges fram for deg er ryddet, se «Hva du
  ser i tråden».
- **Ingenting oppdiktes.** Mangler en kilde, står det
  `[TRENGER VERIFISERING: …]` eller `[SITAT MANGLER: …]` i forslaget framfor en
  plausibel setning. Antallet markører står i frontmatteren som `apenePunkter`.
- **Forslag er forslag.** Frontmatteren har `status: forslag` og
  `generertAv: claude-code/kasus-plugin`, også når teksten leser godt.

Prinsippene i sin helhet: [`references/principles.md`](./references/principles.md).
MCP-kontrakten: [`references/kasus-mcp.md`](./references/kasus-mcp.md).
Formatet på det som legges på disk:
[`references/proposal-format.md`](./references/proposal-format.md).

## Utvikling

```bash
claude --plugin-dir plugins/kasus                # last pluginen lokalt
bash plugins/kasus/scripts/self-test.sh          # selvtesten
node --test plugins/kasus/scripts/kasus/*.test.mjs   # bare enhetstestene
```

Nye kommandoer, ferdigheter og agenter registreres ikke noe sted — de oppdages
fra mappa, og krever omstart av sesjonen. **Legger du til en, skal den også inn i
`skills/hjelp/SKILL.md`** — selvtesten sjekker at hjelpen nevner alle inngangene
som finnes. En ferdighets `name:` må matche
MAPPENAVNET (`skills/dybdeartikkel/SKILL.md` → `name: dybdeartikkel`), ellers
lastes den ikke; selvtesten sjekker det. Endrer du kvitteringsverktøyets modi, oppdater `MODES` i
`scripts/kasus/kasus.mjs`; selvtesten sjekker at kommandoene ikke refererer til en
modus som ikke finnes, og at versjonen i `plugin.json`, `marketplace.json` og
verktøyet er den samme.
