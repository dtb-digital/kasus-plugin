---
description: Sjekk at oppsettet for kasus-pluginen er komplett, og hvilken installasjon et kall treffer
argument-hint: [--resolve] [miljø]
allowed-tools: ["Bash"]
---

Kjør miljøsjekken:

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/check-env.sh $ARGUMENTS
```

Skriptet er den **ene kilden til sannhet** for hva pluginen krever. Presenter
resultatet som det er, og gjør deretter to ting:

1. For hver `MANGLER:`-linje, si konkret hva brukeren skal gjøre. En API-nøkkel
   lages i Kasus under **Innstillinger → API-nøkler**, og vises kun én gang ved
   opprettelse. Den settes som `KASUS_API_KEY` i `settings.json` → `env` (bruker,
   prosjekt eller `.claude/settings.local.json`), eller som en eksport i skallet.
   **`.env`-filer leses ikke av Claude Code** — det er den vanligste feilen.
   Nye `env`-innslag krever omstart av sesjonen.
2. Med `--resolve`: forklar hva mål-oppløsningen betyr. Per-miljø-variabelen
   (`KASUS_API_KEY_STAGING`) vinner over den delte (`KASUS_API_KEY`), og uten et
   miljønavn leses BARE den delte. Base-URL-en er den eneste verdien som
   defaulteres — til `app.kasus.io` — og kilden sier alltid om den kom fra en
   variabel eller fra defaulten.

Nøkkelverdier ekkoes aldri. Skriptet rapporterer `(satt, N tegn)`, og du skal
heller ikke skrive verdien i oppsummeringen din.

Er alt OK, si hvilken installasjon og organisasjon kallene ville gått mot — og
minn om at det er **nøkkelen** som avgjør organisasjonen, ikke noe du sender med.
