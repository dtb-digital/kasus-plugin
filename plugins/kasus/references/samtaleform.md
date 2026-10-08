# Samtaleformen — hva journalisten ser

Pluginen har to lesere, og de trenger ikke det samme.

**Verktøyene og agentene** leser id-er, feltnavn, argumenter og enum-verdier.
Det er arbeidsmateriale, og det er ikke støy der: id-en er det som gjør at
`get_article` kan slå opp saken, at `acknowledge_signals` treffer riktig signal,
og at saksforslaget har et spor tilbake til opphavet.

**Journalisten** leser en melding i en tråd, midt i en arbeidsdag, for å avgjøre
om en sak er verdt en time. Der er den samme id-en støy: den kan ikke åpnes, den
kan ikke ringes, og den tar plassen til det som avgjør valget.

Formen står **ett sted** — her — og at hver brukervendt fil leser den herfra er
en test i `/kasus:test`. Sto den i åtte filer, ville halvparten drevet tilbake
til å ramse opp felt.

## Regelen

Tre ting bærer en sak i tråden:

1. **Tittelen.** Saken, ikke kildens overskrift. «Kvadratmeterprisen faller i
   Nordland for fjerde kvartal» er en sak; «SSB: boligprisstatistikk Q2» er et
   filnavn.
2. **Hva saken er.** Én til to linjer: hva som er nytt, hvor gammelt det er, og
   hvorfor det er verdt en time. Dette er linja som gjør jobben — bruk plassen
   her framfor på metadata.
3. **Lenka.** Som markdown-lenke, på sakens egen linje —
   `[SSB: kvadratmeterprisen falt 4,2 %](https://…)`. Ikke som fotnote, ikke som
   samlet liste nederst, aldri bare som en id.

Ikke mer. Alt annet må fortjene plassen ved å **endre hva journalisten gjør**.
Maks tre linjer per sak, og maks fem–åtte saker lagt fram; er det flere, si hvor
mange du la til side og hva som skilte dem ut.

Dette er ikke et forbud mot fagord. «Signal», «radaren», «saksforslag», «Kasus»
og «kvittere for saken» er redaksjonens egne ord for arbeidet, og de forklarer
noe. Det er **enum-verdiene, feltnavnene, flaggene og id-ene** som er støy — de
forklarer bare pluginen.

## Etterprøvbarheten ligger i lenka, ikke i id-en

Pluginens vurderinger er lesinger og ikke regninger — de kan bomme, og prisen for
det er at hvert punkt må kunne overprøves (prinsipp 8). Det kravet står, men det
er **datoen og lenka** som innfrir det i tråden, ikke id-en: en url kan åpnes på
tretti sekunder, mens en id bare kan slås opp av verktøyet som skrev den.

Så: **id-ene bæres, de skrives ikke ut.** Du trenger dem selv — til
`get_radar_signal`, til `get_article`, til `acknowledge_signals` og til
metadataene i saksforslaget — og du holder dem i din egen kontekst. Journalisten ser dato og
lenke.

## Det som utelates, og det som sies i stedet

| Ikke i tråden | Si dette i stedet |
|---|---|
| id-er — signal, artikkel, brief | ingenting. Lenka er oppslaget |
| kategorinavn: `egen_oppfolging`, `konkurrent_oppfolging`, `konkurrentsak`, `temasok`, `own_followup`, `market_signal` | hva det betyr for jobben: «ny kilde på vår egen sak», «konkurrenten har den — dette er kildene under den», «søketreff, så sjekk datoen» |
| `detectedAt`, og «to datoer» som begrep | hvor gammel **saken** er. Oppdaget-tidspunktet nevnes bare når det forklarer noe: «radaren fant den i dag, men saken er fra 2023» |
| mønsternavn, «uten mønstertreff», `criteria.patterns` | begrunnelsen i prosa, når den er en grunn til å ta saken: «treffer det dere har hatt uttelling på» / «jeg ser ikke hvorfor denne er her» |
| vindusgrensen som feltnavn, `nextCursor`, `truncated`, «vinduet», «hentet av», sideantall | perioden i klartekst, og «det kan finnes mer enn dette» når taket er nådd |
| verktøy og argumenter: `"hours": 72`, `include_dismissed`, `limit`, `get_new_signals`, `acknowledge_signals` med `ids_only` | valget i klartekst: «vil du at jeg går en uke tilbake?», «skal resten regnes som sett?» |
| komponentnavn: `kasus-lookout`, `kasus-archivist`, `kasus-triage`, `kasus-researcher`, ferdighetsnavn | hva journalisten kan **si**: «si at du vil skrive saken», «jeg kan sjekke om vi har dekket det». Slash-kommandoene er unntaket — dem skriver hun selv |
| statusord fra Kasus: `new`, `seen`, `promoted`, `dismissed`, `candidate`, `proposal`, `conversionPotential` | bare når det endrer hva man gjør: «noen i Kasus har alt forkastet denne» |
| dommene `SAMME SAK` / `OPPFØLGING` / `FUNDAMENT` / `SAMME TEMA` som ord | tiltaket: «vi har den saken», «kan skrives som oppfølger på saken fra mai», «bakgrunnen ligger her» |
| verktøyfeil, feilkoder, MCP-navn, filstier i pluginen | hva som mangler, i én setning, og `/kasus:env` |
| feltnavn generelt: `details`, `sources`, `category`, `matchedPattern`, `publishedDate`, `storyAge` | innholdet i feltet |

Er du i tvil om noe hører der, er spørsmålet: **endrer dette hva hun gjør i
neste time?** Gjør det ikke det, hører det i din kontekst.

## Det som ikke er støy

Fem opplysninger blir mindre presise når de fjernes, og de skal stå — i klartekst,
i én setning hver, framfor som en fotnote med feltnavn i:

- **Perioden.** «I går», «siste uke». En periode som ikke sies, leses som «alt».
- **At ingenting her er et søk i alt.** «Dette er de nyeste sakene våre, ikke hele
  arkivet — vi kan ha skrevet om det for et år siden uten at jeg ser det.»
- **En manglende lenke.** «Denne har ingen lenke, så den må vurderes på tittelen.»
- **En gammel sak.** «Saken er fra i fjor sommer, selv om den kom inn i dag.»
- **Hullene.** `[TRENGER VERIFISERING]` og `[SITAT MANGLER]` i forslaget, og hvem
  som må ringes.

Et forbehold som ikke kan forstås er ikke et forbehold. En begrensning sagt med
feltnavn er nettopp det: en linje man hopper over. Si den samme begrensningen på norsk.

## Formen, før og etter

```
FØR
  ▸ [new] SSB: boligprisindeksen falt 4,2 % i Q2
    id: s-4471 · egen_oppfolging · oppdaget 2026-09-02 08:14 (3 t siden) ·
    publisert 2026-09-02 · mønster: «boligmarkedet» · kilde: ssb.no · +2 kilder
    til (se «signal s-4471»)
    LENKE: https://…
    forbehold: 58 av 100 hentet, --kategori egen_oppfolging, taket ikke nådd

ETTER
  **Kvadratmeterprisen faller i Nordland for fjerde kvartal på rad**
  Nye SSB-tall fra i dag, og vi har saken fra Q1 — så vinklingen finnes, tallet
  er det nye. To andre kilder sier det samme.
  [SSB: boligprisindeksen falt 4,2 % i Q2](https://…)
```

Det er ikke færre opplysninger for å spare plass. Det er de samme opplysningene
uten det journalisten ikke kan gjøre noe med — og «vi har saken fra Q1» er noe
`egen_oppfolging` aldri sa til en som ikke kjenner ordet.

## Nummeret er journalistens id

En liste må kunne pekes på: «ta nummer 3». **Nummerér sakene** når du legger fram
flere enn én, og bruk nummeret som håndtaket i resten av samtalen. Det gjør
jobben id-en gjorde, uten å be journalisten lese en streng hun ikke kan bruke til
noe.

Nummeret er ferskvare — det gjelder denne lista, i denne samtalen. Legger du fram
en ny liste, er nummereringen ny, og da sier du det framfor å la «nummer 3» bety
to ting.

## Agentene rapporterer, orkestratoren legger fram

Rapporten fra en agent leses av **orkestratoren**, ikke av journalisten. Der hører
id-ene: uten dem kan ikke saksløpet hente signalet i full bredde, kvittere for det
eller skrive `egneSaker` i saksforslaget. Agentene beholder dem derfor, men samlet
og merket — én linje til slutt, som ikke skal videre:

```
ARBEIDSMATERIALE (ikke til journalisten): 1 = s-4471 · 2 = s-4488 · 3 = s-4402
```

Da er koblingen fra nummer til id bevart for den som skal jobbe videre, og den
ligger på ett sted som er lett å la være å gjengi — framfor spredd utover hver
linje, der den blir med i alt som limes inn.

Og det er nettopp inliminga som er risikoen: **ikke lim inn en agentrapport.** Den
er arbeidsmateriale, og gjengitt ordrett tar den med seg hver id, hvert feltnavn og
hvert forbehold i sin tekniske form.

## Unntakene

- **Journalisten spør selv.** «Hent signal 1234», «hva var id-en på den saken?» —
  da er id-en spørsmålet, og svaret er id-en.
- **Diagnostikk.** `/kasus:env` og `/kasus:test` er tekniske med vilje. Leseren er
  den som setter opp pluginen, og der er organisasjonen og tilgangen hele svaret.
- **Saksforslaget i Kasus.** Metadataene beholder `kasusSignalId`,
  `kasusArtikkelId` og `signalUrl` — det er redaktørens spor tilbake til opphavet,
  og halve verdien av forslaget. Det er ikke en melding i en tråd.
