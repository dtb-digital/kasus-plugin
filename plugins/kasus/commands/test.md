---
description: Selvtest av kasus-pluginen — syntaks, manifest-kontrakt, enhetstester og mål-presedens
argument-hint: [--live] [miljø]
allowed-tools: ["Bash"]
---

Kjør selvtesten:

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/self-test.sh $ARGUMENTS
```

Tørt dekker den:

- syntaks på alle `*.sh` i **både bash og zsh** (Bash-verktøyet kan bruke begge,
  så en zsh-only feil dukker ellers opp hos brukeren) og `node --check` på alle `*.mjs`
- at `commands/`, `agents/` og `references/` ikke er tomme — komponentene oppdages
  fra mappa, så en tom mappe er en plugin uten kommandoer, ikke en feilmelding
- at `plugin.json` er gyldig JSON, og at versjonen der er den samme som i verktøyet
- at hver agents `name:` matcher filnavnet, ellers lastes agenten ikke
- at `kasus.mjs --list --json` oppfyller manifest-kontrakten, og at **alle modi
  kommandoene refererer til finnes** — en modus som får nytt navn blir en rød test
  her framfor en kommando som feiler hos brukeren
- enhetstestene (`node --test`), som blant annet holder fast på at nøkkelen ikke
  lekker i output, at maskeringen tar dybden uten å spise `keyFigures`, og at
  pagineringen sier fra når taket er nådd
- at env-suffikset er identisk i shell og JS — de har driftet fra hverandre før
- at ingen skrivende HTTP-metode finnes i `scripts/`

Med `--live` i tillegg: et ekte kall mot `/api/v1/profile` (som også sier hvilken
organisasjon nøkkelen tilhører), et kall mot `/api/v1/signals`, og en
verifisering av at **serveren** avviser `POST` mot en v1-rute. Det siste er
poenget: at pluginen ikke prøver å skrive er noe pluginen selv hevder — at ruten
ikke finnes, er noe serveren svarer.

`--live` krever `KASUS_API_KEY`. Feiler den på tilkobling, kjør `/kasus:env` før
du konkluderer.

Rapporter resultatet som det er. Feiler noe, si hvilken fil som må endres — ikke
bare at testen er rød.
