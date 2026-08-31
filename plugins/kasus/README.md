# kasus

Vaktrunden for en journalist, i Claude Code. **Én arbeidsflyt** — `/kasus:start` —
og den gjør seks ting i rekkefølge:

1. Henter radarsignalene som har kommet inn **siden forrige runde**
2. Legger fram en prioritering — **du velger saken**
3. Sjekker saken mot **redaksjonens egne artikler**: skrevet før? noe å bygge på?
4. Gjør et **bredt søk** for å utvide og etterprøve
5. Skriver et **saksforslag** på disk, i redaksjonens tone
6. Kvitterer, og går til neste sak

Prosessen er laget for å gjentas rett etter hverandre: kjør runden, ta én sak,
kvitter, kjør igjen.

API-laget er **read-only**. Det pluginen skriver, skriver den i prosjektet:
saksforslagene i `./artikler`, kvitteringen «siden sist» i
`.claude/kasus-state.json`. Begge stiene er relative til der du står, så to
prosjekter teller sine egne runder.

## Kom i gang

Pluginen hører til **prosjektet** — redaksjonens eget repo, der artiklene,
saksforslagene og kvitteringen ligger. Da følger den med repoet, og hvilken
versjon som gjelder står i git framfor i en maskin.

1. Legg marketplacet og pluginen i prosjektets `.claude/settings.json`, og sjekk
   fila inn:

   ```json
   {
     "extraKnownMarketplaces": {
       "kasus": {
         "source": { "source": "github", "repo": "dtb-digital/kasus-plugin" }
       }
     },
     "enabledPlugins": { "kasus@kasus": true }
   }
   ```

   Trenger du den heller for deg selv, på tvers av prosjekter, gjør CLI-en det
   samme brukerglobalt: `claude plugin marketplace add dtb-digital/kasus-plugin`
   og `claude plugin install kasus@kasus`.

2. Lag en API-nøkkel i Kasus: **Innstillinger → API-nøkler → Ny nøkkel**. Den
   vises kun én gang.
3. Sett den under `env` i prosjektets `.claude/settings.local.json`. Den fila
   hører til deg og ikke repoet — legg den i `.gitignore`, så deles
   plugin-oppsettet mens nøkkelen blir liggende hos deg. En eksport i skallet
   virker også. **`.env`-filer leses ikke av Claude Code.**

   ```json
   {
     "env": {
       "KASUS_API_KEY": "kasus_sk_…"
     }
   }
   ```

4. Start sesjonen på nytt i prosjektmappa — marketplacet hentes, pluginen
   installeres, og `env`-innslag og komponenter plukkes opp ved oppstart.
5. Verifiser: `/kasus:env --resolve`
6. Kjør runden: `/kasus:start`

Neste person som kloner repoet trenger bare sin egen nøkkel — resten står i
`.claude/settings.json`.

## Kommandoer

| Kommando | Gjør |
|---|---|
| `/kasus:start` | **Vaktrunden.** Alt over. Tar `--hours 72` for et bredere vindu og `--all` for å ta med forkastede signaler. |
| `/kasus:signals` | **Status:** hva har skjedd siden sist? Fordeling over mønstre, kategorier, gamle saker. Med et spørsmål framfor flagg (`/kasus:signals er det noe om strømpriser?`) går det til `kasus-lookout`. Kvitterer aldri, skriver ingenting. |
| `/kasus:env` | Sjekker oppsettet. `--resolve` sier hvilken installasjon et kall treffer og hvilken variabel hver verdi kom fra. |
| `/kasus:test` | Selvtester pluginen. `--live` også tilkoblingen og at serveren avviser skriv. |

Arbeidet skjer i `/kasus:start`. `/kasus:signals` er blikket man tar først — det
kan ikke gjøre noe, bare vise, og konkurrerer derfor ikke med runden. De to siste
er diagnostikk.

## De fire kategoriene

Hvert signal merkes med hva det faktisk er. De krever ulike tiltak, og i rå
API-felt ser de like ut — `origin` og `type` må leses samtidig, og begge
oppfølgingssøkene lagrer funnene som `market_signal`:

| Kategori | Hva du har i hånda | Tiltaket |
|---|---|---|
| **Oppfølging av EGEN sak** | Nye kilder på noe redaksjonen alt har publisert. Egne domener er utelatt fra søket. | Ofte den billigste gode saken: vinklingen finnes, det som mangler er det nye. |
| **Oppfølging av KONKURRENTSAK** | Andre kilder på et sakskompleks en konkurrent har tatt. Konkurrentens domener er utelatt. | *Ikke* artikkelen deres — kilder å bygge en egen sak på. Hastverk med et forsprang. |
| **Konkurrentsak direkte** | Konkurrentens egen sak, fra en overvåket forside. | Ikke et søketreff og ikke research. Følges den opp, starter researchen på null. |
| **Fritt temasøk** | Søketreff på et tema, hentet **uavhengig av publiseringstidspunkt**. | Sjekk publisert-datoen før du prioriterer. Her ligger støyen, og de gamle sakene. |

**Ferskhet er to tall.** `oppdaget` er når radaren fant signalet, `publisert` er
hvor gammel saken er. Et temasøk kan levere en artikkel fra 2023 som «oppdaget for
45 min siden», så runden viser begge og merker `GAMMEL SAK` når de er mer enn en
uke fra hverandre. Mangler datoen, står det «ukjent dato» — ikke «fersk».

## «Har vi dekket dette før?»

For hver valgte sak vurderes signalet mot redaksjonens egne artikler. Det svarer
på tre ting samtidig: er saken skrevet før (ikke gjenta), finnes det en egen sak å
bygge videre på (billigere og bedre), og hvilken tone har redaksjonen på temaet.

**Artikkel-API-et har ingen tekstsøk.** Spørsmålet kan derfor ikke stilles til
serveren. Verktøyet henter i stedet et vindu på de 200 nyeste egne artiklene —
tittelfelt, emneknagger, ingress og dato, uten brødtekst — og
`kasus-archivist` leser dem og svarer.

Vurderingen er semantisk, og det er poenget: «prisfall i Bodø» og «nedgang i
kvadratmeterprisen i Nordland» er samme sak for en leser og har ikke ett ord til
felles. Hver kandidat får én av fire dommer:

| Dom | Betyr |
|---|---|
| **SAMME SAK** | Samme hendelse, samme periode. Ikke skriv. |
| **OPPFØLGING** | Samme sakskompleks, men noe er nytt — et annet kvartal, en ny aktør. Skriv, som oppfølging. |
| **FUNDAMENT** | Dekker bakgrunnen, ikke nyheten. Bygg på den. |
| **SAMME TEMA** | Beslektet, ikke samme sak. Ingen dublettrisiko — men det er tonebeviset. |

Datoen avgjør oftere enn tittelen: signalet gjelder Q2, artikkelen fra i vår
gjelder Q1, og det er en sak framfor en gjentakelse. Står forskjellen i
brødteksten, hentes de avgjørende kandidatene i full tekst.

To forbehold følger hvert svar, og de er ikke det samme:

- **Vindusgrensen.** **«Ingen treff» betyr «ikke blant disse artiklene»**, aldri
  «ikke dekket». En sak eldre enn vinduet er usynlig for enhver vurdering — det
  er en egenskap ved API-et, ikke ved vurderingen.
- **At det er en vurdering.** Ikke en regning, og ikke reproduserbar. Derfor står
  artikkel-id, dato og url på hver kandidat: dommen skal kunne overprøves på
  tretti sekunder.

## «Siden sist»

Runden måler mot en **kvittering**: tidspunktet forrige runde ble gjort, lagret i
`.claude/kasus-state.json`. Det er derfor den kan svare «tre nye signaler» framfor
«de 20 nyeste», og derfor den samme saken ikke kommer igjen tre ganger på en dag.

- **Bare kvitteringssteget skriver.** Å hente runden flytter ingenting, så en
  runde som blir avbrutt mister ikke signalene sine.
- **Etterslep er tatt høyde for.** Neste runde ser to timer bakover forbi
  kvitteringen for å fange det som ble indeksert i etterkant, og undertrykker det
  du alt har sett.
- **Rakk du bare noen av sakene**, kvitteres de alene — resten er fortsatt nytt
  neste gang. Runden sier hvilken av de to som ble gjort.
- Fila inneholder verter, tidspunkter og id-er. **Ingen nøkkel.** Organisasjoner
  skilles med et forkortet SHA-256 av nøkkelen, som ikke kan autentisere noe.
  Legg den i `.gitignore`: kvitteringen er DIN runde, ikke redaksjonens, og en
  delt kvittering ville sagt at du har sett noe du ikke har sett.

## Agenter

Begge finnes av samme grunn: **API-et har ingen tekstsøk**, verken på signaler
eller artikler. Et tema er ikke et filter — det må leses. Agentene henter vinduet
selv, så de hundre eller to hundre elementene blir liggende i deres kontekst
framfor i samtalens.

Begge trigges på naturlig språk. Du trenger ingen kommando for å spørre.

`kasus-lookout` besvarer **ett spørsmål om radarsignalene**: «er det noe nytt å
skrive om?», «er det noe om strømpriser?», «hva kom inn denne uka?», «hvor mange
oppfølginger av egne saker ligger der?». Den svarer med kategori, begge datoer,
mønster og klikkbar lenke per signal — og **kvitterer aldri**. Et spørsmål om hva
som ligger der skal ikke kunne spise runden, så forbudet er håndhevet i
`/kasus:test` framfor å være et løfte i en prompt.

`kasus-archivist` besvarer **ett spørsmål om redaksjonens egne artikler**. Den
velger vinduet spørsmålet krever, henter det selv, og svarer med artikkel-id, dato
og url på hvert punkt — pluss forbeholdet om hva vinduet dekket. De 200 artiklene
blir liggende i agentens kontekst, ikke i rundens.

Runden bruker den til «har vi skrevet om dette før?», som er den formen som har en
fast dom per kandidat. Men spørsmålet er ikke begrenset til det: spør du «hva har
vi skrevet om i dag?», «hvem hos oss dekker samferdsel?» eller «hvilken tone har
vi hatt på strømpriser?», er det samme agent — og for et spørsmål med tidsgrense
er svaret fullstendig framfor et utsnitt, fordi vinduet da kan dekke hele
perioden.

`kasus-researcher` besvarer **ett** researchspørsmål: søker bredt, leser smalt,
går til primærkilden framfor omtalen, daterer alt, og skiller mellom bekreftet,
motstridende og ubekreftet. Runden sender ut én per spørsmål, parallelt, maks
seks. Redaksjonens egne og konkurrentens domener er aldri et svar i seg selv.

## Variabler

| Variabel | Påkrevd | Betydning |
|---|---|---|
| `KASUS_API_KEY[_<ENV>]` | **Ja** | Nøkkel fra Innstillinger → API-nøkler. Ekkoes aldri i output. |
| `KASUS_BASE_URL[_<ENV>]` | Nei | Default `https://app.kasus.io`. Sett den for staging eller egen installasjon. |
| `KASUS_TIMEOUT_MS[_<ENV>]` | Nei | Default `30000`. |
| `KASUS_ARTICLES_DIR[_<ENV>]` | Nei | Default `./artikler`. Hit skrives saksforslagene. |
| `KASUS_STATE_FILE[_<ENV>]` | Nei | Default `.claude/kasus-state.json`, tolket fra der du står. Kvitteringen «siden sist» måles mot. |

Per-miljø-variabelen vinner over den delte. Suffikset er miljønavnet i VERSALER
med bindestrek → understrek (`pre-prod` → `PRE_PROD`), og uten `--env` leses BARE
den delte varianten. `/kasus:env --resolve <miljø>` svarer på hva et kall faktisk
ville truffet.

Forutsetter Node 18+ på PATH. Verktøyet er avhengighetsfri ESM — ingen
`npm install`, ingen byggesteg.

## Det du bør vite før du stoler på outputen

- **Nøkkelen avgjør organisasjonen.** Ingen organisasjons-id sendes. «Ingen
  signaler» betyr «ingen for denne organisasjonen», og en `404` betyr «finnes
  ikke ELLER tilhører en annen organisasjon».
- **Artikkel-sjekken er en vurdering av et vindu**, ikke et fulltekstsøk. Den er
  ikke reproduserbar, og vinduet er 200 artikler. Se over.
- **Menneskelig output klipper** lange tekstfelt og sier at den klipper. `--json`
  klipper ingenting.
- **Ingenting oppdiktes.** Mangler en kilde, står det
  `[TRENGER VERIFISERING: …]` eller `[SITAT MANGLER: …]` i forslaget framfor en
  plausibel setning. Antallet markører står i frontmatteren som `apenePunkter`.
- **Forslag er forslag.** Frontmatteren har `status: forslag` og
  `generertAv: claude-code/kasus-plugin`, også når teksten leser godt.

Prinsippene i sin helhet: [`references/principles.md`](./references/principles.md).
API-kontrakten: [`references/kasus-api.md`](./references/kasus-api.md).
Formatet på det som legges på disk:
[`references/proposal-format.md`](./references/proposal-format.md).

## Utvikling

```bash
claude --plugin-dir plugins/kasus                # last pluginen lokalt
bash plugins/kasus/scripts/self-test.sh          # tørt
bash plugins/kasus/scripts/self-test.sh --live   # + ekte kall mot API-et
node --test plugins/kasus/scripts/kasus/         # bare enhetstestene
```

Nye kommandoer og agenter registreres ikke noe sted — de oppdages fra mappa, og
krever omstart av sesjonen. Endrer du verktøyets modi, oppdater `MODES` i
`scripts/kasus/kasus.mjs`; selvtesten sjekker at kommandoene ikke refererer til en
modus som ikke finnes, og at versjonen i `plugin.json`, `marketplace.json` og
verktøyet er den samme.
