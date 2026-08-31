---
description: Research en story-brief eller et radarsignal videre — søk, primærkilder og skraping, på redaksjonens premisser
argument-hint: <brief-id | signal-id | fritekst-tema> [--env staging] [--questions 5]
allowed-tools: ["Agent", "Task", "Bash", "Read", "Write", "WebSearch", "WebFetch"]
---

Research saken **$ARGUMENTS** videre, og legg igjen et researchnotat som en
artikkel kan skrives fra.

Er `$ARGUMENTS` tomt, spør hva som skal researches — ikke gjett. Foreslå gjerne
`/kasus:briefs --status proposal` for å finne en sak.

## 1. Finn utgangspunktet

Er argumentet en id, hent saken. En story-brief-id og en signal-id ser like ut
(begge er cuid-er), så prøv brief først og fall tilbake til signal:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs brief <id> --json \
  || node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs signal <id> --json
```

En 404 fra begge betyr «finnes ikke, ELLER tilhører en annen organisasjon» —
nøkkelen avgjør organisasjonen. Si det slik framfor «slettet».

Er argumentet fritekst, er temaet utgangspunktet, og du hopper til steg 2.

## 2. Hent premissene — alltid

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs profile --json
```

Dette steget er ikke valgfritt. Uten profilen blir researchen generisk
nyhetsresearch: `targetAudience` avgjør hva som må forklares og hva som kan
forutsettes, `whatToAvoid` på det matchende mønsteret luker ut vinklinger som
ikke virker for disse leserne, og `keywords` sier hva som er innenfor
dekningsområdet.

Finn mønsteret som matcher `matchedPattern` på saken, og bruk `whatWorks` fra det
som rettesnor for hva du leter etter.

## 3. Lag researchplanen — spørsmål, ikke temaer

Skriv 3–6 **konkrete spørsmål** som må besvares før saken kan skrives. Hent dem
fra, i denne rekkefølgen:

1. `engagement.openQuestions` på briefen — de er alt formulert av pipelinen.
2. Hvert tall i `keyFigures` som ikke har en kilde: hvor kommer det fra, hva er
   grunnlaget, og er det ferskt?
3. Hver aktør i `actors`/`keyActors`: hva har de faktisk sagt, og når?
4. Det åpenbare motargumentet som ikke står i briefen.

Et spørsmål skal kunne besvares med en kilde. «Se på boligmarkedet» er ikke et
spørsmål; «Hvor mye falt kvadratmeterprisen i Bodø i Q2, og fra hvilken kilde?» er.

Vis planen til brukeren før du kjører den, hvis den avviker fra det de ba om.

## 4. Kjør researchen — én agent per spørsmål

Send ut `kasus-researcher`-agenter, **ett spørsmål per agent, alle i samme
melding** slik at de kjører parallelt. Maks 6. Hver agent får:

- spørsmålet, ordrett
- sakens tittel, plot og vinkling
- `targetAudience` og `editorialProfile` fra profilen
- domenene som IKKE er svar i seg selv: organisasjonens eget `siteUrl` og
  kildene som alt står i briefen

Agenten svarer med funn der **hvert faktum bærer URL-en sin**, og med et
eksplisitt skille mellom bekreftet, motstridende og ubekreftet.

## 5. Sammenstill

Slå sammen svarene og løs konfliktene framfor å liste dem side om side: når to
kilder er uenige, sier du hvilken som er nærmest primærkilden og hvorfor. Skill
skarpt mellom:

- **Bekreftet** — minst én primærkilde, med dato.
- **Motstridende** — kildene er uenige. Begge tallene, begge URL-ene.
- **Ubekreftet** — ingen kilde funnet. Dette blir et `[TRENGER VERIFISERING]` i
  artikkelen, ikke en setning som er skrevet rundt.
- **Nytt siden briefen** — det researchen fant som briefen ikke visste.

## 6. Skriv notatet

Lagre til `${KASUS_ARTICLES_DIR:-artikler}/research/<ÅÅÅÅ-MM-DD>-<slug>.md` med
formatet i @${CLAUDE_PLUGIN_ROOT}/references/research-method.md. Notatet er det
`/kasus:article` leser, så kildelista må være komplett og hver URL må stå der.

## 7. Konkluder

Si til slutt, i én setning: **er det nok her til å skrive saken?** Er svaret nei,
si hva som mangler og hvem som må ringes — det er et ærligere svar enn et
artikkelutkast med hull.

Er svaret ja, foreslå `/kasus:article <brief-id>`.
