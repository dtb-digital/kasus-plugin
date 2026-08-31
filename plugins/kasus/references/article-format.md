# Artikkelutkastet — format og kildekrav

Lastes av `/kasus:article`.

## Filsti

```
${KASUS_ARTICLES_DIR:-artikler}/<ÅÅÅÅ-MM-DD>-<slug>.md
```

Overskriv ikke en fil som finnes — legg på `-2` og si det i rapporten.

## Frontmatter

```yaml
---
tittel: <foreslått tittel>
undertittel: <ingress på én setning, eller null>
dato: <ÅÅÅÅ-MM-DD>
status: utkast
type: nyhet | analyse | bakgrunn
forfatter: null            # settes av redaksjonen
kasusBriefId: <id eller null>
kasusSignalId: <id eller null>
monster: <matchedPattern eller null>
researchnotat: <relativ sti til notatet artikkelen bygger på>
generertAv: claude-code/kasus-plugin
apenePunkter: <antall [TRENGER VERIFISERING] + [SITAT MANGLER] i filen>
kilder:
  - navn: <kildenavn>
    url: <URL>
    type: primær | sekundær
---
```

`status: utkast` og `generertAv` skal ALLTID stå. Filen er et maskinskrevet utkast,
og den skal være merkbar som det for enhver som åpner den senere — også når teksten
leser godt.

`apenePunkter: 0` betyr at utkastet er komplett på kilder. Alt over 0 betyr at det
ikke er klart, og tallet skal stemme med antallet markører i teksten.

## Struktur

```markdown
# <tittel>

<Ingress: 1–2 setninger. Det viktigste først, med det konkrete tallet eller navnet
i den første setningen. Ikke en oppvarming.>

<Brødtekst. Avsnitt på 2–4 setninger.>

## <Mellomtittel som sier noe, ikke «Bakgrunn»>

…

## Kilder

- <Kildenavn>, <dato>: <URL> — <hva denne kilden dekker i saken>
```

`## Kilder` er en del av artikkelen, ikke et vedlegg. Den skal kunne leses av en
redaktør som vil sjekke ett tall.

## Kildereglene

1. **Hvert faktum stammer fra researchnotatet.** Er det ikke der, skal det ikke
   inn — eller det står som `[TRENGER VERIFISERING: <hva som må sjekkes, og hos hvem>]`.
2. **Sitater er ordrette.** Kun det som er lest i en kilde, med attribusjon og
   URL i kildelista. Mangler en nødvendig uttalelse:
   `[SITAT MANGLER: <hvem> må kontaktes om <hva>]`.
3. **Motstridende tall skrives som motstrid**, ikke som ett tall. «SSB oppgir X,
   mens bransjeorganisasjonen oppgir Y» — med begge kildene.
4. **En påstand fra en part attribueres til parten.** Ikke skriv en interessents
   påstand som konstatering.
5. **Ingen tall uten periode.** «Falt 4,2 %» er ubrukelig; «falt 4,2 % fra første
   til andre kvartal» er en opplysning.

Markørene er ikke en unnskyldning for å skrive mindre — de er alternativet til å
finne opp mer. Et utkast med fire ærlige markører er brukbart; et glatt utkast med
én oppdiktet kilde er ikke.

## Tone og nivå

- **Tonen** kommer fra `editorial.editorialProfile` og `whatWorks` på det matchende
  mønsteret i profilen. Ikke fra generell nyhetsstil.
- **Nivået** kommer fra `editorial.targetAudience`. Forklar ikke det leserne kan
  fra før — det er den vanligste måten et utkast avslører seg som maskinskrevet.
- **`whatToAvoid`** er et forbud, ikke et råd. Står «nasjonale snitt uten lokal
  vinkling» der, skal saken ikke åpne med et nasjonalt snitt.
- Norsk. Sakens språk følger redaksjonens, ikke kildenes.

## Etter skriving

Rapporter til brukeren: sti, valgt vinkling (og om den ble flyttet av
researchen), **hver markør i filen** som liste, og hva som ikke ble dekket.
Pluginen publiserer ingenting — den skriver til disk.
