# Dekningsdommen

«Har vi skrevet om dette før?» besvares to steder i pluginen, og svaret er den
samme firedelte dommen begge steder. Den står her framfor i hver av dem, fordi to
kopier av en dom driver fra hverandre uten at noe sier fra — og da betyr
`OPPFØLGING` én ting i inngangen og en annen i saksløpet.

Filen leses av `kasus-triage` og `kasus-archivist`. Ingen av dem skal definere
dommene på nytt.

## De fire dommene

| Dom | Betyr | Tiltaket for journalisten |
|---|---|---|
| **SAMME SAK** | Samme hendelse, samme periode, samme poeng. | Ikke skriv. Saken finnes. |
| **OPPFØLGING** | Samme sakskompleks, men noe er nytt — et annet kvartal, en ny aktør, et vedtak som har falt siden. | Skriv, men som oppfølging. Den gamle saken er utgangspunktet. |
| **FUNDAMENT** | Dekker bakgrunnen eller mekanismen, ikke nyheten. | Bygg på den. Ofte den billigste gode saken. |
| **SAMME TEMA** | Beslektet, men ikke samme sak. | Ingen dublettrisiko. Men det er tonebeviset — slik skriver redaksjonen om dette. |

Finnes det ingen kandidat i det hele tatt, er dommen **ÅPEN**: ingenting i vinduet
ligner. Det er et fullgodt svar, og det skal ikke pyntes med en fjern artikkel for
å ha noe å vise.

Rangér kandidatene etter **dublettrisiko**, ikke etter hvor godt de matcher:
SAMME SAK først, SAMME TEMA sist. Det er rekkefølgen dommen brukes i.

## Datoen avgjør oftere enn tittelen

Den vanligste feilen er å kalle en oppfølging for en dublett fordi titlene ser
like ut. Signalet gjelder Q2; artikkelen fra i vår gjelder Q1. Det er en sak, ikke
en gjentakelse. Sammenlign `details.publishedDate` på signalet med `published` på
artikkelen, og si periodene eksplisitt når de er poenget.

Den motsatte feilen er billigere, men ikke gratis: to saker om samme kvartal er
samme sak selv om den ene sier «Bodø» og den andre «Nordland».

## Begrunnelsen sier hva som er likt OG hva som skiller

«Handler om det samme» er ikke en dom — det er spørsmålet gjentatt. En dom uten
skillet er ubrukelig for den som skal overprøve den.

## Hver kandidat bærer id, dato og url

Vurderingen er semantisk, og det er med vilje: samme sak kan være skrevet med helt
andre ord, og en ordmatch svarte nei på nettopp de tilfellene (prinsipp 8).

Prisen er at dommen ikke er reproduserbar. Den betales med etterprøvbarhet —
artikkel-id, dato og url på hver kandidat, slik at den som spurte kan åpne saken
og overprøve deg på tretti sekunder. Du finner ikke opp en id, og du nevner ingen
artikkel du ikke har sett i `data`.

## «Ingen treff» er ikke «ikke dekket»

Artikkel-API-et har ingen tekstsøk, så dommen felles mot et VINDU av de nyeste
egne artiklene. En eldre sak er usynlig, og kladder er utenfor vinduet — så «ingen
treff» betyr heller ikke «ingen kollega jobber med dette».

Vindusgrensen står i `meta.forbehold` og skal gjentas ordrett. Er `meta.taketNådd`
sann, mangler svaret data, og det er den ene opplysningen som gjør en dom
ubrukelig hvis den utelates.

## To nivåer, og bare det ene klarerer

Dommen felles to ganger i et normalt saksløp, og de to er ikke likeverdige.

| | **Grovsortering** | **Dommen** |
|---|---|---|
| Hvem | `kasus-triage`, i `/kasus:start` | `kasus-archivist`, i steg 4a |
| Når | før journalisten har valgt | etter at én sak er valgt |
| Grunnlag | signalets tittel og sammendrag | hele signalet: `details`, `actors`, `keyFigures`, `publishedDate` |
| Omfang | alle saker i vinduet, én gang | én sak, i dybden |
| Brukes til | å rangere og å advare | å avgjøre om saken skal skrives |

**En grovsortering klarerer aldri en sak.** Den kan si «dette ser dekket ut» og
flytte saken ned på lista, men et `ÅPEN` derfra er ikke en klarering — det er et
fravær av treff på tittelen alene. Derfor kjører steg 4a uansett hva
grovsorteringen fant, og derfor får arkivaren vite hva den fant: kandidatene er et
utgangspunkt å gå dypere på, ikke et svar å gjenta.

Kostnadene er asymmetriske, og det er hele grunnen til at det er to nivåer: å vise
en artikkel som ikke var samme sak koster tretti sekunders lesing, mens å skjule en
publisert sak koster en dublett på nett.
