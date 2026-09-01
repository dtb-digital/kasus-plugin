/**
 * Vinduet av radarsignaler, lagt fram for lesing.
 *
 * Samme problem som på artikkelsiden, av samme grunn: `/api/v1/signals` tar
 * `status`, `type`, `hours`, `limit` og `cursor` — **ingen `q`**. Spørsmål om hva
 * signalene HANDLER om kan derfor ikke stilles til serveren. «Er det noe om
 * strømpriser?» eller «er det noe å skrive om i dag?» må besvares ved å hente et
 * vindu og lese det.
 *
 * Lesingen gjøres av `kasus-lookout`. Denne modulen gjør det som kan regnes:
 *
 * 1. Reduserer hvert signal til det et spørsmål trenger. `details` er det tunge
 *    feltet — `description`, `snippet`, `actors` og `keyFigures` er full
 *    researchkontekst, og 100 av dem er titusener av tokens for et spørsmål som
 *    avgjøres på tittel, kategori og to datoer. Hele signalet hentes etterpå med
 *    `signal <id>`, for de få som betyr noe.
 * 2. Formulerer forbeholdet — det som faktisk begrenser svaret.
 *
 * **Navnene sier hvor feltet kommer fra.** API-ets egne felt beholder API-ets
 * navn; det pluginen har regnet ut selv får et norsk navn (`kategori`, `mønster`,
 * `publisert`, `kilder`). Det er samme regel som skiller `data` fra `meta` i
 * JSON-svaret: et felt vi har funnet på skal ikke være til å forveksle med et som
 * kom fra serveren.
 */

import { clip } from "../lib/table.mjs";
import { bucketOf, publishedNote, SIGNAL_BUCKETS, STALE_AFTER_DAYS } from "./render.mjs";

/** Feltene et spørsmål om radarsignaler får se. */
export const SIGNAL_WINDOW_FIELDS = [
  "id",
  "title",
  "kategori",
  "status",
  "type",
  "origin",
  "mønster",
  "oppdaget",
  "publisert",
  "sourceLabel",
  "url",
  "kilder",
  "summary",
];

/** Tak på sammendraget. Nok til å vite hva signalet er, ikke nok til å drukne. */
const SUMMARY_MAX = 400;

/**
 * Ett signal, redusert til det et spørsmål trenger.
 *
 * `kategori` er med selv om den er utledet, og det er et bevisst unntak fra
 * regelen om at utledede felt hører i `meta`. Grunnen er den samme som gjør at
 * `meta.grupper` finnes: kategorien krever at `origin` og `type` leses SAMTIDIG,
 * og en leser som utleder den selv kan utlede den ANNERLEDES enn pluginen gjør
 * ellers. Da ville et fritt temasøk på et to år gammelt blogginnlegg ikke vært
 * til å skille fra konkurrentens forsidesak fra i morges.
 *
 * @param {object} signal
 * @returns {object}
 */
export function compactSignal(signal) {
  const details = signal?.details ?? {};
  const kilder = Array.isArray(signal?.sources) ? signal.sources.length : 0;

  const out = {
    id: signal?.id,
    title: signal?.title,
    kategori: bucketOf(signal ?? {}),
    status: signal?.status,
    type: signal?.type,
    origin: signal?.origin ?? null,
    mønster: details.matchedPattern ?? null,
    oppdaget: signal?.detectedAt ?? null,
    publisert: details.publishedDate ?? null,
    sourceLabel: signal?.sourceLabel ?? null,
    url: signal?.url ?? null,
    kilder,
    summary: signal?.summary ? clip(signal.summary, SUMMARY_MAX) : null,
  };

  // Til forskjell fra artikkelvinduet BEHOLDES de tomme feltene her, som `null`.
  // De betyr noe: `mønster: null` er «radaren fant dette uten at profilen
  // forklarer hvorfor», `publisert: null` er «ukjent dato, ikke fersk», og
  // `url: null` er «må vurderes på tittelen alene». Utelatt ville de tre blitt
  // lest som at spørsmålet ikke ble stilt.
  return out;
}

// ---------------------------------------------------------------------------
// Lokale filtre
// ---------------------------------------------------------------------------

/**
 * Filtrene API-et ikke kan gjøre.
 *
 * `/api/v1/signals` tar `status`, `type`, `hours`, `limit` og `cursor` — og
 * verktøyet sender alle fem. Resten må gjøres på det som er hentet, og det er
 * ikke en nødløsning: fire av spørsmålene redaksjonen faktisk stiller kan ikke
 * uttrykkes serverside i det hele tatt.
 *
 * **`hours` måler `detectedAt`, ikke publiseringsdato.** Det er den viktigste av
 * dem. Et fritt temasøk hentes uavhengig av når saken ble publisert, så
 * `--hours 24` svarer på «hva fant radaren i dag», ikke «hva er ferskt». De to
 * forveksles, og forvekslingen sender en journalist til en kilde om en sak som
 * ble ferdigbehandlet i 2023.
 *
 * ÉN definisjon, fordi tre steder bruker svaret: forbeholdet, rendringen og
 * `meta`. Tre kopier av «hva ble filtrert bort» har driftet før.
 */
const LOCAL_FILTERS = [
  {
    key: "origin",
    flagg: (v) => `--origin ${v}`,
    beskrivelse: () => "opphav",
    test: (s, v) => (v === "null" || v === "topic_search" ? s.origin === null : s.origin === v),
  },
  {
    key: "kategori",
    flagg: (v) => `--kategori ${v}`,
    beskrivelse: () => "pluginens egen kategori",
    test: (s, v) => bucketOf(s) === v,
  },
  {
    key: "pattern",
    flagg: (v) => `--pattern «${v}»`,
    beskrivelse: () => "mønstertreff",
    test: (s, v) =>
      typeof s.details?.matchedPattern === "string" &&
      s.details.matchedPattern.toLowerCase().includes(String(v).toLowerCase()),
  },
  {
    key: "utenMønster",
    flagg: () => "--uten-monster",
    beskrivelse: () => "signaler profilen IKKE forklarer",
    test: (s) => !s.details?.matchedPattern,
  },
  {
    key: "gamle",
    flagg: () => "--gamle",
    beskrivelse: () => `publisert mer enn ${STALE_AFTER_DAYS} dager før de ble oppdaget`,
    test: (s) => publishedNote(s).startsWith("GAMMEL SAK"),
  },
  {
    key: "ferske",
    flagg: () => "--ferske",
    // Ukjent dato er IKKE fersk. Det er dokumentert ellers i pluginen, og her er
    // det en filterregel: et signal uten publiseringsdato faller ut, og antallet
    // sies, framfor å bli med på et løfte om ferskhet ingen kan innfri.
    beskrivelse: () => "kjent publiseringsdato, og ikke gammel sak",
    test: (s) => {
      const note = publishedNote(s);
      return !note.startsWith("GAMMEL SAK") && !note.includes("ukjent dato");
    },
  },
  {
    key: "publisert",
    flagg: (v) => `--publisert ${v}`,
    beskrivelse: (v) => `PUBLISERT siste ${v} timer (ikke oppdaget — det er --hours)`,
    test: (s, v) => {
      const ms = Date.parse(s.details?.publishedDate ?? "");
      if (Number.isNaN(ms)) return false;
      return Date.now() - ms <= v * 3600_000;
    },
  },
  {
    key: "utenLenke",
    flagg: () => "--uten-lenke",
    beskrivelse: () => "signaler ingen kan åpne (må vurderes på tittelen alene)",
    test: (s) => !s.url,
  },
];

/** Kategoriene `--kategori` godtar. Samme nøkler som `meta.grupper`. */
export const SIGNAL_CATEGORIES = SIGNAL_BUCKETS.map((b) => b.key);

/**
 * Bruker de lokale filtrene, og sier hva som skjedde.
 *
 * @param {object[]} items
 * @param {Record<string, unknown>} filter
 * @returns {{ kept: object[], lokale: Array<{flagg: string, beskrivelse: string}>, utenDato: number }}
 */
export function applyLocalFilters(items, filter = {}) {
  const aktive = LOCAL_FILTERS.filter(
    (f) => filter[f.key] !== null && filter[f.key] !== undefined && filter[f.key] !== false,
  );

  const kept = items.filter((s) => aktive.every((f) => f.test(s, filter[f.key])));

  // Hvor mange som falt ut fordi datoen MANGLER, ikke fordi den var for gammel.
  // Uten dette tallet ser «3 ferske» ut som hele bildet, mens tolv signaler kan
  // ha falt ut på en tom `publishedDate` — og de er ikke vurdert, de er ukjente.
  const datofilter = aktive.some((f) => f.key === "ferske" || f.key === "publisert");
  const utenDato = datofilter
    ? items.filter((s) => Number.isNaN(Date.parse(s.details?.publishedDate ?? ""))).length
    : 0;

  return {
    kept,
    lokale: aktive.map((f) => ({
      flagg: f.flagg(filter[f.key]),
      beskrivelse: f.beskrivelse(filter[f.key]),
    })),
    utenDato,
  };
}

/**
 * Forbeholdet som følger signalvinduet.
 *
 * Bygd av filterets tilstand, av samme grunn som på artikkelsiden: et forbehold
 * som gjelder omtrent, blir et forbehold ingen leser. Men signalene har tre
 * feller artiklene ikke har, og de står her fordi de endrer hva svaret BETYR:
 *
 * - **Kvitteringen er ikke rørt.** Vinduet er et oppslag, ikke et saksløp. Det som
 *   ble lest her er fortsatt «nytt» i saksløpet, og det skal det være.
 * - **De fleste filtrene virker LOKALT.** API-et kan bare `status`, `type` og
 *   `hours`, så resten treffer bare det som alt er hentet. Et lokalt filter på et
 *   avkortet vindu er ikke et søk, og «2 treff» kan bety «2 av de 100 vi så».
 * - **`hours` måler oppdaget, ikke publisert.** Et fritt temasøk kan levere en sak
 *   fra 2023 som ble oppdaget i dag. `--publisert` og `--ferske` er de som måler
 *   sakens egen alder.
 *
 * @param {{ vindu: number, hentet?: number, taketNådd?: boolean, filter?: object, lokale?: Array<{flagg: string, beskrivelse: string}>, utenDato?: number }} opts
 * @returns {string}
 */
export function signalWindowCaveat({
  vindu,
  hentet = vindu,
  taketNådd = false,
  filter = {},
  lokale = [],
  utenDato = 0,
}) {
  const parts = [];

  if (taketNådd) {
    parts.push(
      `TAKET ER NÅDD: det finnes MER enn de ${hentet} hentede signalene, så svaret er ` +
        `ufullstendig uansett spørsmål. Øk --limit.`,
    );
  } else if (filter.hours) {
    parts.push(
      `Vinduet dekker de siste ${filter.hours} timene FULLSTENDIG (${hentet} signaler etter ` +
        `oppdaget-tidspunkt) — for et spørsmål om denne perioden er svaret komplett.`,
    );
  } else {
    parts.push(
      `Vinduet er de ${hentet} sist oppdagede signalene. API-et har ingen tekstsøk, så dette ` +
        `er alt som kan sjekkes: et eldre signal er usynlig her.`,
    );
  }

  const server = [
    filter.status ? `status=${filter.status}` : null,
    filter.type ? `type=${filter.type}` : null,
  ].filter(Boolean);
  if (server.length) {
    parts.push(`Serveren filtrerte på ${server.join(" og ")} — resten er ikke hentet.`);
  }

  if (lokale.length) {
    parts.push(
      `${lokale.map((l) => `${l.flagg} (${l.beskrivelse})`).join(" + ")} er filtrert LOKALT ` +
        `(API-et støtter det ikke): ${vindu} av ${hentet} hentede passerte. Filteret virker bare ` +
        `på det som alt var hentet — hev --limit for å filtrere et større utvalg.`,
    );
  }

  if (utenDato) {
    parts.push(
      `${utenDato} av de hentede har INGEN publiseringsdato og falt ut av datofilteret. De er ` +
        `ukjente, ikke gamle — «mangler datoen» er ikke det samme som «ikke fersk».`,
    );
  }

  parts.push(
    `Kvitteringen «siden sist» er IKKE rørt: dette er et oppslag, og alt her er fortsatt ` +
      `nytt i saksløpet — ferdigheten dybdeartikkel.`,
    `oppdaget og publisert er to tall — --hours måler oppdaget, --publisert måler sakens ` +
      `egen alder. Grunnlaget er tittel og sammendrag, ikke hele researchkonteksten: bruk ` +
      `«signal <id>» for den.`,
  );

  return parts.join(" ");
}
