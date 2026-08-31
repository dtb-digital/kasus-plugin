# Prinsipper for kasus-pluginen

## 0. Én ting

Pluginen gjør vaktrunden: nye radarsignaler → journalisten velger → sjekk mot egne
artikler → bredt søk → saksforslag → kvittering. Ikke en samling oppslagsverktøy
rundt et API. En kommando som «også kunne vært nyttig» konkurrerer med runden om
oppmerksomheten, og en journalist som må velge verktøy før hun velger sak har fått
ett problem ekstra.

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

Artikkel-API-et har ingen tekstsøk, så «har vi skrevet om dette før?» besvares med
idf-vektet ordoverlapp mot et vindu av de nyeste egne artiklene. Det er en nyttig
sjekk og en dårlig garanti, og forskjellen må stå i svaret — ikke i
dokumentasjonen. Derfor rapporteres vindusstørrelsen, ordene som traff, hvor de
traff, og søkeordene som ikke finnes i noen egen artikkel.

Terskelen er en REGEL framfor et poengtall: to fellesord, eller ett i tittel,
stikktittel, undertittel eller emneknagg. Kostnadene er asymmetriske — å vise en
artikkel som ikke var samme sak koster tretti sekunders lesing, å skjule en
publisert sak koster en dublett på nett. «Styrke» i outputen er en
sorteringsnøkkel, og sier selv at den er det: et normalisert tall ville blitt lest
som en prosentvis likhet det ikke er.

## 9. Kvitteringen er eksplisitt, og bare ett steg skriver den

«Nytt siden sist» krever at noe husker når sist var. Det ligger i
`.claude/kasus-state.json` i brukerens eget repo, og **bare `kvitter` skriver
det**. `nytt` leser. En oversikt som kvitterte seg selv ville betydd at et
avbrutt kall — eller en runde som ble avbrutt av noe viktigere — mistet en hel
dags signaler uten at noe sa fra.

To ting følger av at kvitteringen er et tidspunkt:

- **Etterslep.** Et signal kan indekseres etter at det ble oppdaget. `nytt` ser
  derfor to timer bakover FORBI kvitteringen, og undertrykker det som alt er vist
  ved id. Overlappen er usynlig, og et sent-ankommet signal blir likevel sett.
- **En full kvittering svelger det du ikke fikk se.** Derfor finnes
  `--ids-only`: den kvitterer for de sakene som faktisk ble behandlet og lar
  tidspunktet stå. Det er det riktige svaret på en halvferdig runde, og
  outputen sier hvilken av de to som ble gjort.

Nøkkelen havner aldri i fila. Organisasjonene skilles med et forkortet SHA-256 av
nøkkelen — en enveis-sjekksum som ikke kan autentisere noe, men som hindrer at to
redaksjoner i samme repo arver hverandres «siden sist».
