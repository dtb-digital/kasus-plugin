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

Kjør dette **i prosjektmappa**. `--scope project` er det som avgjør: begge
kommandoene skriver til prosjektets `.claude/settings.json`, som sjekkes inn.

```bash
claude plugin marketplace add dtb-digital/kasus-plugin --scope project
claude plugin install kasus@kasus --scope project
```

Uten `--scope` havner oppføringen i din egen `~/.claude/settings.json` — da har DU
pluginen, men ikke redaksjonen.

### De tre scopene, og hva de betyr her

| Scope | Fil | Betyr |
|---|---|---|
| `project` | `.claude/settings.json` | **Bruk denne.** Sjekkes inn, følger repoet. Alle som jobber i det får samme plugin og samme versjon. |
| `local` | `.claude/settings.local.json` | Prosjektet, men bare for deg. Ikke sjekket inn. Ikke for pluginen. |
| `user` | `~/.claude/settings.json` | Deg, på tvers av prosjekter. Riktig hvis du bruker Kasus i flere repoer som ikke skal dele oppsett. |

Dette er hva `--scope project` skriver, hvis du heller vil sette det selv:

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
installeres, og kommandoer, ferdigheter, agenter og tilkoblingen til Kasus plukkes
opp ved oppstart. Logg så inn: `/mcp` → `plugin:kasus:kasus` → **Authenticate**.
Neste person som kloner repoet trenger bare å gjøre det samme: svare ja på at
mappa er til å stole på, logge inn, og si «jeg skal skrive en dybdeartikkel».

## Arbeidsflyten

Saksløpet er en **ferdighet**, `dybdeartikkel`, så den starter av bestillingen selv —
«jeg skal skrive en dybdeartikkel», «finn meg en sak å skrive», «kjør saksløpet».
Vil du starte den med vilje, er `/kasus:dybdeartikkel` samme ferdighet valgt fra
menyen. Fra radarsignal til saksforslag, og det eneste pluginen gjør:

1. **Nye radarsignaler siden forrige saksløp** — ikke «de 20 nyeste». Målt mot en
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

Laget for å gjentas: kjør saksløpet, ta én sak, kvitter, kjør igjen.

Ferdigheten `oppfolgersak` starter det andre stedet en sak kan komme fra: **en
artikkel redaksjonen alt har publisert.** «Skriv en oppfølger på saken om
strømstøtte», «hva har skjedd siden vi skrev om dette?». Den leser saken i full
tekst, spør radaren om den har funnet nye kilder på den, sjekker at redaksjonen
ikke alt har fulgt den opp, og søker med **datogolv** på artikkelens egen
publiseringsdato — ellers kommer researchen tilbake med kildene den forrige saken
var bygget på. Samme format på disk, med en påkrevd «Den forrige saken»-seksjon.

Den har sitt eget vilkår: **ingen oppfølger uten et nytt faktum med kilde og
dato.** «Det har gått en måned» er ikke noe nytt, og en oppfølger uten noe nytt er
den samme saken publisert to ganger.

`/kasus:start` er inngangen for den som ikke har bestemt seg, og den svarer på
**hva har vi å jobbe med i dag?** Fire kall i samme melding, og siste døgn av hver
— eller helt tilbake til forrige kvittering, om det er lenger siden: radarens
signaler, Kasus' egne story-briefs, redaksjonens egne ferske saker, og statusen
«hva er nytt siden sist», målt mot kvitteringen. De tre kildene peker mot ulike
neste steg, og det er hele grunnen til at de står side om side: en egen sak mot en
**oppfølger**, et signal mot en **ny sak**. Så **spør den hva du vil gjøre**, og
svaret sender deg videre i riktig ferdighet. Kommandoen kvitterer aldri, skriver
ingenting og gjør ingen research — den kan spørre, ikke utføre.

**Den legger materialet fram slik det ligger, og bearbeider ingenting.** Er tre av
signalene den samme SSB-saken, står de som tre; er saken skrevet i fjor, er det
ikke merket. Begge forbeholdene står i svaret, fordi et fravær ellers leses som en
klarering. Prisen er at du ser materialet rått, og gevinsten er at et blikk over
alt koster sekunder.

Vil du ha det luket, er det **ett steg til**: «rydd opp i signalene». Da sveiper
`kasus-triage` hele signalvinduet og alle de 200 nyeste publiserte egne sakene,
slår sammen signalene som er samme sakskompleks til kandidatsaker, og gir hver av
dem en foreløpig dekningsdom — så det som alt er dekket står merket, og det som
har en egen sak å bygge på står med lenke til den. Det koster et par minutter, og
de tre hundre elementene ligger i **agentens** kontekst framfor i samtalens. Det er
derfor det er et eget steg og ikke en del av inngangen: du betaler for
forarbeidet når du vil ha det, ikke hver gang du bare vil se hva som ligger der.

Dommen derfra klarerer ingen sak: den er en grovsortering på signalets tittel og
sammendrag, og velges saken, leser `kasus-archivist` det samme vinduet på nytt med
hele signalet.

Ferdigheten `hjelp` forklarer resten: «hvordan bruker jeg denne?», «hva kan
kasus?», «hjelp» — eller `/kasus:hjelp`. Den kobler jobben til inngangen,
oversetter ordene i outputen (kvitteringen, de fire kategoriene, `GAMMEL SAK`), og
sier hva som er galt når noe ikke virker. Den gjør ingen av jobbene: ingen
signaler, ingen research, ingen kvittering — den tilbyr å starte riktig inngang.

**Alt som legges fram har én form, og den er journalistens:** tittel, én til to
linjer om hva saken er, og en klikkbar lenke. Ingen id-er, ingen kategorinavn,
ingen feltnavn og ingen flagg — de er arbeidsmateriale, og en id kan verken åpnes
eller ringes. Etterprøvbarheten ligger i lenka og datoen, som gjør samme jobb
bedre. Forbeholdene består, men på norsk: hvilken periode svaret gjelder, at
ingenting her er et søk i alt, og hvert hull i utkastet. Formen er definert ett
sted, [`references/samtaleform.md`](plugins/kasus/references/samtaleform.md), og
håndhevet i `/kasus:test`.

I tillegg finnes `/kasus:env` (sjekker oppsettet) og `/kasus:test` (selvtest) som
diagnostikk.

Spørsmål om hva radaren eller arkivet inneholder trenger heller ingen kommando:
`kasus-lookout` svarer på «er det noe om strømpriser?» og `kasus-archivist` på
«har vi dekket dette?». Ingen av dem kvitterer, så et spørsmål kan ikke spise
saksløpet.

Full dokumentasjon: [`plugins/kasus/README.md`](plugins/kasus/README.md).

## Krav

- Claude Code
- Node 18+ (kvitteringen er avhengighetsfri ESM, ingen byggesteg)
- En Kasus-konto i redaksjonen pluginen skal jobbe for

Dataene kommer fra **Kasus' MCP-server**, som pluginen kobler til selv via
`.mcp.json`. Første gang logger du inn med Kasus-kontoen: `/mcp` →
`plugin:kasus:kasus` → **Authenticate**. Har du flere organisasjoner, velger du
én i nettleseren. Ingen API-nøkkel, og ingenting å sette i `env`. Verifiser med
`/kasus:env`, som sier hvilken organisasjon du er logget inn i.

Tilkoblingen er bundet til organisasjonen du valgte, så «0 signaler» betyr tomt
for *den* organisasjonen. For staging eller en egen installasjon: sett
`KASUS_MCP_URL` (default `https://app.kasus.io/api/mcp`).

Kasus' MCP-server er **read-only** — ingen status endres der. Det
pluginen skriver, skriver den i prosjektet: saksforslagene i `./artikler`,
kvitteringen «siden sist» i `.claude/kasus-state.json`. Begge er relative til der
du står, så to prosjekter teller sine egne saksløp.

## Utvikling

```bash
claude --plugin-dir plugins/kasus              # last pluginen lokalt
bash plugins/kasus/scripts/self-test.sh        # selvtesten
node --test plugins/kasus/scripts/kasus/*.test.mjs   # bare enhetstestene
```

## Lisens

MIT
