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
import { bucketOf } from "./render.mjs";

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

/**
 * Forbeholdet som følger signalvinduet.
 *
 * Bygd av filterets tilstand, av samme grunn som på artikkelsiden: et forbehold
 * som gjelder omtrent, blir et forbehold ingen leser. Men signalene har to
 * feller artiklene ikke har, og de står her fordi de endrer hva svaret BETYR:
 *
 * - **Kvitteringen er ikke rørt.** Vinduet er et oppslag, ikke en runde. Det som
 *   ble lest her er fortsatt «nytt» i `/kasus:start`, og det skal det være.
 * - **`--origin` og `--pattern` filtreres LOKALT.** API-et støtter dem ikke, så
 *   de virker bare på det som alt er hentet — et lokalt filter på et avkortet
 *   vindu er ikke et søk.
 *
 * @param {{ vindu: number, hentet?: number, taketNådd?: boolean, filter?: object }} opts
 * @returns {string}
 */
export function signalWindowCaveat({ vindu, hentet = vindu, taketNådd = false, filter = {} }) {
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

  const lokalt = [
    filter.origin ? `--origin ${filter.origin}` : null,
    filter.pattern ? `--pattern «${filter.pattern}»` : null,
  ].filter(Boolean);
  if (lokalt.length) {
    parts.push(
      `${lokalt.join(" og ")} er filtrert LOKALT (API-et støtter det ikke): ${vindu} av ${hentet} ` +
        `hentede passerte. Filteret virker bare på det som alt var hentet.`,
    );
  }

  const server = [
    filter.status ? `status=${filter.status}` : null,
    filter.type ? `type=${filter.type}` : null,
  ].filter(Boolean);
  if (server.length) {
    parts.push(`Serveren filtrerte på ${server.join(" og ")} — resten er ikke vurdert.`);
  }

  parts.push(
    `Kvitteringen «siden sist» er IKKE rørt: dette er et oppslag, og alt her er fortsatt ` +
      `nytt i /kasus:start.`,
    `oppdaget og publisert er to tall — et fritt temasøk kan levere en sak fra 2023 som ble ` +
      `oppdaget i dag. Grunnlaget er tittel og sammendrag, ikke hele researchkonteksten: ` +
      `bruk «signal <id>» for den.`,
  );

  return parts.join(" ");
}
