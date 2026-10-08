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

…med mindre brukeren oppgir `--hours N` (eller ber om en periode). Da gjelder N,
for alt.

```
V = brukerens --hours N,  hvis oppgitt
    ellers max(24, timene siden kvitteringen)
```

## Slik regnes den ut

Kvitteringen er det bare `get_new_signals` som kjenner. Den kjøres derfor
**først**, alene, og oppgir vinduet sitt i svaret:

```
get_new_signals {}                 # eller { "hours": N } når brukeren oppga --hours N
```

Tallet står i **`window.hours`**. Ved siden av står:

| Felt | Verdi |
|---|---|
| `window.basis` | `kvittering`, `første saksløp` eller `overstyrt` |
| `window.from` | starten på vinduet (ISO 8601) |
| `checkpoint` | tidspunktet det sist ble kvittert, eller `null` |

Serveren har alt lagt til etterslepet på 2 timer og rundet timene opp, så tallet
brukes som det er: ingen kvittering gir `24 / første saksløp`, en kvittering fem
døgn tilbake gir `123 / kvittering`, og `hours: 72` gir `72 / overstyrt`.

`V` settes til `max(24, window.hours)` — og deretter hentes listene, i én melding,
alle med `"hours": V`.

To runder er altså minimum: **`get_new_signals` først, listene etterpå.** Det er
ikke en forglemmelse. Kjøres alt i samme melding, må vinduet gjettes før
kvitteringen er lest, og da er det ikke regelen lenger.

## Hvorfor gulvet er 24 og ikke mindre

Kommandoen er morgenens blikk. Et døgn er kort nok til at listene er et blikk
framfor en utskrift, og langt nok til å dekke natten radaren jobbet.

## Hvorfor kvitteringen hever det

`get_new_signals` måler mot kvitteringen, listene mot et fast antall timer. Er de to ulike,
oppstår en skjøt som ikke er til å se: har journalisten ikke kvittert på fem
døgn, rapporterer `get_new_signals` fem døgn med signaler mens lista ved siden av
viser ett — og signal-id-ene derfra brukes nettopp til å MERKE signalene i lista. De som
faller utenfor kan ikke merkes, og blir usynlige i bolken selv om telleren har
med dem.

Med gulvet kan det ikke skje: lista er alltid minst så bred som «siden sist».

## Konsekvensen som må sies

**Vinduet varierer med hvor lenge det er siden sist.** Kjøres saksløpet daglig, er
det et døgn; har det ligget en uke, er det en uke. Perioden skal derfor **stå i
svaret** — «siste døgn» når det er et døgn, «siste fem døgn (siden du kvitterte
tirsdag)» når det er det. En periode som ikke sies, leses som «alt».

**Takene binder oftere når vinduet vokser.** En radar som leverer seksti signaler i
døgnet fyller `"limit": 100` på under to døgn. Er `nextCursor` satt (eller
`truncated` sann), mangler svaret data: si det, og hent neste side med `cursor`
framfor å krympe vinduet — det er nettopp de gamle usette signalene gulvet skulle
fange.
