/**
 * Vinduet av redaksjonens EGNE artikler, lagt fram for lesing.
 *
 * **Artikkel-API-et har ingen tekstsøk-parameter.** `/api/v1/articles` tar
 * `status`, `cms`, `hours`, `limit` og `cursor` — ingen `q`. Ingen spørsmål om
 * innholdet i egne saker kan derfor stilles til serveren. Det må besvares ved å
 * hente et vindu og LESE det.
 *
 * Lesingen ligger ikke her. Den gjøres av `kasus-archivist`, fordi spørsmålene
 * er semantiske: «har vi skrevet om dette før?» er ikke ordoverlapp — «prisfall i
 * Bodø» og «nedgang i kvadratmeterprisen i Nordland» er samme sak for en leser og
 * har ikke ett ord til felles. En idf-vektet ordmatch sto her før og svarte nei på
 * nettopp de tilfellene.
 *
 * Denne modulen gjør det som KAN regnes, og bare det:
 *
 * 1. Plukker ut feltene et spørsmål om egne saker trenger, og kaster resten.
 *    `body` er det tunge feltet, og 200 brødtekster er hundretusener av tokens
 *    for spørsmål som avgjøres på tittel, ingress og dato. De få artiklene som
 *    faktisk betyr noe hentes i full tekst etterpå, med `article <id>`.
 * 2. Formulerer forbeholdet — det som faktisk begrenser svaret, ikke en fast
 *    setning som gjelder omtrent.
 */

import { stripHtml } from "../lib/table.mjs";

/**
 * Feltene et spørsmål om egne saker får se, i den rekkefølgen de betyr noe.
 *
 * `published` er med fordi den avgjør den vanligste dommen av alle: samme tema,
 * men et annet kvartal — altså en oppfølging og ikke en dublett. Den er også hele
 * svaret på «hva har vi skrevet i dag?». `url` er med fordi journalisten skal
 * kunne åpne saken og se selv.
 */
export const ARTICLE_WINDOW_FIELDS = [
  "id",
  "title",
  "kicker",
  "subtitle",
  "tags",
  "sectionTag",
  "excerpt",
  "published",
  "url",
];

/** Tak på ingressen. Nok til å se hva saken handler om, ikke nok til å drukne. */
const EXCERPT_MAX = 400;

/**
 * Én artikkel, redusert til det et spørsmål om egne saker trenger.
 *
 * Tomme felt UTELATES framfor å bli `null`: et vindu på 200 artikler der hver
 * har fire tomme nøkler er fire hundre linjer støy i et grunnlag som skal leses.
 * Et felt som mangler er heller ikke tvetydig her — mangler `published`, er
 * artikkelen upublisert, og det SIES i rendringen.
 *
 * @param {object} article
 * @returns {object}
 */
export function compactArticle(article) {
  const out = {};
  for (const field of ARTICLE_WINDOW_FIELDS) {
    const value = article?.[field];
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      if (!value.length) continue;
      out[field] = value;
      continue;
    }
    if (field === "excerpt") {
      const text = stripHtml(value);
      if (!text) continue;
      out[field] = text.length > EXCERPT_MAX ? `${text.slice(0, EXCERPT_MAX - 1)}…` : text;
      continue;
    }
    out[field] = value;
  }
  return out;
}

/**
 * Forbeholdet som følger vinduet.
 *
 * Det er BYGD av filterets faktiske tilstand framfor å være én fast setning, og
 * det er ikke pynt. De to spørsmålsformene har ulike svakheter, og en fast setning
 * ville løyet på den ene av dem:
 *
 * - **«Har vi skrevet om dette før?»** har ingen tidsgrense, så vinduet ER
 *   grensen: en eldre sak er usynlig, og et tomt svar må ikke leses som «finnes
 *   ikke».
 * - **«Hva har vi skrevet i dag?»** har en tidsgrense, og da er svaret
 *   FULLSTENDIG så lenge taket ikke er nådd. Å resitere et vindusforbehold der
 *   ville såd tvil om et svar som faktisk er komplett — og et forbehold som
 *   gjelder omtrent, blir et forbehold ingen leser.
 *
 * `taketNådd` er det ene som alltid er alvorlig: da mangler svaret data, uansett
 * spørsmål.
 *
 * @param {{ vindu: number, taketNådd?: boolean, filter?: { hours?: number|null, status?: string|null, cms?: string|null } }} opts
 * @returns {string}
 */
export function articleWindowCaveat({ vindu, taketNådd = false, filter = {} }) {
  const parts = [];

  if (taketNådd) {
    parts.push(
      `TAKET ER NÅDD: det finnes MER enn de ${vindu} hentede artiklene, så svaret ` +
        `er ufullstendig uansett spørsmål. Øk --limit.`,
    );
  } else if (filter.hours) {
    parts.push(
      `Vinduet dekker de siste ${filter.hours} timene FULLSTENDIG (${vindu} artikler) — ` +
        `for et spørsmål om denne perioden er svaret komplett.`,
    );
  } else {
    parts.push(
      `Vinduet er de ${vindu} nyeste egne artiklene. API-et har ingen tekstsøk, så dette ` +
        `er alt som kan sjekkes: en eldre sak er usynlig her, og «ingen treff» betyr ` +
        `«ikke blant disse», ikke «finnes ikke».`,
    );
  }

  const filtrert = [
    filter.status ? `status=${filter.status}` : null,
    filter.cms ? `cms=${filter.cms}` : null,
  ].filter(Boolean);
  if (filtrert.length) {
    parts.push(`Filtrert på ${filtrert.join(" og ")} — resten er ikke vurdert.`);
  }

  parts.push(
    `Grunnlaget er tittelfelt og ingress, ikke brødtekst — står poenget i avsnitt fire, ` +
      `må artikkelen hentes med «article <id>».`,
  );

  return parts.join(" ");
}
