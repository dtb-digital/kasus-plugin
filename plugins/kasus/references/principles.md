# Prinsipper for kasus-pluginen

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
