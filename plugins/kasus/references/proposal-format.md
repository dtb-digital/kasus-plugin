# Saksforslaget — formatet på det som legges på disk

Lastes av `/kasus:runde`. **Én fil per signal**, og den er hele leveransen fra
runden: hva signalet er, hva redaksjonen alt har skrevet om det, hva et bredt søk
fant, hva som fortsatt mangler, og et utkast som kan skrives videre på.

Grunnen til at det er ÉN fil og ikke et researchnotat pluss en artikkel: et utkast
som ligger for seg selv mister sporet tilbake til kildene, og en redaktør som skal
sjekke ett tall må da lete i to filer. Her står tallet, kilden og setningen som
bruker det i samme dokument.

## Filsti

```
${KASUS_ARTICLES_DIR:-artikler}/<ÅÅÅÅ-MM-DD>-<slug>.md
```

`<slug>` er den foreslåtte tittelen, små bokstaver, bindestreker, uten æøå
(`å` → `a`). Finnes filen, legg på `-2` og si det — overskriv aldri.

## Frontmatter

```yaml
---
tittel: <foreslått tittel>
dato: <ÅÅÅÅ-MM-DD>
status: forslag
kategori: egen_oppfolging | konkurrent_oppfolging | konkurrentsak | temasok | annet
kasusSignalId: <signal-id>
signalUrl: <URL-en signalet peker på>
signalPublisert: <publiseringsdato på kilden, eller «ukjent»>
monster: <matchedPattern, eller null>
egneSaker:                 # treffene fra artikkel-sjekken, tomme hvis ingen
  - id: <artikkel-id>
    tittel: <tittel>
    url: <URL>
    publisert: <ÅÅÅÅ-MM-DD>
    forhold: bygger videre på | overlapper | samme sak — ikke skriv
kilderTotalt: <antall unike URL-er i KILDER>
apenePunkter: <antall [TRENGER VERIFISERING] + [SITAT MANGLER] i filen>
generertAv: claude-code/kasus-plugin
---
```

`status: forslag` og `generertAv` skal ALLTID stå. Filen er maskinskrevet, og den
skal være merkbar som det for enhver som åpner den senere — også når teksten leser
godt. `apenePunkter: 0` betyr komplett på kilder; alt over 0 betyr at den ikke er
klar, og tallet skal stemme med antallet markører i teksten.

## Struktur

````markdown
# Forslag: <tittel>

**Vinkling:** <én setning. Det som skal stå i ingressen, ikke temaet.>
**Hvorfor nå:** <hva som utløste dette — signalet, og hva som er nytt i det>
**For hvem:** <hvilket segment i profilen, og hvorfor det treffer dem>

## Signalet

<Hva radaren fant, hvilken kategori det er, og hva kategorien betyr for hva
saken kan bli. Er signalet en konkurrentsak direkte, står det her — og at
kildelista derfor ikke kan bestå av konkurrenten.>

## Egne saker

<Det artikkel-sjekken fant, med URL og dato, og hva forholdet er: bygge videre
på, overlapper delvis, eller samme sak.>

**Fant ingen treff?** Da står det slik — med forbeholdet:

> Ingen av de <N> nyeste egne artiklene traff på <søkeordene>. Sjekken er
> ordoverlapp mot et vindu, ikke et fulltekstsøk: er temaet dekket tidligere
> eller under en annen ordbruk, fanger den det ikke.

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
  det beste tonebeviset som finnes — les den.
- **Nivået** kommer fra `editorial.targetAudience`. Forklar ikke det leserne kan
  fra før; det er den vanligste måten et utkast avslører seg som maskinskrevet.
- **`whatToAvoid` er et forbud**, ikke et råd. Står «nasjonale snitt uten lokal
  vinkling» der, skal saken ikke åpne med et nasjonalt snitt.
- Norsk. Sakens språk følger redaksjonens, ikke kildenes.
