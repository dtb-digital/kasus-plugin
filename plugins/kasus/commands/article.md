---
description: Skriv artikkelutkast som markdown-fil, fra story-brief og research, i redaksjonens tone
argument-hint: <brief-id | sti-til-researchnotat> [--type nyhet|analyse|bakgrunn] [--words 3000]
allowed-tools: ["Bash", "Read", "Write", "Glob", "WebFetch"]
---

Skriv et artikkelutkast for **$ARGUMENTS** som en markdown-fil.

Er `$ARGUMENTS` tomt, spør hvilken sak — ikke velg en selv.

## 1. Samle grunnlaget

Tre kilder, i denne rekkefølgen. Manglende grunnlag skal SIES, ikke erstattes med
mer skriving.

```bash
# Redaksjonens premisser — påkrevd
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs profile --json

# Saken, hvis argumentet er en id
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs brief <id> --json
```

Finn researchnotatet i `${KASUS_ARTICLES_DIR:-artikler}/research/` (Glob) og les
det. **Finnes det ikke, skriv ikke artikkelen.** Si i stedet at grunnlaget mangler
og foreslå `/kasus:research <id>` først. En artikkel skrevet på en brief alene er
en omskriving av et sammendrag — den har ingen kilder å stå på, og den vil se
ferdig ut uten å være det.

## 2. Skriv den

Formatet, frontmatteren og kildereglene står i
@${CLAUDE_PLUGIN_ROOT}/references/article-format.md. Følg det.

De fire reglene som avgjør om utkastet er brukbart:

1. **Hvert faktum kommer fra researchnotatet, med kilde.** Er noe ikke i notatet,
   er det ikke i artikkelen — eller det står som
   `[TRENGER VERIFISERING: hva som må sjekkes]`. Aldri fyll et hull med en
   plausibel setning. Det er den ene feilen som gjør et utkast farlig framfor
   ufullstendig.
2. **Sitater er ordrette fra en kilde du har lest, med URL.** Finn ikke opp et
   sitat, og skriv ikke om et sitat til noe «tilsvarende». Trenger saken en uttalelse
   som ikke finnes, skriv `[SITAT MANGLER: <hvem> må kontaktes om <hva>]`.
3. **Tonen kommer fra `editorialProfile` og `whatWorks`**, nivået fra
   `targetAudience`. Forklar ikke det leserne kan; forklar det de ikke kan.
4. **Vinklingen er briefens `angle`** med mindre researchen viste at den ikke
   holder. Skjedde det, si det øverst i filen og skriv den vinklingen funnene
   faktisk bærer.

## 3. Lagre

Til `${KASUS_ARTICLES_DIR:-artikler}/<ÅÅÅÅ-MM-DD>-<slug>.md`. Overskriv ikke en
fil som finnes — legg på `-2` og si det.

## 4. Rapporter

Kort, til brukeren:

- stien til filen
- hvilken vinkling som ble valgt, og om den ble endret underveis
- **hver `[TRENGER VERIFISERING]` og `[SITAT MANGLER]` i filen**, som liste
- hva du IKKE fikk dekket

Utkastet er et utkast. Ikke kall det ferdig, og ikke publiser noe noe sted —
pluginen skriver kun til disk.
