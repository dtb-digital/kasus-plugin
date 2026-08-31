# kasus-plugin

[Claude Code](https://claude.com/claude-code)-plugin fra
[Glitch](https://glitch.as): redaksjonell arbeidsflyt på Kasus-dataene dine.

Repoet er et **plugin-marketplace**. Du kjører ikke koden her direkte — du legger
repoet til som kilde i Claude Code og installerer pluginen derfra.

## Legg det til i prosjektet

Pluginen hører til **prosjektet**, ikke brukeren: redaksjonens eget repo, der
artiklene og saksforslagene ligger. Da følger den med repoet — alle som jobber
der får de samme kommandoene, og hvilken versjon som gjelder er noe som står i
git framfor i en maskin.

Legg dette i prosjektets `.claude/settings.json` og sjekk fila inn:

```json
{
  "extraKnownMarketplaces": {
    "kasus": {
      "source": {
        "source": "github",
        "repo": "dtb-digital/kasus-plugin"
      }
    }
  },
  "enabledPlugins": {
    "kasus@kasus": true
  }
}
```

Start sesjonen på nytt i prosjektmappa etterpå — marketplacet hentes, pluginen
installeres, og kommandoer, agenter og `env`-innslag plukkes opp ved oppstart.
Neste person som kloner repoet trenger ikke gjøre noe: de svarer ja på at mappa
er til å stole på, og har `/kasus:start`.

Trenger du den heller for deg selv, på tvers av prosjekter, er CLI-veien en
**brukerglobal** installasjon av samme plugin:

```bash
claude plugin marketplace add dtb-digital/kasus-plugin
claude plugin install kasus@kasus
```

## Kommandoene

`/kasus:start` — fra radarsignal til saksforslag, og det eneste pluginen gjør:

1. **Nye radarsignaler siden forrige runde** — ikke «de 20 nyeste». Målt mot en
   kvittering på disk.
2. **Prioritering, du velger.** Hvert signal merket med hva det er: oppfølging av
   **deres egen** sak, oppfølging av et sakskompleks en **konkurrent** har tatt,
   konkurrentens **egen sak** fra en overvåket forside, eller et **fritt temasøk**
   som kan være år gammelt. De fire krever ulike tiltak og er ikke til å skille
   fra hverandre i rå API-felt.
3. **Sjekk mot egne artikler.** Er saken skrevet før? Finnes det en egen sak å
   bygge videre på? Hvilken tone har redaksjonen på temaet?
4. **Bredt søk** — én agent per spørsmål, primærkilden framfor omtalen, alt datert.
5. **Saksforslag på disk** i redaksjonens tone, med hull markert framfor utfylt.
6. **Kvittering**, og videre til neste sak.

Laget for å gjentas: kjør runden, ta én sak, kvitter, kjør igjen.

`/kasus:signals` gir en **status** uten å starte noe: hva har kommet inn siden
sist, fordelt på redaksjonelle mønstre og de fire kategoriene, og hvor mye av det
som er gamle saker. Den kvitterer aldri og skriver ingenting — blikket man tar før
man setter av tid.

I tillegg finnes `/kasus:env` (sjekker oppsettet) og `/kasus:test` (selvtest) som
diagnostikk.

Full dokumentasjon: [`plugins/kasus/README.md`](plugins/kasus/README.md).

## Krav

- Claude Code
- Node 18+ (verktøyet er avhengighetsfri ESM, ingen byggesteg)
- En API-nøkkel fra Kasus: **Innstillinger → API-nøkler**

Nøkkelen settes som `KASUS_API_KEY` under `env` i prosjektets
`.claude/settings.local.json`. Den fila hører til deg og ikke repoet — legg den i
`.gitignore`, så blir nøkkelen liggende hos deg mens plugin-oppsettet i
`.claude/settings.json` deles. Ikke i en `.env`-fil: **Claude Code leser ikke
`.env`**. Verifiser med `/kasus:env --resolve`.

```json
{
  "env": {
    "KASUS_API_KEY": "kasus_sk_…"
  }
}
```

API-et er org-scopet av nøkkelen: den avgjør hvilken organisasjon kallene treffer,
så «0 signaler» betyr tomt for *den* organisasjonen. Nøkkelen ekkoes aldri av
verktøyet — den rapporteres som `(satt)` med variabelnavnet.

API-laget er **read-only**. Det pluginen skriver, skriver den i prosjektet:
saksforslagene i `./artikler`, kvitteringen «siden sist» i
`.claude/kasus-state.json`. Begge er relative til der du står, så to prosjekter
teller sine egne runder.

## Utvikling

```bash
claude --plugin-dir plugins/kasus              # last pluginen lokalt
bash plugins/kasus/scripts/self-test.sh        # tørt
bash plugins/kasus/scripts/self-test.sh --live # + ekte kall mot API-et
node --test plugins/kasus/scripts/kasus/       # bare enhetstestene
```

## Lisens

MIT
