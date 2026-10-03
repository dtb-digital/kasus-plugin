# Vindusregelen — hvor langt tilbake en uthenting ser

Definert **ett sted**. `/kasus:start` og ferdigheten `dybdeartikkel` bruker den
begge, og at de gjør det er en test i `/kasus:test`: sto regelen i to filer, ville
de drevet fra hverandre uten at noe sa fra — og da viser inngangen ett vindu mens
arbeidsflyten den sender deg til viser et annet.

## Regelen

**Døgnet er et gulv, ikke et tak.** Vinduet er det største av:

1. **24 timer** — dagens bilde, som er perioden en journalist planlegger for
2. **tiden siden forrige kvittering** — slik at ingenting som er «nytt siden sist»
   faller utenfor lista det skal merkes i

…med mindre brukeren oppgir `--hours N`. Da gjelder N, for alt.

```
V = brukerens --hours N,  hvis oppgitt
    ellers max(24, timene siden kvitteringen)
```

## Slik regnes den ut

Kvitteringen ligger på disk, og det er bare `kasus.mjs vindu` som leser den. Den
trenger organisasjonens slug, så rekkefølgen er fast:

1. **Hvem**: `get_organization` (eller `get_editorial_profile`, som også har
   `organization.slug`).
2. **Vinduet**, alene:

   ```bash
   node <plugin-rot>/scripts/kasus/kasus.mjs vindu --org <slug> --json      # + --hours N om brukeren ba om det
   ```

3. **Listene**, i én melding, alle med `hours: V`.

Scriptet har alt regnet ut regelen. I `--json`:

| Felt | Verdi |
|---|---|
| `meta.listevindu` | **`V`** — timene listene hentes med. Brukes som det er |
| `meta.vindu.hours` | vinduet «siden sist», med etterslepet på 2 timer lagt til og rundet opp |
| `meta.vindu.fra` | starten på «siden sist», som ISO-tid. Et signal oppdaget før dette er ikke nytt |
| `meta.vindu.basis` | `kvittering`, `første saksløp` eller `overstyrt` (jf. `windowFor()` i `state.mjs`) |
| `meta.kvittering` | tidspunktet det sist ble kvittert, eller `null` |
| `meta.altSett` | id-ene som alt er kvittert for |
| `meta.kvitterAt` | tidspunktet som skal brukes i `kvitter --at` hvis saksløpet fullføres |

Feltnavnene er norske, som resten av `meta` — det er `vindu`, ikke `window`.
Verifisert: ingen kvittering gir `24 / første saksløp`, en kvittering fem døgn
tilbake gir `123 / kvittering`, og `--hours 72` gir `72 / overstyrt` med
`listevindu: 72`.

Hvilke signaler som er NYE avgjøres etterpå, mot `meta.vindu.fra` og
`meta.altSett` — regelen står i [`kasus-mcp.md`](kasus-mcp.md), under «Nytt
siden sist».

Det er altså tre runder: **hvem, så vinduet, så listene.** Det er ikke en
forglemmelse. Kjøres alt i samme melding, må vinduet gjettes før kvitteringen er
lest, og da er det ikke regelen lenger.

## Hvorfor gulvet er 24 og ikke mindre

Kommandoen er morgenens blikk. Et døgn er kort nok til at listene er et blikk
framfor en utskrift, og langt nok til å dekke natten radaren jobbet.

## Hvorfor kvitteringen hever det

«Nytt siden sist» måles mot kvitteringen, listene mot et fast antall timer. Er de
to ulike, oppstår en skjøt som ikke er til å se: har journalisten ikke kvittert på
fem døgn, er det fem døgn med nye signaler mens lista bare viser ett — og det er i
lista de nye skal MERKES. De som
faller utenfor kan ikke merkes, og blir usynlige i bolken selv om telleren har
med dem.

Med gulvet kan det ikke skje: lista er alltid minst så bred som «siden sist».

## Konsekvensen som må sies

**Vinduet varierer med hvor lenge det er siden sist.** Kjøres saksløpet daglig, er
det et døgn; har det ligget en uke, er det en uke. Perioden skal derfor **stå i
svaret** — «siste døgn» når det er et døgn, «siste fem døgn (siden du kvitterte
tirsdag)» når det er det. En periode som ikke sies, leses som «alt».

**Takene binder oftere når vinduet vokser.** En radar som leverer seksti signaler i
døgnet fyller et vindu på 100 på under to døgn. Er `nextCursor` ikke `null` når du
stopper, mangler svaret data: si det, og hent en side til framfor å krympe vinduet — det er nettopp de gamle
usette signalene gulvet skulle fange.
