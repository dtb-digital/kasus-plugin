---
name: oppfolgersak
description: Lager en oppfølgersak på en av redaksjonens EGNE publiserte artikler — artikkelen er utgangspunktet, ikke radaren. Leser saken i full tekst, finner ut hva som har skjedd SIDEN den ble publisert (radarens egen_oppfolging-signaler, nye tall, nye aktører, løfter og prognoser som kan etterprøves), sjekker at redaksjonen ikke alt har fulgt den opp, og skriver et saksforslag på disk i samme format som saksløpet. Skal brukes når utgangspunktet er en egen sak: «skriv en oppfølger på saken om strømstøtte», «kan vi følge opp denne?», «hva har skjedd siden vi skrev om X?», «oppfølger på artikkel <id>», «vi skrev om dette i mars — er det noe nytt der nå?», «er det en oppfølger i denne saken?». Skal IKKE brukes når utgangspunktet er et radarsignal eller et tema uten egen sak — det er ferdigheten `dybdeartikkel` — eller når spørsmålet bare er «har vi skrevet om dette?», som `kasus-archivist` svarer på alene. Krever at det finnes noe NYTT som kan kildebelegges; finnes det ikke, stopper den og sier hva som ville gjort det til en sak.
---

En oppfølger på redaksjonens **egen** sak. Utgangspunktet er artikkelen, ikke
radaren, og det er hele forskjellen fra `dybdeartikkel`: vinklingen finnes alt,
leserne kjenner saken, og det som mangler er **det nye**.

Derfor er dette ofte den billigste gode saken redaksjonen kan gjøre — og den
farligste å gjøre dårlig. En oppfølger uten noe nytt er den samme saken publisert
to ganger, og det er leseren som merker det først.

## Vilkåret: noe NYTT som kan kildebelegges

**Ingen oppfølger uten et nytt faktum med kilde og dato.** Det er inngangsvilkåret
her, slik signalet er det i `dybdeartikkel`, og av samme grunn: uten det later
forslaget som det har et grunnlag det ikke har.

«Saken er fortsatt viktig», «temaet er aktuelt» og «det har gått en måned» er
**ikke** noe nytt. Finner du ingenting, stopper du — og sier hva som ville gjort
det til en sak: hvilket tall som kommer, når, eller hvem som må ha bestemt seg.
Det er et brukbart svar. Et forslag som later som en måned er en nyhet, er ikke.

## 1. Finn artikkelen, og les den

Har du en id, hent den i full tekst — `article` gir alltid brødteksten:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs article <artikkel-id> --json
```

Kjør **i samme melding** premissene, som er de samme som i saksløpet:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs profile --json
```

**Har du ikke en id** — «saken vi kjørte om strømstøtte i mars» — er det ikke et
søk du kan sende til serveren: artikkel-API-et har ingen tekstsøk. To veier:

- **Er saken fersk**, hent vinduet og finn den selv:
  `articles --kort --hours 720 --limit 100 --json`. Legg fram kandidatene med
  id, dato og lenke, og la journalisten peke — ikke velg artikkelen for henne.
- **Er den eldre eller vinduet stort**, spør `kasus-archivist`: «hvilken sak var
  det vi skrev om <tema>?». Den leser vinduet i sin egen kontekst og svarer med
  id, dato og url. Vinduet er de 200 nyeste, så en gammel sak kan være usynlig —
  si det framfor å konkludere at den ikke finnes.

Les så artikkelen ordentlig, og hent ut fire ting du skal bruke senere:

| Fra artikkelen | Brukes til |
|---|---|
| `published` | **datogolvet** for alt søk i steg 3 og 4 |
| tallene i teksten, med periode | er de nå erstattet av nyere tall? |
| aktørene, og hva de LOVET eller varslet | et løfte er den sterkeste oppfølgeren som finnes |
| tonen, mellomtitlene, nivået | dette er tonebeviset. Bedre enn noe `whatWorks` kan si — det er redaksjonens egen stemme på nettopp dette temaet |

`body` er lagret slik CMS-et leverte den (HTML fra Labrador, ren tekst fra de
andre), og `--json` gir feltet urørt. `excerpt` og `wordCount` er alltid regnet på
ren tekst.

## 2. Hva har skjedd siden? — radaren først

Radaren har en egen kategori for nettopp dette. Kjør begge i **samme melding**:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs signals --kort --kategori egen_oppfolging --hours 336 --limit 100 --json
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs signals --kort --hours 336 --limit 100 --json
```

Det første er oppfølgingssøkene: kilder radaren har funnet på redaksjonens egne
saker, med egne domener utelatt fra søket — altså **andre** kilder enn deres egen
artikkel. Det andre er hele vinduet, fordi `egen_oppfolging` peker på *en* egen
sak, ikke nødvendigvis denne: et fritt temasøk kan være det som faktisk gjelder
artikkelen din.

**Match selv, semantisk.** Signal-API-et har ingen tekstsøk, og artikkelen er
ikke et filter. Sammenlign mot tittel og sammendrag — samme sak kan være skrevet
med helt andre ord.

Fant du et signal som gjelder artikkelen, hent det i full bredde:
`signal <id> --json`. Da har du `details.actors`, `details.keyFigures` og
`publishedDate` — og et signal å kvittere for i steg 6.

Fant du ingen, er det ikke et nei. Radaren søker på redaksjonens mønstre og
kjører ikke oppfølgingssøk på alt. Da må det nye finnes i steg 3 og 4 i stedet, og
vilkåret over gjelder like fullt.

## 3. Har vi alt fulgt den opp?

Send ut **én `kasus-archivist`** med spørsmålet **«har vi alt fulgt opp denne
saken?»** — ordrett. En oppfølger av en oppfølger er en dublett, og den er
lettere å publisere enn man tror: den opprinnelige vinklingen er god, så den
holder til to saker som ser ulike ut i tittelen og like ut for leseren.

Gi agenten:

- **spørsmålet**, ordrett
- **plugin-roten** som absolutt sti: `${CLAUDE_PLUGIN_ROOT}` — skriv ut den
  faktiske verdien, ikke variabelnavnet
- **artikkelen**: id, tittel, dato, og hva saken slo fast
- **`--env <navn>`** hvis du kjører mot et annet miljø
- **beskjed om å se BORT fra artikkelen selv**: den ligger i vinduet, og den er
  det sterkeste `SAMME SAK`-treffet som finnes. Uten den beskjeden bruker agenten
  en kandidatplass på å fortelle deg at saken du følger opp finnes.

Dommen du er ute etter er `OPPFØLGING` på noe som er **nyere** enn artikkelen: da
er oppfølgeren alt gjort. `SAMME TEMA` er derimot bra å ha — det er mer tonebevis.

Ligger det en **kladd** på temaet, betyr det at en kollega alt skriver saken, og
det er det mest verdifulle treffet sjekken kan gi. Kladder er utenfor det vanlige
vinduet, så det er et eget oppslag: `articles --status D --limit 50`.

## 4. Bestem hva det nye ER

Fire slag oppfølgere. De krever ulike kilder, og de er ikke like sterke:

| Slaget | Hva du leter etter | Merk |
|---|---|---|
| **Nytt tall** | Samme måling, ny periode: nytt kvartal, ny måned, ny årgang. | Den enkleste, og den som lettest blir en notis. Krever at tallet faktisk er sammenlignbart med det i artikkelen — samme kilde, samme definisjon. |
| **Ny handling** | Et vedtak, en klage, en granskning, noen som gikk av. | Sterk. Har en dato og et dokument. |
| **Konsekvensen** | Det artikkelen varslet om: skjedde det? | Sterkest når artikkelen var konkret. Krever at du siterer hva den faktisk sa. |
| **Løftet** | Det en aktør lovet i artikkelen: er det holdt? | Den sterkeste oppfølgeren som finnes, og den ingen andre kan gjøre — den forutsetter at man har den forrige saken. Sitatet finnes i `body`. |

Velg **ett** som bærer saken. To parallelle «nye ting» blir to halve saker.

Kan ingen av de fire kildebelegges, **stopp her** etter vilkåret over. Si hvilket
av de fire som er nærmest, og hva som mangler: «dette blir en sak når SSB
publiserer Q3 den 15. november», eller «når utvalget har konkludert». Det er en
beskjed journalisten kan planlegge etter.

## 5. Bredt søk — med datogolv

Formulér **3–6 spørsmål**, ett per `kasus-researcher`, alle i samme melding.
Spørsmålene bygges av artikkelen:

1. Hvert tall i artikkelen: finnes det et nyere for samme måling?
2. Hver aktør: hva har de sagt eller gjort **etter** publiseringsdatoen?
3. Hvert løfte og hver prognose: holdt det?
4. Det artikkelen ikke svarte på, og som kan besvares nå.
5. Motargumentet — også mot den forrige saken. Ble den imøtegått?

**Hvert spørsmål har et datogolv, og det er artikkelens `published`.** Uten det
kommer agentene tilbake med kildene den forrige saken alt var bygget på, og seks
rapporter som bekrefter det du visste er verre enn ingen: de ser ut som funn.
Skriv datoen i prompten — «hva har skjedd med X **etter 2025-03-14**».

Hver agent får også:

- `targetAudience` og `editorialProfile` fra profilen
- **domenene som ikke er svar i seg selv**: organisasjonens eget `siteUrl` — og
  her gjelder det doblet, siden redaksjonens egen forrige sak er det søkemotoren
  helst vil gi deg. **Artikkelen er utgangspunktet, ikke en kilde til noe nytt.**

Sammenstill, og løs motstridene framfor å liste dem: si hvilken kilde som er
nærmest primærkilden, og hvorfor.

## 6. Skriv forslaget

Formatet står i `${CLAUDE_PLUGIN_ROOT}/references/proposal-format.md` — **les fila
før du skriver**. Bruk **oppfølger-varianten** av frontmatteren: `kategori:
egen_oppfolging`, `kasusArtikkelId`, `opprinneligUrl` og `opprinneligPublisert`,
og `kasusSignalId` bare hvis et signal faktisk ble brukt.

Tre ting kommer i tillegg til de vanlige kildereglene:

1. **Seksjonen «Den forrige saken» er påkrevd**, og den skal si hva artikkelen
   slo fast — med sitat der det er et løfte eller en prognose du etterprøver. Det
   er den seksjonen som gjør at en redaktør kan se forskjellen mellom en
   oppfølger og en gjentakelse på tretti sekunder.
2. **Vinklingen er det NYE, ikke temaet.** «Strømstøtten fortsetter å svekke seg»
   er temaet. «Tre måneder etter at kommunen lovet full kompensasjon, har 40 av
   210 husstander fått den» er en oppfølger. Står det gamle først i ingressen, er
   det en gjentakelse med ny dato.
3. **Tonen tas fra artikkelen selv** — den er redaksjonens egen stemme på nettopp
   dette temaet, og slår alt `editorialProfile` kan formulere generelt.
   `whatToAvoid` er fortsatt et forbud.

`egneSaker` i frontmatteren har artikkelen med `forhold: bygger videre på`, pluss
det dekningssjekken i steg 3 fant.

Si til slutt, i én setning: **er dette en oppfølger eller en gjentakelse?** Er du
i tvil, er svaret gjentakelse.

## 7. Kvitter, og rapporter

Ble et signal brukt, kvitter for det alene:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs kvitter --ids <signal-id> --ids-only
```

`--ids-only` flytter ikke kvitteringstidspunktet, så resten av radaren er
fortsatt nytt i neste saksløp. Ble det ikke brukt noe signal, er det **ingenting å
kvittere** — kvitteringen gjelder signaler, ikke artikler. Si det i én linje
framfor å røre den.

Rapporter kort:

- hvilken artikkel som var utgangspunktet, med dato og lenke
- **hva det nye er**, og hvilket av de fire slagene det er
- om redaksjonen alt hadde fulgt opp, og hva dekningssjekken dekket
- stien til saksforslaget, og **hvert hull**: `[TRENGER VERIFISERING]`,
  `[SITAT MANGLER]`, og hvem som må kontaktes
- om et signal ble kvittert, eller om det ikke fantes noe å kvittere

Ingenting publiseres. Forslaget legges på disk i dette prosjektet, og API-et er
read-only.
