# Researchnotatet — format og krav

Lastes av `/kasus:research`. Notatet er ikke en oppsummering til mennesker; det er
**grunnlaget `/kasus:article` skriver fra**. Alt som ikke står her, finnes ikke i
artikkelen. Derfor er kildelista og hullene de viktigste delene.

## Filsti

```
${KASUS_ARTICLES_DIR:-artikler}/research/<ÅÅÅÅ-MM-DD>-<slug>.md
```

`<slug>` er sakens tittel, små bokstaver, bindestreker, uten æøå (`å` → `a`).
Finnes filen, legg på `-2` framfor å overskrive.

## Format

```markdown
---
tittel: <sakens arbeidstittel>
dato: <ÅÅÅÅ-MM-DD>
kasusBriefId: <id eller null>
kasusSignalId: <id eller null>
monster: <matchedPattern, eller null>
vinkling: <briefens angle, ordrett>
status: research
kilderTotalt: <antall unike URL-er>
---

# Research: <tittel>

## Spørsmålene

1. <spørsmål> — **besvart** / **delvis** / **ubesvart**
2. …

## Bekreftet

- <faktum>. — <kildenavn>, <dato>. <URL>

Hvert punkt har URL. Et punkt uten URL hører ikke i denne seksjonen.

## Motstridende

- **<hva striden står om>**: A sier <x> (<kilde>, <dato>, <URL>), B sier <y>
  (<kilde>, <dato>, <URL>). Nærmest primærkilden: <hvilken og hvorfor>.

## Ubekreftet

- <det som ikke ble funnet>, lett i <hvor>.

## Hull som må lukkes

- <hva som mangler> — <hvem som må kontaktes / hva som må sjekkes>

## Sitater

- «<ordrett sitat>» — <navn>, <rolle>, <hvor>, <dato>. <URL>

Kun sitater som er lest i kilden. Ingen omskrivinger, ingen «tilsvarende».

## Nytt siden briefen

- <det researchen fant som briefen ikke visste>

## Vurdering

<Én til tre setninger: er det nok til å skrive saken? Holder briefens vinkling,
eller flyttet funnene den? Hva er den sterkeste innvendingen mot saken slik den
står?>

## Kilder

| # | Kilde | Type | Dato | URL |
|---|---|---|---|---|
| 1 | <navn> | primær/sekundær | <dato> | <URL> |
```

## Krav

- **Ingen URL du ikke har hentet.** En oppdiktet lenke ser etterprøvd ut og er
  verre enn ingen lenke.
- **Primærkilde markeres som primærkilde**, og sekundær som sekundær, i
  kildetabellen. Det er den raden en redaktør sjekker først.
- **Betalingsmur nevnes** når du bare fikk ingressen.
- **Ubekreftet er en seksjon, ikke en utelatelse.** Det som ikke ble funnet er en
  del av resultatet.
- **Ingen prosa-avsnitt om temaet generelt.** Notatet er funn, ikke bakgrunn.
