# kasus-plugin

[Claude Code](https://claude.com/claude-code)-plugin fra
[Glitch](https://glitch.as): redaksjonell arbeidsflyt på Kasus-dataene dine.

Repoet er et **plugin-marketplace**. Du kjører ikke koden her direkte — du legger
repoet til som kilde i Claude Code og installerer pluginen derfra.

## Legg det til

```bash
claude plugin marketplace add dtb-digital/kasus-plugin
claude plugin install kasus@kasus
```

Start sesjonen på nytt etterpå — kommandoer, agenter og `env`-innslag plukkes opp
ved oppstart.

## Kommandoer

| Kommando | Gjør |
|---|---|
| `/kasus:signals` | Lister radarsignaler. Filtrer på `--status`, `--type`, `--origin`, `--pattern`, `--hours`, `--limit`. |
| `/kasus:briefs` | Lister story-briefs, eller åpner én med en id som argument. |
| `/kasus:profile` | Redaksjonell profil: profilteksten, de utledede mønstrene og radarens mandat. |
| `/kasus:research` | Researcher en brief eller et signal videre — én subagent per spørsmål, primærkilder, notat på disk. |
| `/kasus:article` | Skriver artikkelutkast som markdown, fra brief + researchnotat, i redaksjonens tone. |
| `/kasus:env` | Sjekker oppsettet. `--resolve` sier hvilken installasjon et kall treffer. |
| `/kasus:test` | Selvtester pluginen. `--live` også tilkoblingen og at serveren avviser skriv. |

Full dokumentasjon: [`plugins/kasus/README.md`](plugins/kasus/README.md).

## Krav

- Claude Code
- Node 18+ (verktøyet er avhengighetsfri ESM, ingen byggesteg)
- En API-nøkkel fra Kasus: **Innstillinger → API-nøkler**

Nøkkelen settes som `KASUS_API_KEY` i `settings.json` → `env`, ikke i en
`.env`-fil — **Claude Code leser ikke `.env`**. Verifiser med
`/kasus:env --resolve`.

API-et er org-scopet av nøkkelen: den avgjør hvilken organisasjon kallene treffer,
så «0 signaler» betyr tomt for *den* organisasjonen. Nøkkelen ekkoes aldri av
verktøyet — den rapporteres som `(satt)` med variabelnavnet.

API-laget er **read-only**. Det pluginen skriver, skriver den til disk i ditt eget
repo.

## Utvikling

```bash
claude --plugin-dir plugins/kasus              # last pluginen lokalt
bash plugins/kasus/scripts/self-test.sh        # tørt
bash plugins/kasus/scripts/self-test.sh --live # + ekte kall mot API-et
node --test plugins/kasus/scripts/kasus/       # bare enhetstestene
```

## Lisens

MIT
