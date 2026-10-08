# Saksforslaget — formatet på det som lagres i Kasus

Lastes av begge arbeidsflytene — `dybdeartikkel` (som starter på et radarsignal)
og `oppfolgersak` (som starter på en av redaksjonens egne artikler). **Ett
saksforslag per sak**, og det er hele leveransen: hva utgangspunktet er, hva
redaksjonen alt har skrevet om det, hva et bredt søk fant, hva som fortsatt
mangler, og et utkast som kan skrives videre på.

Grunnen til at det er ETT dokument og ikke et researchnotat pluss en artikkel: et
utkast som ligger for seg selv mister sporet tilbake til kildene, og en redaktør
som skal sjekke ett tall må da lete i to dokumenter. Her står tallet, kilden og
setningen som bruker det samme sted.

## Lagring

Forslaget lagres i Kasus, ikke som en fil — det er ingen lokale filer i
saksløpet. Kallet er:

```
create_story_proposal {
  "title":           "<foreslått tittel>",
  "content":         "<hele dokumentet under «Struktur», som markdown>",
  "category":        "egen_oppfolging | konkurrent_oppfolging | konkurrentsak | temasok | annet",
  "radar_signal_id": "<signal-id>",          // når et signal er opphavet
  "article_id":      "<artikkel-id>",        // når en egen artikkel er opphavet
  "metadata":        { … feltene under … }
}
```

Svaret har forslagets `id`. Hold den: skal noe endres i samme samtale, er det
`update_story_proposal { "id": …, … }` — `content` og `metadata` erstattes da i
sin helhet, så send hele dokumentet, ikke bare endringen. Lagre aldri det samme
forslaget to ganger.

Status er `proposal` når det lagres. `draft`, `final` og `dismissed` setter
journalisten selv, når hun ber om det.

## Metadata

```json
{
  "dato": "<ÅÅÅÅ-MM-DD>",
  "kasusSignalId": "<signal-id>",
  "signalUrl": "<URL-en signalet peker på>",
  "signalPublisert": "<publiseringsdato på kilden, eller «ukjent»>",
  "monster": "<matchedPattern, eller null>",
  "egneSaker": [
    {
      "id": "<artikkel-id>",
      "tittel": "<tittel>",
      "url": "<URL>",
      "publisert": "<ÅÅÅÅ-MM-DD>",
      "forhold": "bygger videre på | overlapper | samme sak — ikke skriv"
    }
  ],
  "kilderTotalt": <antall unike URL-er i KILDER>,
  "apenePunkter": <antall [TRENGER VERIFISERING] + [SITAT MANGLER] i teksten>,
  "generertAv": "claude-code/kasus-plugin"
}
```

`egneSaker` er treffene fra artikkel-sjekken, tom liste hvis ingen.

**Opphavet er påkrevd.** Feltene over er sporet tilbake til hvorfor saken ble tatt
opp, og et forslag uten dem er et notat uten opphav. Hvilke felt det er, avhenger
av hvilken arbeidsflyt som skrev det — og **ett av de to settene skal alltid være
utfylt.** Kasus avviser et forslag uten `radar_signal_id` og uten `article_id`.

| Utgangspunkt | Påkrevd | Skrevet av |
|---|---|---|
| Et radarsignal | `radar_signal_id`, og `kasusSignalId` + `signalUrl` i metadataene | `dybdeartikkel` |
| En egen artikkel | `article_id`, og `kasusArtikkelId` + `opprinneligUrl` + `opprinneligPublisert` i metadataene | `oppfolgersak` |

Oppfølger-varianten bytter `signal`-feltene for `artikkel`-feltene og har
`category: egen_oppfolging`. Ble det ALT brukt et signal i en oppfølger — radaren
hadde nye kilder på saken — står begge sett, og det er den beste varianten: to
spor er bedre enn ett.

```json
{
  "kasusArtikkelId": "<artikkel-id-en oppfølgeren bygger på>",
  "opprinneligUrl": "<URL til den egne saken>",
  "opprinneligPublisert": "<ÅÅÅÅ-MM-DD>",
  "nyhetenErAv": "nytt tall | ny handling | konsekvensen | løftet"
}
```

`nyhetenErAv` er påkrevd i oppfølger-varianten. Det er feltet som svarer på hva
som gjør dette til en sak framfor en gjentakelse, og et forslag som ikke kan fylle
det, skal ikke skrives.

Finnes ikke opphavet, lagres ikke forslaget — arbeidsflyten stopper i stedet og
sier hvilket vindu som ble lest. En **lånt** id fra et signal eller en artikkel som
«nesten» handler om det samme er verre enn å stoppe: sporet peker da på en kilde
som ikke er grunnlaget, og feilen er usynlig i forslaget. `monster` er det ene
feltet som kan være `null` — et signal kan være funnet uten mønstertreff.

`generertAv` skal ALLTID stå. Forslaget er maskinskrevet, og det skal være
merkbart som det for enhver som åpner det senere — også når teksten leser godt.
`apenePunkter: 0` betyr komplett på kilder; alt over 0 betyr at det ikke er
klart, og tallet skal stemme med antallet markører i teksten.

## Struktur

````markdown
# Forslag: <tittel>

**Vinkling:** <én setning. Det som skal stå i ingressen, ikke temaet.>
**Hvorfor nå:** <hva som utløste dette — signalet, og hva som er nytt i det>
**For hvem:** <hvilket segment i profilen, og hvorfor det treffer dem>

## Signalet

<I signal-varianten: hva radaren fant, hvilken kategori det er, og hva kategorien
betyr for hva saken kan bli. I en oppfølger utgår seksjonen når det ikke fantes et
signal — sto det ett, hører det her, og da er kildene DERES, ikke redaksjonens
egne, fordi oppfølgingssøket utelater egne domener. Er signalet en konkurrentsak direkte, står det her — og at
kildelista derfor ikke kan bestå av konkurrenten.>

## Den forrige saken

<BARE i oppfølger-varianten, og da PÅKREVD. Hva den egne artikkelen slo fast, med
dato og lenke — og ORDRETT sitat der det er et løfte eller en prognose som
etterprøves her. Deretter én linje: hva som er nytt siden, og hvilket av de fire
slagene det er (nytt tall, ny handling, konsekvensen, løftet).

Dette er seksjonen som lar en redaktør se forskjellen mellom en oppfølger og en
gjentakelse på tretti sekunder. Utelates den, er det ingen som kan.>

## Egne saker

<Det artikkel-sjekken fant, med artikkel-id, URL og dato, og dommen den fikk:
SAMME SAK, OPPFØLGING, FUNDAMENT eller SAMME TEMA. I en oppfølger står den
opprinnelige saken her også, med `bygger videre på` — og et `OPPFØLGING`-treff som
er NYERE enn den betyr at oppfølgeren alt er gjort.>

**Fant ingen treff?** Da står det slik — med forbeholdet:

> Ingen av de <N> nyeste egne artiklene er samme sak. Sjekken er en vurdering av
> et vindu, ikke et fulltekstsøk: er temaet dekket tidligere enn vinduet rekker,
> fanger den det ikke.

Dette avsnittet skal ALDRI utelates. «Ingen treff» uten forbeholdet leses som
«ikke dekket», og det er den feilslutningen som gir en dublett på nett.

## Funn

### Bekreftet
- <faktum, med periode når det er et tall>. — <kilde>, <dato>. <URL>

Hvert punkt har URL. Et punkt uten URL hører ikke i denne seksjonen.

### Motstridende
- **<hva striden står om>**: A sier <x> (<kilde>, <dato>, <URL>), B sier <y>
  (<kilde>, <dato>, <URL>). Nærmest primærkilden: <hvilken, og hvorfor>.

### Ubekreftet
- <det som ble søkt etter og ikke funnet, og hvor det ble søkt>

## Hull som må lukkes
- <hva som mangler> — <hvem som må kontaktes / hva som må sjekkes>

## Utkast

<Ingress: 1–2 setninger. Det viktigste først, med det konkrete tallet eller
navnet i den første setningen. Ikke en oppvarming.>

<Brødtekst i avsnitt på 2–4 setninger. Mellomtitler som sier noe, ikke
«Bakgrunn».>

## Kilder

| # | Kilde | Type | Dato | URL | Dekker |
|---|---|---|---|---|---|
| 1 | <navn> | primær/sekundær | <dato> | <URL> | <hva i saken> |
````

## Kildereglene

1. **Hvert faktum i utkastet står i FUNN.** Er det ikke der, skal det ikke inn —
   eller det står som `[TRENGER VERIFISERING: <hva som må sjekkes, hos hvem>]`.
2. **Sitater er ordrette**, fra en kilde som er lest, med URL i kildelista.
   Mangler en nødvendig uttalelse: `[SITAT MANGLER: <hvem> må kontaktes om <hva>]`.
3. **Ingen URL som ikke er hentet.** En oppdiktet lenke ser etterprøvd ut og er
   verre enn ingen lenke.
4. **Primærkilden markeres som primær** i kildetabellen. Det er raden en redaktør
   sjekker først. En konkurrents artikkel er alltid sekundær.
5. **Motstridende tall skrives som motstrid**, ikke som ett tall.
6. **Ingen tall uten periode.** «Falt 4,2 %» er ubrukelig; «falt 4,2 % fra
   første til andre kvartal» er en opplysning.
7. **Betalingsmur nevnes** når bare ingressen ble lest.

Markørene er ikke en unnskyldning for å skrive mindre — de er alternativet til å
finne opp mer. Et forslag med fire ærlige markører er brukbart; et glatt forslag
med én oppdiktet kilde er ikke.

## Tone og nivå — fra profilen, ikke fra nyhetsspråket

- **Tonen** kommer fra `editorial.editorialProfile` og `whatWorks` på det
  matchende mønsteret. Har artikkel-sjekken funnet en egen sak på temaet, er den
  det beste tonebeviset som finnes — les den. I en **oppfølger** er dette ikke et
  tips: den opprinnelige artikkelen ER redaksjonens stemme på nettopp dette
  temaet, og den slår enhver generell formulering av profilen.
- **Nivået** kommer fra `editorial.targetAudience`. Forklar ikke det leserne kan
  fra før; det er den vanligste måten et utkast avslører seg som maskinskrevet.
- **`whatToAvoid` er et forbud**, ikke et råd. Står «nasjonale snitt uten lokal
  vinkling» der, skal saken ikke åpne med et nasjonalt snitt.
- Norsk. Sakens språk følger redaksjonens, ikke kildenes.
