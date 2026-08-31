/**
 * «Har vi dekket dette før?» — lokal matching mot redaksjonens egne artikler.
 *
 * **Artikkel-API-et har ingen tekstsøk-parameter.** `/api/v1/articles` tar
 * `status`, `cms`, `hours`, `limit` og `cursor` — ingen `q`. Matchingen må derfor
 * gjøres her, på et vindu av artikler verktøyet har hentet, og det har to
 * konsekvenser som MÅ stå i hvert svar:
 *
 * 1. **En tom treffliste betyr «ikke blant de N nyeste artiklene»**, ikke «ikke
 *    dekket». Det er den ene feilslutningen som får en journalist til å skrive en
 *    sak redaksjonen publiserte i fjor.
 * 2. **Dette er ordoverlapp, ikke semantikk.** «Boligprisfall i Bodø» og
 *    «Nedgang i kvadratmeterpris i Nordland» er samme sak for et menneske og
 *    null treff her. Treffene er et utgangspunkt for å LESE, ikke en konklusjon.
 *
 * Alternativet — å la en agent lese 200 artikler for hvert signal — er tregt,
 * dyrt og mindre etterprøvbart: her er det synlig hvilke ord som traff.
 */

/**
 * Norske stoppord. Bevisst kort: lista skal fjerne det som ellers treffer ALT,
 * ikke drive språkvask. Et stoppord for mye er et tapt treff ingen ser.
 */
const STOPWORDS = new Set([
  "og", "eller", "men", "som", "det", "den", "de", "der", "her", "har", "hadde",
  "kan", "skal", "vil", "være", "er", "var", "blir", "ble", "for", "til", "fra",
  "med", "uten", "etter", "før", "over", "under", "mellom", "hos", "ved", "mot",
  "ikke", "ingen", "noe", "noen", "alle", "andre", "flere", "mange", "mye",
  "hvor", "hva", "hvem", "når", "hvorfor", "hvordan", "seg", "sin", "sine",
  "sitt", "hans", "hennes", "deres", "vår", "våre", "dette", "disse", "denne",
  "man", "har", "gjør", "får", "går", "kom", "kommer", "sier", "sa", "ifølge",
  "enn", "slik", "bare", "også", "helt", "svært", "ganske", "blant", "både",
  "prosent", "million", "millioner", "milliard", "milliarder", "kroner",
  "nye", "ny", "nytt", "stor", "store", "år", "åra", "året", "dag", "dager",
]);

/**
 * Minste ordlengde som teller. Tre tegn slipper gjennom forkortelser som er
 * hele poenget i en nyhetssak — SSB, NAV, EØS — mens to tegn er «en», «av», «på».
 */
const MIN_TERM_LENGTH = 3;

/**
 * Vektene per felt. Tittelen veier mest fordi den er saken; `excerpt` minst
 * fordi et ord langt nede i teksten kan være en bisetning.
 */
const FIELD_WEIGHTS = [
  { field: "title", weight: 4 },
  { field: "kicker", weight: 2 },
  { field: "subtitle", weight: 2 },
  { field: "tags", weight: 2 },
  { field: "sectionTag", weight: 1 },
  { field: "excerpt", weight: 1 },
];

/** Tyngste felt. Normaliseringen måler mot «alle søkeord traff i tittelen». */
const MAX_WEIGHT = Math.max(...FIELD_WEIGHTS.map((f) => f.weight));

/** Fjerner HTML og normaliserer whitespace. `body` fra Labrador ER HTML. */
export function stripHtml(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|amp|quot|#39|laquo|raquo);/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tekst → sett av søkbare ord.
 *
 * Tall beholdes når de henger sammen med noe (`q2`, `2026`), fordi et årstall
 * eller et kvartal ofte ER det som skiller to saker om samme tema.
 *
 * @param {string} text
 * @returns {Set<string>}
 */
export function terms(text) {
  const flat = stripHtml(text).toLowerCase();
  const out = new Set();
  for (const raw of flat.split(/[^0-9a-zæøåäöüéèáà]+/i)) {
    if (raw.length < MIN_TERM_LENGTH) continue;
    if (STOPWORDS.has(raw)) continue;
    out.add(raw);
  }
  return out;
}

/** Teksten fra ett felt på en artikkel, uansett om det er streng eller liste. */
function fieldText(article, field) {
  const value = article?.[field];
  if (Array.isArray(value)) return value.join(" ");
  return typeof value === "string" ? value : "";
}

/**
 * Hvor særegent hvert søkeord er I DETTE utvalget av artikler.
 *
 * Uten dette rangerer ett treff på «bolig» like høyt som ett treff på
 * «kvadratmeterpris», og for en redaksjon som skriver om bolig hver uke er det
 * første nesten uten informasjon. Dokumentfrekvensen finnes gratis: artiklene er
 * alt hentet, så korpuset ER vinduet vi matcher mot.
 *
 * Formelen er den vanlige idf-en, `log(1 + N/(1+df))`: et ord som står i alle
 * artiklene får nær null, et ord som står i én får mest.
 *
 * @param {object[]} articles
 * @returns {Map<string, number>} ord → idf
 */
export function documentFrequency(articles) {
  const df = new Map();
  for (const article of articles) {
    const seen = new Set();
    for (const { field } of FIELD_WEIGHTS) {
      for (const term of terms(fieldText(article, field))) seen.add(term);
    }
    for (const term of seen) df.set(term, (df.get(term) ?? 0) + 1);
  }
  return df;
}

const idfOf = (term, df, total) => Math.log(1 + total / (1 + (df.get(term) ?? 0)));

/**
 * Poengsetter én artikkel mot søkeordene.
 *
 * `styrke` er en SORTERINGSNØKKEL, ikke et likhetsmål — summen av
 * feltvekt × idf for hvert ord som traff. Den er bevisst ikke normalisert til
 * 0–1: et normalisert tall ser ut som en prosent, og da leses «0,24» som «24 %
 * likt», noe det ikke er. Innenfor ett kall er den bare til å rangere
 * kandidatene for ETT signal, og det er alt den brukes til.
 *
 * Det som faktisk skal leses, er `matched`: hvilke ord traff, og hvor. Det er
 * etterprøvbart, og en journalist kan se på det og avgjøre selv om treffet er
 * samme sak eller bare samme tema.
 *
 * @param {object} article
 * @param {Set<string>} query
 * @param {{ df?: Map<string, number>, total?: number }} [corpus]
 */
export function scoreArticle(article, query, { df = new Map(), total = 0 } = {}) {
  if (!query.size) return { styrke: 0, matched: [], where: {}, toppfelt: 0 };

  const matched = new Map();
  const where = {};

  for (const { field, weight } of FIELD_WEIGHTS) {
    const fieldTerms = terms(fieldText(article, field));
    const hits = [...query].filter((term) => fieldTerms.has(term));
    if (!hits.length) continue;
    where[field] = hits;
    for (const hit of hits) {
      // Et ord teller én gang, i det TYNGSTE feltet det står i. Ellers vinner en
      // artikkel som gjentar samme ord fem ganger over en som handler om det.
      if (!matched.has(hit)) matched.set(hit, weight);
    }
  }

  let styrke = 0;
  for (const [term, weight] of matched) styrke += weight * idfOf(term, df, total);

  return {
    styrke: Number(styrke.toFixed(2)),
    matched: [...matched.keys()],
    where,
    toppfelt: Math.max(0, ...matched.values()),
  };
}

/**
 * Terskelen for at et treff vises — en REGEL, ikke et tall.
 *
 * Et treff vises når det har minst to felles ord, ELLER ett felles ord i et
 * tungt felt (tittel, stikktittel, undertittel, emneknagg). Regelen er valgt
 * slik fordi kostnadene er asymmetriske: å vise en artikkel som ikke var samme
 * sak koster tretti sekunders lesing, mens å SKJULE en sak redaksjonen alt har
 * publisert koster en dublett på nett. Den er også mulig å ettergå — man ser
 * ordene som traff, og kan avgjøre selv.
 */
export const MIN_TERMS = 2;
export const HEAVY_FIELD_WEIGHT = 2;

export function isCandidate({ matched, toppfelt }) {
  return matched.length >= MIN_TERMS || toppfelt >= HEAVY_FIELD_WEIGHT;
}

/**
 * Rangerer artiklene mot en tekst (typisk et signals tittel + sammendrag).
 *
 * `ukjenteOrd` er ofte det mest nyttige i svaret: søkeord som ikke finnes i NOEN
 * av artiklene. Er de fleste av dem der, er temaet i praksis udekket med denne
 * ordbruken — og det er et svar, ikke en mangel ved matchingen.
 *
 * @param {object[]} articles
 * @param {string} text
 * @param {{ top?: number }} [opts]
 */
export function rankArticles(articles, text, { top = 5 } = {}) {
  const query = terms(text);
  const df = documentFrequency(articles);
  const corpus = { df, total: articles.length };

  const kandidater = [];
  let svake = 0;

  for (const article of articles) {
    const result = scoreArticle(article, query, corpus);
    if (!result.matched.length) continue;
    if (!isCandidate(result)) {
      svake++;
      continue;
    }
    kandidater.push({ article, ...result });
  }

  kandidater.sort((a, b) => b.styrke - a.styrke || sortDate(b.article) - sortDate(a.article));

  const ukjenteOrd = [...query].filter((term) => !df.has(term));

  return {
    query: [...query],
    ukjenteOrd,
    hits: kandidater.slice(0, top),
    flereTreff: Math.max(0, kandidater.length - top),
    vurdert: articles.length,
    svake,
  };
}

/** Nyeste først ved likt poeng. Upublisert sorteres sist, som i API-et. */
function sortDate(article) {
  const ms = Date.parse(article?.published ?? "");
  return Number.isNaN(ms) ? -Infinity : ms;
}
