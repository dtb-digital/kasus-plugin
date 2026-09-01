---
name: hjelp
description: Forklarer hvordan kasus-pluginen brukes — hva den gjør, hvilken inngang som hører til hvilken jobb, hva ordene i outputen betyr, og hva som er galt når noe ikke virker. Skal brukes på spørsmål OM pluginen framfor bestillinger TIL den: «hvordan bruker jeg denne?», «hva kan kasus?», «hjelp», «hvor begynner jeg?», «hva er forskjellen på et saksløp og en oppfølger?», «hvorfor får jeg ingen signaler?», «hvor legger den saksforslagene?», «hva betyr GAMMEL SAK / kvitteringen / SAMME SAK?», «kan den skrive noe tilbake til Kasus?», «hvordan setter jeg opp API-nøkkelen?». Skal IKKE brukes når bestillingen er selve arbeidet: «finn meg en sak å skrive» er ferdigheten dybdeartikkel, «er det noe nytt?» er kasus-lookout, «har vi skrevet om X?» er kasus-archivist. Svarer på spørsmålet som ble stilt og tilbyr å starte riktig inngang — henter aldri signaler eller artikler, skriver ingenting og kvitterer aldri.
---

Hjelp en journalist bruke pluginen. Den gjør **én ting**: går fra et radarsignal
til et saksforslag på disk, i seks steg — signaler siden sist, journalisten
velger sak, sjekk mot egne artikler, bredt søk, forslag, kvittering.

Alt annet i pluginen er enten et blikk inn i det samme materialet, eller
diagnostikk.

## Slik svarer du

1. **Svar på spørsmålet som ble stilt.** Ikke legg fram hele manualen fordi noen
   spurte om én ting. «Hvor havner saksforslagene?» er to setninger, ikke en
   omvisning.
2. **Bare når spørsmålet ER «hva kan denne?»** legger du fram tabellen under —
   som fire–fem linjer om hva journalisten kan si, ikke som en kommandoliste.
3. **Snakk om jobben, ikke om verktøyet.** Journalisten skal vite hva som må sies
   for å få gjort noe. Kommandonavn er en snarvei, ikke inngangen.
4. **Tilby å starte, og la journalisten bestemme.** «Vil du at jeg kjører saksløpet
   nå?» er riktig avslutning på et hjelpesvar. Å starte den uoppfordret er det
   ikke: saksløpet koster tid og **flytter kvitteringen**.
5. **Du gjør ikke arbeidet herfra.** Ingen signaler, ingen artikler, ingen
   research, ingen fil på disk, aldri en kvittering. Blir spørsmålet underveis en
   bestilling — «ok, finn meg en sak da» — går du over i riktig ferdighet
   framfor å svare på den her.

Du kan kjøre to ting selv, og begge er rent lokale — de leser env-variabler og
pluginens eget manifest, uten å røre nettverket:

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/check-env.sh --resolve
node ${CLAUDE_PLUGIN_ROOT}/scripts/kasus/kasus.mjs --list
```

Den første når spørsmålet er «hvorfor virker det ikke» — det er samme sjekk som
`/kasus:env`, og du skal si at det er den. Den andre når du er i tvil om hva
verktøyet faktisk har av modi, framfor å gjette.

## Hva journalisten kan si

Ingen av linjene i midterste kolonne må sies ordrett. Poenget er at bestillingen
i seg selv er inngangen — det finnes ikke noe kommandonavn man må huske først.

| Vil du… | Si noe sånt som | Hva som skjer |
|---|---|---|
| **finne en sak å skrive** | «jeg skal skrive en dybdeartikkel», «finn meg en sak», «jeg trenger noe å jobbe med i dag», «kjør saksløpet» (eller «kjør runden» — det gamle ordet virker fortsatt) | Hele saksløpet — ferdigheten `dybdeartikkel`. Seks steg, du velger saken, den skriver et **saksforslag på disk** og kvitterer. |
| **jobbe med ett bestemt signal** | «følg opp signal 1234», «lag et forslag på denne» | Samme saksløp, men den hopper over prioriteringen. |
| **jobbe med et tema** | «kan vi gjøre noe på boligmarkedet i Bodø?» | Samme saksløp. Temaet matches mot radarens vindu først — **finner den ingen signaler, stopper den**, for et forslag uten opphav er bare et nettsøk. |
| **følge opp en av deres EGNE saker** | «hva har skjedd siden vi skrev om strømstøtte?», «kan vi følge opp denne?» | Ferdigheten `oppfolgersak`. Vinklingen finnes alt — den leter etter **det nye**, og stopper hvis det ikke finnes noe. |
| **bare se hva som ligger der** | «er det noe nytt å skrive om?», «er det noe om strømpriser?», «hva kom inn denne uka?» | `kasus-lookout` leser signalene og svarer. **Kvitterer aldri, skriver ingenting.** |
| **vite hva dere selv har dekket** | «har vi skrevet om dette?», «hva publiserte vi i dag?», «hvem hos oss dekker samferdsel?» | `kasus-archivist` leser deres egne artikler og svarer med id, dato og lenke. |
| **komme i gang, uten å ha bestemt deg** | `/kasus:start` | Henter nye signaler + ukas egen produksjon, sier hva som henger sammen, og **spør hva du vil gjøre** — en ny sak, en oppfølger, eller et spørsmål. Utfører ingenting selv: svaret ditt sender deg videre i riktig ferdighet. |
| **sjekke oppsettet** | `/kasus:env`, eller `--resolve` for å se hvilken installasjon et kall treffer | Diagnostikk. |
| **sjekke at pluginen er hel** | `/kasus:test` | Diagnostikk. `--live` tester også tilkoblingen. |

Vil du velge en arbeidsflyt med vilje framfor å beskrive jobben, er
`/kasus:dybdeartikkel` og `/kasus:oppfolgersak` de samme to ferdighetene fra
menyen. `/kasus:hjelp` er denne.

Den tredje agenten, `kasus-researcher`, står ikke i tabellen med vilje: den søker
og leser primærkilder, og saksløpet sender ut én per researchspørsmål. Den er ikke
noe journalisten henvender seg til direkte.

## De tre grensene som forvirrer mest

**Se eller jobbe.** «Er det noe nytt?» og «finn meg en sak» ser like ut og er det
ikke. Det første er et spørsmål om hva som ligger der, og det svarer en agent på
uten å røre noe. Det andre setter i gang et saksløp som researcher, skriver til
disk og **flytter kvitteringen**. Er du i tvil om hva du vil, spør først — det
koster ingenting, og spørsmålet kan ikke spise saksløpet din.

**Signal eller egen artikkel.** Saksløpet starter på noe radaren fant. Oppfølgeren
starter på noe redaksjonen alt har publisert. Det er to jobber: saksløpet må finne
både vinkling og nyhet, oppfølgeren har vinklingen ferdig og trenger bare det nye.

**Lookout eller archivist.** `kasus-lookout` vet hva radaren har funnet ute i
verden. `kasus-archivist` vet hva **dere** har publisert. «Er det noe om
strømpriser?» går til den første, «har vi skrevet om strømpriser?» til den andre.

## Første gang: oppsettet

Fire ting, og den fjerde er den folk glemmer:

1. Pluginen installeres med **prosjekt-scope** i redaksjonens repo, så den følger
   repoet framfor din maskin.
2. Nøkkelen lages i Kasus under **Innstillinger → API-nøkler**. Den vises **kun
   én gang**.
3. Den settes som `KASUS_API_KEY` under `env` i `.claude/settings.local.json` —
   den fila hører til deg og skal i `.gitignore`. **`.env`-filer leses ikke av
   Claude Code**, og det er den desidert vanligste feilen.
4. **Start sesjonen på nytt.** Nye `env`-innslag og nye komponenter plukkes opp
   ved oppstart, ikke underveis.

Så: `/kasus:env --resolve`. Den sier hvilken installasjon kallene går mot og
hvilken variabel hver verdi kom fra. Detaljene, inkludert de tre scopene, står i
[`README.md`](../../README.md).

## Når noe ikke virker

| Det du ser | Som regel fordi | Gjør dette |
|---|---|---|
| `MANGLER: KASUS_API_KEY` | Nøkkelen står i en `.env`, eller sesjonen er ikke startet på nytt | Flytt den til `env` i `.claude/settings.local.json`, og start sesjonen på nytt |
| «Ingen signaler» | Vinduet er tomt for **denne organisasjonen** — nøkkelen avgjør hvilken | Prøv et bredere vindu (`/kasus:start --hours 168`). `/kasus:env --resolve` sier hvilken installasjon du treffer, `/kasus:test --live` hvilken organisasjon nøkkelen tilhører |
| Saksløpet sier «ingenting nytt», men du vet det ligger signaler der | Kvitteringen er flyttet — de er sett før | Be om et bredere vindu, eller «ta med det som er forkastet» |
| `404` på et signal eller en artikkel | Finnes ikke, **eller** tilhører en annen organisasjon | Sjekk id-en, og hvilken nøkkel som er i bruk |
| Ferdigheten trigges ikke, eller `/kasus:…` finnes ikke | Sesjonen er ikke startet på nytt, eller pluginen er ikke slått på i dette prosjektet | Start på nytt i prosjektmappa, og sjekk `enabledPlugins` i `.claude/settings.json` |
| Saksforslagene dukker ikke opp der du venter | `./artikler` og `.claude/kasus-state.json` er **relative til der du står** | Sjekk at sesjonen kjører fra prosjektmappa |
| Noe annet er rart | — | `/kasus:test` sier om pluginen selv er hel, `--live` om tilkoblingen er det |

## Ordene du møter i outputen

| Ordet | Betyr |
|---|---|
| **signal** | Noe radaren har funnet. Alltid med en lenke, og det er inngangsvilkåret for et saksforslag |
| **kvitteringen / «siden sist»** | Tidspunktet forrige saksløp ble gjort, lagret i ditt eget repo. Derfor kan saksløpet si «tre nye» framfor «de 20 nyeste» — og derfor kommer ikke den samme saken tre ganger på en dag |
| **oppdaget vs. publisert** | Når radaren fant signalet, kontra hvor gammel saken er. **To ulike tall** |
| **GAMMEL SAK** | De to datoene ligger mer enn en uke fra hverandre. Et fritt temasøk kan levere en sak fra 2023 «oppdaget for 45 min siden» |
| **ukjent dato** | Publiseringsdatoen mangler. Det er ikke det samme som gammel |
| **de fire kategoriene** | Oppfølging av EGEN sak, oppfølging av KONKURRENTSAK, konkurrentsak direkte, fritt temasøk. De krever ulike tiltak — se README |
| **SAMME SAK / OPPFØLGING / FUNDAMENT / SAMME TEMA** | Dommen dekningssjekken gir hver kandidat: ikke skriv / skriv som oppfølging / bygg på den / beslektet, og tonebevis |
| `[TRENGER VERIFISERING: …]`, `[SITAT MANGLER: …]` | Et hull som er markert framfor fylt ut. Antallet står i forslagets frontmatter som `apenePunkter` |
| **`status: forslag`** | Filen er et utkast fra en maskin, også når teksten leser godt |

## Det du bør si når noen stoler for mye på svaret

- **«Ingen treff» er ikke «ikke dekket».** Dekningssjekken leser et vindu på de
  200 nyeste egne artiklene. En eldre sak er usynlig for den, og **kladder er
  utenfor vinduet** — «ingen treff» betyr heller ikke «ingen kollega jobber med
  dette».
- **Nøkkelen avgjør organisasjonen.** Ingen organisasjons-id sendes noe sted.
- **Ingenting dikter pluginen opp.** Mangler en kilde, står det som en markør.
- **Mot Kasus er alt lesing.** Det pluginen skriver, skriver den til disk i ditt
  eget repo: forslagene i `./artikler`, kvitteringen i
  `.claude/kasus-state.json`.

Vil noen ha begrunnelsene bak dette framfor reglene, ligger de i
[`references/principles.md`](../../references/principles.md).
