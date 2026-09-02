# Prinsipper for kasus-pluginen

## 0. Én ting

Pluginen gjør én ting: nye radarsignaler → journalisten velger → sjekk mot egne
artikler → bredt søk → saksforslag → kvittering. Ikke en samling oppslagsverktøy
rundt et API. En kommando som «også kunne vært nyttig» konkurrerer med saksløpet om
oppmerksomheten, og en journalist som må velge verktøy før hun velger sak har fått
ett problem ekstra.

Saksløpet bor i **én** fil: ferdigheten `skills/dybdeartikkel/SKILL.md`. Den er en
ferdighet og ikke en kommando fordi den da trigges av bestillingen selv («jeg
skal skrive en dybdeartikkel»), så journalisten slipper å vite navnet på et
verktøy før hun vet hva hun vil skrive — og fordi en ferdighet også kan velges
med vilje, som `/kasus:dybdeartikkel`.

Det fantes en `/kasus:start` som bare pekte hit, og den var borte en periode: en
kommando som videresender er et hopp som kan gå feil uten å gi noe tilbake. Den
finnes igjen, og gjør noe annet enn å peke — den **bearbeider grunnlaget valget
tas på**, og spør hvilken ferdighet som skal ta over. Det er forskjellen på et
hopp og en inngang: den gir noe tilbake selv om ingen svarer på spørsmålet.

Grensa håndheves framfor å være et løfte: ingen kommando kaller `kvitter`, og
ingen kommando sender ut `kasus-researcher`. En kommando som gjorde researchen
ville hatt egne steg som kan drifte fra ferdighetens, og da er det to
arbeidsflyter.

Prisen for fritekst-inngangen er at saksløpet kan starte uten at noen skrev en
skråstrek, og saksløpet både skriver til disk og flytter kvitteringen. Derfor står
grensa i ferdighetens egen beskrivelse og i steget før steg 1: et spørsmål om hva
som ligger der («er det noe nytt?») er `kasus-lookout`, ikke et saksløp.

### To opphav, ett format

`oppfolgersak` er den andre ferdigheten, og den ser ut som et brudd på avsnittet
over. Den er det ikke: den gjør ikke noe annet, den **starter et annet sted**. En
oppfølger på redaksjonens egen sak har vinklingen ferdig og trenger bare det nye,
mens saksløpet må finne begge — det er to ulike jobber, og en arbeidsflyt som skulle
gjort begge ville spurt «har du et signal eller en artikkel?» som første steg.

Grensa som holder det til én ting: begge skriver **samme format**
(`references/proposal-format.md`), bruker **samme agenter** og **samme premisser**
fra profilen. Det som er felles bor ett sted. Ville en tredje ferdighet delt
mindre enn det, er den et nytt produkt og ikke et nytt opphav.

### Hjelpen er ikke et tredje opphav

`hjelp` er den tredje ferdigheten, og avsnittet over ville forbudt den hvis den
lagde noe. Den lager ingenting: den henter ikke fra API-et, skriver ikke til disk,
kvitterer ikke, og gjør ingen research. Den er **kartet over inngangene**, og den
finnes fordi fritekst-inngangen har en kostnad ingen kommandoliste har — når
ingenting HETER noe man må huske, er «hvordan bruker jeg denne?» et reelt
spørsmål, og det spørsmålet skal ikke starte et saksløp.

Grensa som holder den til én ting: hjelpen **svarer og gir slipp**. Den forklarer
inngangen og tilbyr å starte den; den utfører den ikke. Skulle hjelpen begynne å
hente signaler «bare for å vise hvordan det ser ut», er den blitt det alternative
stedet å gjøre jobben som dette prinsippet handler om — derfor er et API-kall fra
`skills/hjelp/SKILL.md` en rød test i `/kasus:test`, ikke en smakssak.

Prisen er at hjelpen kan drifte fra pluginen: en ny kommando eller agent oppdages
fra mappa og sier ikke fra noe sted, så et kart som mangler en inngang lar
journalisten konkludere med at inngangen ikke finnes. Det er derfor selvtesten
krever at hjelpen nevner hver kommando, agent og ferdighet som faktisk finnes.

Radaren hadde forøvrig den egne artikkelen som førsteklasses utgangspunkt før
pluginen hadde det: `origin: own_followup` ER et oppfølgingssøk på en egen sak.
Ferdigheten gir journalisten den samme inngangen manuelt, for de sakene radaren
ikke søkte på.

`/kasus:start` er rent LESENDE — kvitterer ikke, skriver ingenting, gjør ingen
research. En kommando som ikke kan utføre arbeid kan ikke bli et alternativt sted
å gjøre det.

### Inngangen bearbeider, ferdigheten prioriterer

Inngangen la lenge fram signalene slik radaren fant dem, og lot journalisten
konsolidere i hodet: er disse tre den samme SSB-saken? har vi ikke skrevet om det
der? Det er arbeid, og det er arbeid en maskin kan gjøre først — så nå gjør den
det. `kasus-triage` sveiper **hele** signalvinduet og **alle** de publiserte egne
artiklene, slår sammen signalene som er samme sakskompleks, og gir hver kandidat en
foreløpig dekningsdom. Lista journalisten møter er luket, ikke rå.

Prisen er tid: et par minutter framfor et halvt, fordi tre hundre elementer skal
leses. Den prisen betales én gang om morgenen, og alternativet var at journalisten
betalte den selv, hver gang, uten å vite hva han ikke fikk se. Derfor finnes det
heller ingen rask vei rundt: to statuser ville betydd at man må velge modus før man
velger sak, og det er dette prinsippet en gang til.

To grenser holder det fra å bli et halvt saksløp:

- **Vinduene ligger i agentens kontekst, ikke i samtalens.** Kommandoen henter
  ikke `signals` eller `articles` selv — det er en test, ikke et løfte. Hadde den
  gjort det, hadde forarbeidet vært gratis i tid og dyrt i det eneste som er
  knapt.
- **Agenten prioriterer ikke.** Den sorterer på dekningsstatus, ikke på
  redaksjonell verdi, fordi profilen ikke hentes her. Rangeringen mot
  `criteria.patterns` er ferdighetens første egne arbeid, og en rangering fra
  inngangen ville sett lik ut og vært magefølelse med tall på.

Ferdigheten kjører fortsatt sitt eget steg 1, men **arver** konsolideringen og
dommene fra samtalen framfor å utlede noe annet av det samme materialet: to ulike
inndelinger av de samme signalene i samme samtale er verre enn én, fordi ingen kan
se hvilken som gjelder.

Den **spør** til slutt hva journalisten vil gjøre. Grensa som holder: spørsmålet
gjelder hvilken INNGANG, ikke hvilken sak. Valget av sak hører i ferdigheten, der
et valg fører til research, en fil på disk og en kvittering — og velger
journalisten saksløpet, kjører ferdigheten **sitt eget steg 1** framfor å arve
dataene fra kommandoen. Det koster ett kall, og alternativet er at saksløpet har
to ulike start-tilstander å virke i.

Profilen hentes derfor ikke i kommandoen. Den er premisset for å prioritere og
skrive, ikke for å velge hva man vil gjøre, og en inngang som hentet den ville
vært et halvt saksløp.

Det fantes en `/kasus:signals` som gjorde halvparten av dette. Den er borte
framfor å stå ved siden av: to steder å ta morgenens blikk er samme feil som to
steder å kjøre saksløpet. Oppslagsformen den hadde — `--pattern`, `--gamle`,
`--kategori` — var alltid bedre stilt som et spørsmål, og `kasus-lookout` bygger
de filtrene selv.

Det er derfor `/api/v1/story-briefs` ikke er i bruk: et ferdig vurdert saksforslag
fra pipelinen er et alternativt utgangspunkt, og to utgangspunkt i samme
arbeidsflyt betyr at ingen av dem blir fulgt til ende.

## 1. Nøkkelen avgjør organisasjonen — si det

API-et er org-scopet av API-nøkkelen. Ingen organisasjons-id sendes. Derfor er
«ingen signaler» aldri et utsagn om Kasus, bare om denne organisasjonen, og en
404 er ikke det samme som slettet. Hver header-linje oppgir installasjon og
nøkkel-variabel, slik at svaret er etterprøvbart.

## 2. Ingen stille fallbacks

Mangler konfigurasjon, stopper kallet med et synlig `MANGLER: …`. Base-URL-en er
den ENESTE verdien som defaulteres, og kilden rapporteres som
`default (app.kasus.io)` framfor et variabelnavn — det skal være synlig at ingen
konfigurasjon lå bak. Et ugyldig satt flagg eller en ugyldig satt variabel er en
feil, ikke en grunn til å bruke defaulten.

## 3. Ingen credentials i output

API-nøkkelen ekkoes aldri — heller ikke i feilmeldinger eller oppsummeringer. Den
refereres ved variabelnavn og rapporteres som `(satt)`. Hemmelig-navngitte nøkler
i API-svarene maskeres i dybden, men ikke bredere enn nødvendig: `keyFigures` og
`keyStats` er redaksjonelle data, ikke hemmeligheter, og en for bred regel ville
tømt saken for tall uten å si fra.

## 4. Read-only, og garden er FRAVÆRET av en kodesti

API-et har ingen skrivende ruter, og verktøyet har ingen kodesti for annet enn
GET — metoden er ikke en parameter noe sted. Enhetstestene håndhever det, og
`/kasus:test --live` verifiserer at **serveren** avviser POST, ikke bare at
pluginen ikke prøver. Det pluginen skriver, skriver den til disk i ditt eget repo.

## 5. Ingenting oppdiktet

Dette er prinsippet som skiller et brukbart utkast fra et farlig. Et faktum uten
kilde, et sitat som er «omtrent riktig», en URL som ikke er hentet — alt tre gjør
teksten mer ferdig å se på og mindre sann. Alternativet er en markør:
`[TRENGER VERIFISERING: …]`, `[SITAT MANGLER: …]`, eller en tom seksjon i
researchnotatet. Hull skal være synlige, ikke utfylt.

## 6. Profilen er premisset, ikke et vedlegg

Research og skriving hentes ned til redaksjonens nivå av `targetAudience`, formen
av `editorialProfile` og `whatWorks`, og avgrensningen av `whatToAvoid` og
`keywords`. Uten profilen blir resultatet generisk — og da skal det sies at
profilen mangler, framfor å levere generisk stoff som om det var tilpasset.

## 7. Klipp lesbart, `--json` klipper ikke

Menneskelig output klipper lange felt og sier at den klipper. `--json` klipper
ingenting, fordi et artikkelutkast trenger hele `plot` og `angle`. Et tak som nås
uten å bli nevnt leses som at det ikke finnes mer.

## 8. «Ingen treff» er ikke «ikke dekket»

Artikkel-API-et har ingen tekstsøk, så «har vi skrevet om dette før?» kan ikke
stilles til serveren. Verktøyet henter et vindu av de nyeste egne artiklene, og
`kasus-archivist` leser det. Det er en nyttig sjekk og en dårlig garanti,
og forskjellen må stå i svaret — ikke i dokumentasjonen. Derfor rapporteres
vindusstørrelsen, og hver kandidat bærer artikkel-id, dato og url.

Vurderingen er semantisk fordi spørsmålet er det: samme sak kan være skrevet med
helt andre ord. Her sto det idf-vektet ordoverlapp før, og den svarte nei på
nettopp de tilfellene. Kostnadene er asymmetriske — å vise en artikkel som ikke
var samme sak koster tretti sekunders lesing, å skjule en publisert sak koster en
dublett på nett.

Prisen er at sjekken ikke er reproduserbar, og den prisen skal ikke skjules. Den
betales med etterprøvbarhet: id, dato og url på hver kandidat, og en begrunnelse
som sier hva som er likt OG hva som skiller. Vindusgrensen er den andre halvparten
av forbeholdet, og den forsvant ikke med ordmatchen — den er en egenskap ved
API-et.

Dommen felles to ganger, og bare den ene klarerer. `kasus-triage` feller en
**grovsortering** i inngangen, på signalets tittel og sammendrag, for alle saker
på én gang — nok til å luke en åpenbar dublett og finne den egne saken en
oppfølger kan bygge på. `kasus-archivist` feller **dommen** i steg 4a, for én
valgt sak, med hele signalet. Steg 4a kjører uansett hva grovsorteringen fant, og
et `ÅPEN` derfra er et fravær av treff på tittelen — ikke en klarering. Kostnadene
er asymmetriske, og det er hele grunnen til at det er to nivåer framfor ett.

Begge leser de fire dommene fra `references/dekningsdom.md`. Sto tabellen i begge
agentene, ville de drevet fra hverandre uten at noe sa fra, og `OPPFØLGING` ville
betydd én ting i inngangen og en annen i saksløpet. At begge leser den, er en
test.

## 9. Kvitteringen er eksplisitt, og bare ett steg skriver den

«Nytt siden sist» krever at noe husker når sist var. Det ligger i
`.claude/kasus-state.json` i brukerens eget repo, og **bare `kvitter` skriver
det**. `nytt` leser. En oversikt som kvitterte seg selv ville betydd at et
avbrutt kall — eller et saksløp som ble avbrutt av noe viktigere — mistet en hel
dags signaler uten at noe sa fra.

To ting følger av at kvitteringen er et tidspunkt:

- **Etterslep.** Et signal kan indekseres etter at det ble oppdaget. `nytt` ser
  derfor to timer bakover FORBI kvitteringen, og undertrykker det som alt er vist
  ved id. Overlappen er usynlig, og et sent-ankommet signal blir likevel sett.
- **En full kvittering svelger det du ikke fikk se.** Derfor finnes
  `--ids-only`: den kvitterer for de sakene som faktisk ble behandlet og lar
  tidspunktet stå. Det er det riktige svaret på et halvferdig saksløp, og
  outputen sier hvilken av de to som ble gjort.

Nøkkelen havner aldri i fila. Organisasjonene skilles med et forkortet SHA-256 av
nøkkelen — en enveis-sjekksum som ikke kan autentisere noe, men som hindrer at to
redaksjoner i samme repo arver hverandres «siden sist».
