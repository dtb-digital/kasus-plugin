#!/usr/bin/env node
/**
 * kasus — read-only CLI mot Kasus' offentlige API (`/api/v1`).
 *
 * Avhengighetsfri ESM, Node 18+ (bruker innebygd `fetch`). Pluginen kjører fra
 * en cache-mappe i konsumentens repo og kan ikke anta at noe er installert.
 *
 * Verktøyet betjener ÉN arbeidsflyt: vaktrunden i `/kasus:start`. Modiene er
 * stegene i den — radarsignaler inn, egne artikler til sammenligning, profilen
 * som premiss, og en kvittering til slutt.
 *
 * Bruk:
 *   kasus.mjs nytt     [--hours 24] [--limit 40] [--all] [--json]
 *   kasus.mjs kvitter  [--at <ISO>] [--ids id1,id2] [--ids-only] [--reset] [--json]
 *   kasus.mjs signals  [--status new] [--type market_signal] [--origin own_followup]
 *                      [--pattern «navn»] [--hours 24] [--limit 20] [--json]
 *   kasus.mjs signal <id> [--json]
 *   kasus.mjs articles [--match «tekst»] [--status P] [--cms labrador]
 *                      [--hours N] [--limit 200] [--top 5] [--json]
 *   kasus.mjs article <id> [--json]
 *   kasus.mjs profile  [--json]
 *   kasus.mjs --list --json
 *
 * Alle modi tar `--env <navn>` for per-miljø-variabler.
 *
 * `nytt` og `kvitter` er de journalistvendte modiene, og de heter noe på norsk
 * fordi de er noe redaksjonen GJØR. De andre speiler et endepunkt i API-et 1:1 og
 * beholder API-ets navn, slik at det er synlig hvilke modi som er en uthenting og
 * hvilke som er en arbeidsflyt.
 */

import { apiGet, apiList, ApiError } from "./api.mjs";
import {
  boolFlag,
  intFlag,
  parseArgs,
  requireKnownFlags,
  stringFlag,
  UsageError,
} from "../lib/args.mjs";
import {
  bucketOf,
  bucketTitle,
  publishedNote,
  renderAck,
  renderArticle,
  renderArticleMatches,
  renderArticles,
  renderDigest,
  renderProfile,
  renderReset,
  renderSignal,
  SIGNAL_BUCKETS,
  STALE_AFTER_DAYS,
} from "./render.mjs";
import { rankArticles, HEAVY_FIELD_WEIGHT } from "./match.mjs";
import { ConfigError, headerLine, hostOf, resolveTarget } from "./targets.mjs";
import {
  ack,
  classify,
  clearTarget,
  entryFor,
  FIRST_RUN_HOURS,
  LAG_HOURS,
  MAX_SEEN_IDS,
  normalizeAt,
  readState,
  resolveStatePath,
  targetKey,
  windowFor,
  writeState,
} from "./state.mjs";

const VERSION = "0.4.0";
const DEFAULT_LIMIT = 20;

/**
 * Vaktrunden henter mer enn en vanlig liste, fordi den skal være HELE bildet
 * siden sist — ikke de 20 nyeste. Taket sies når det nås.
 */
const DIGEST_LIMIT = 40;

/** Tillatte serverside-verdier. Sjekkes lokalt for å gi et bedre svar enn 400. */
const SIGNAL_STATUSES = ["new", "seen", "promoted", "dismissed"];
const SIGNAL_TYPES = ["competitor_article", "market_signal"];

/**
 * Vinduet «har vi dekket dette før?» sjekkes mot.
 *
 * Artikkel-API-et har ingen tekstsøk, så spørsmålet besvares ved å hente de N
 * nyeste artiklene og matche lokalt. 200 er to sider paginering — nok til å
 * dekke flere måneders produksjon for en normal redaksjon, og lite nok til at
 * kallet går fort nok for en interaktiv runde. Tallet SIES i svaret, fordi en
 * tom treffliste ellers leses som «ikke dekket».
 */
const ARTICLE_WINDOW = 200;

/** Hvor mange treff som vises. Flere enn dette leses ikke på en runde. */
const ARTICLE_TOP = 5;

const COMMON_FLAGS = ["env", "json"];

/**
 * Manifestet. `/kasus:test` validerer det, og kommandoene refererer til modi-navn
 * herfra — så en modus som fjernes eller får nytt navn blir en rød test framfor
 * en kommando som feiler hos brukeren.
 */
const MODES = {
  nytt: {
    summary:
      "Vaktrunden: radarsignaler som har kommet inn siden forrige kvittering, gruppert på opphav. Skriver ingenting.",
    flags: [...COMMON_FLAGS, "hours", "limit", "all"],
    run: runNytt,
  },
  kvitter: {
    summary:
      "Kvitterer for runden: alt eldre enn tidspunktet regnes som sett. Det ENESTE som skriver kvitteringen.",
    flags: [...COMMON_FLAGS, "at", "ids", "ids-only", "reset"],
    run: runKvitter,
  },
  signals: {
    summary: "Liste radarsignaler, nyeste først (etter detectedAt).",
    flags: [...COMMON_FLAGS, "status", "type", "origin", "pattern", "hours", "limit"],
    run: runSignals,
  },
  signal: {
    summary: "Ett radarsignal med alle kilder og hele konteksten.",
    flags: [...COMMON_FLAGS],
    args: "<id>",
    run: runSignal,
  },
  articles: {
    summary:
      "Redaksjonens EGNE artikler. Med --match: har vi dekket dette før? (lokal ordmatch — API-et har ingen tekstsøk.)",
    flags: [...COMMON_FLAGS, "match", "status", "cms", "hours", "limit", "top"],
    run: runArticles,
  },
  article: {
    summary: "Én egen artikkel med hele teksten — grunnlaget for tone og for å bygge videre.",
    flags: [...COMMON_FLAGS],
    args: "<id>",
    run: runArticle,
  },
  profile: {
    summary:
      "Redaksjonell profil: redaksjonsprofilen, de utledede mønstrene/innsiktene og radarens mandat.",
    flags: [...COMMON_FLAGS],
    run: runProfile,
  },
};

// ---------------------------------------------------------------------------
// Modi
// ---------------------------------------------------------------------------

/**
 * Vaktrunden. Henter begge strømmene for hvert sitt vindu, og deler i «nytt»,
 * «alt kvittert for» og «utenfor vinduet».
 *
 * Modusen er LESENDE. Den flytter ikke kvitteringen, og det er ikke en
 * bekvemmelighet: en oversikt som kvitterte seg selv ville betydd at et avbrutt
 * kall — eller en runde som ble avbrutt av noe viktigere — mistet signalene sine
 * uten at noe sa fra. `kvitter` er et eget, eksplisitt steg.
 */
async function runNytt(target, flags) {
  const hoursOverride = intFlag(flags, "hours");
  const limit = intFlag(flags, "limit", DIGEST_LIMIT);
  const includeAll = boolFlag(flags, "all");
  const now = Date.now();

  const { path: statePath, source: stateSource } = resolveStatePath({ env: target.env });
  const { state } = readState(statePath);
  const key = targetKey(target);
  const entry = entryFor(state, key);
  const seenIds = new Set(entry.seenIds);

  const window = windowFor({
    checkpoint: entry.checkpoints.signals,
    now,
    override: hoursOverride,
  });

  const page = await apiList(target, "/api/v1/signals", { hours: window.hours }, limit);

  const skipped = { seen: 0, window: 0, dismissed: 0 };
  const fresh = [];
  for (const signal of page.items) {
    // Forkastet er ikke «nytt å vurdere» — noen har alt vurdert det. Antallet
    // sies likevel, så en tom runde ikke forveksles med en stille utelatelse.
    if (!includeAll && signal.status === "dismissed") {
      skipped.dismissed++;
      continue;
    }
    const verdict = classify(signal, signal.detectedAt, { from: window.from, seenIds });
    if (verdict === "alt sett") skipped.seen++;
    else if (verdict === "utenfor vinduet") skipped.window++;
    else fresh.push(signal);
  }

  const digest = {
    statePath,
    stateSource,
    lagHours: LAG_HOURS,
    checkpoint: entry.checkpoints.signals,
    window,
    skipped,
    signals: fresh,
    fetched: page.items.length,
    truncated: page.truncated,
    fordeling: fordelingPåMønster(fresh),
    gamleSaker: gamleSaker(fresh),
    // Kvitteringen som SKAL brukes hvis runden fullføres: tidspunktet
    // uthentingen ble gjort, og id-ene som faktisk ble vist. Tidspunktet alene
    // ville vært nok for tiden, men id-ene gjør at etterslep-vinduet kan
    // overlappe uten å vise det samme to ganger.
    ack: {
      at: new Date(now).toISOString(),
      ids: fresh.map((s) => s.id).filter(Boolean),
    },
  };

  return {
    kind: "nytt",
    items: fresh,
    meta: {
      kvitteringsfil: statePath,
      kvitteringskilde: stateSource,
      kvittering: entry.checkpoints.signals,
      vindu: window,
      hentet: page.items.length,
      nye: fresh.length,
      holdtUtenfor: skipped,
      taketNådd: page.truncated,
      inkludererForkastede: includeAll,
      // Grupperingen og ferskhets-flaggene ligger i META, ikke i `data`: de er
      // utledet av oss, og et felt vi har funnet på skal ikke ligge side om side
      // med API-ets egne felt som om det kom derfra. Konsumenten slipper likevel
      // å utlede kategoriene selv — og kan dermed ikke utlede dem ANNERLEDES enn
      // det den lesbare outputen viser.
      grupper: grupperSignaler(fresh),
      fordeling: fordelingPåMønster(fresh),
      gamleSaker: gamleSaker(fresh),
      kvitter: digest.ack,
    },
    render: () => renderDigest(digest),
  };
}

/**
 * Kvitterer for runden. Det ENESTE stedet kvitteringen skrives.
 *
 * Uten `--at` er tidspunktet NÅ, og det betyr at alt eldre regnes som sett —
 * også det brukeren ikke fikk se. Det sies i outputen framfor å være en
 * antagelse, fordi det er den ene måten en kvittering kan skjule noe.
 */
async function runKvitter(target, flags) {
  const reset = boolFlag(flags, "reset");
  const atFlag = stringFlag(flags, "at");
  const idsFlag = stringFlag(flags, "ids");
  const idsOnly = boolFlag(flags, "ids-only");

  if (reset && (atFlag || idsFlag || idsOnly)) {
    throw new ApiError(
      "--reset nullstiller kvitteringen og kan ikke kombineres med --at, --ids eller --ids-only. Velg én.",
    );
  }
  if (idsOnly && atFlag) {
    throw new ApiError(
      "--ids-only beholder kvitteringstidspunktet, så --at ville motsagt det. Velg én.",
    );
  }
  if (idsOnly && !idsFlag) {
    throw new ApiError(
      "--ids-only uten --ids gjør ingenting: den kvitterer for id-ene du oppgir, og bare dem.",
    );
  }

  const { path: statePath, source: stateSource } = resolveStatePath({ env: target.env });
  const key = targetKey(target);

  if (reset) {
    // Toleranse for en ødelagt fil er hele poenget med --reset: den skal være
    // veien UT av en fil ingen kan lese, ikke et kall som stopper på den.
    const { state, corrupt } = readState(statePath, { onCorrupt: "empty" });
    const { state: next, removed } = clearTarget(state, key);
    writeState(statePath, next);
    const payload = { path: statePath, source: stateSource, removed, corrupt, firstRunHours: FIRST_RUN_HOURS };
    return { kind: "kvitter-reset", items: [payload], meta: payload, render: () => renderReset(payload) };
  }

  const { state } = readState(statePath);
  const before = entryFor(state, key);
  // `null` = behold tidspunktet. Bare de oppgitte id-ene regnes som sett, så en
  // halvferdig runde ikke svelger det den ikke rakk å se på.
  const at = idsOnly ? null : atFlag ? normalizeAt(atFlag) : new Date().toISOString();
  const ids = idsFlag ? idsFlag.split(",").map((id) => id.trim()).filter(Boolean) : [];

  const next = ack(state, { key, host: hostOf(target.baseUrl), env: target.env, at, ids });
  writeState(statePath, next);

  const after = entryFor(next, key);
  const payload = {
    path: statePath,
    source: stateSource,
    before: before.checkpoints,
    after: after.checkpoints,
    seenIds: after.seenIds.length,
    addedIds: ids.length,
    keptTime: idsOnly,
    maxSeenIds: MAX_SEEN_IDS,
    lagHours: LAG_HOURS,
  };

  return {
    kind: "kvitter",
    items: [payload],
    meta: payload,
    render: () => renderAck(payload),
  };
}

async function runSignals(target, flags) {
  const status = assertOneOf(stringFlag(flags, "status"), SIGNAL_STATUSES, "status");
  const type = assertOneOf(stringFlag(flags, "type"), SIGNAL_TYPES, "type");
  const hours = intFlag(flags, "hours");
  const limit = intFlag(flags, "limit", DEFAULT_LIMIT);
  const origin = stringFlag(flags, "origin");
  const pattern = stringFlag(flags, "pattern");

  const { items, truncated, pages } = await apiList(
    target,
    "/api/v1/signals",
    { status, type, hours },
    limit,
  );

  // `origin` og `matchedPattern` kan ikke filtreres serverside i denne
  // API-versjonen (dokumentert i docs/signals-api-README.md). Filteret gjøres
  // derfor lokalt — og hva som ble filtrert bort SIES, ellers ser et lokalt
  // filter ut som et tomt datasett.
  const filtered = items
    .filter((s) => (origin ? matchOrigin(s, origin) : true))
    .filter((s) => (pattern ? matchPattern(s.details?.matchedPattern, pattern) : true));

  return {
    kind: "signals",
    items: filtered,
    meta: {
      hentet: items.length,
      etterFilter: filtered.length,
      sider: pages,
      taketNådd: truncated,
      filter: { status, type, hours, origin, pattern },
    },
    render: () =>
      listOutput(filtered, items.length, truncated, "signaler", (s) => renderSignal(s)),
  };
}

async function runSignal(target, flags, positional) {
  const id = requireId(positional, "signal");
  const body = await apiGet(target, `/api/v1/signals/${encodeURIComponent(id)}`);
  return {
    kind: "signal",
    items: [body.data],
    render: () => renderSignal(body.data, { full: true }),
  };
}

/**
 * Redaksjonens egne artikler — og med `--match`: har vi dekket dette før?
 *
 * Spørsmålet er steg to i runden, rett etter at journalisten har valgt et signal.
 * Det avgjør tre ting på én gang: om saken er skrevet før (ikke gjenta),
 * om det finnes en egen sak å bygge videre på (billigere og bedre), og hvilken
 * tone redaksjonen faktisk har på temaet.
 *
 * **API-et har ingen tekstsøk.** Verktøyet henter derfor et VINDU av de nyeste
 * artiklene og matcher lokalt. Både vindusstørrelsen og at matchingen er
 * ordoverlapp SIES i svaret — en tom treffliste her betyr «ikke blant disse
 * artiklene», aldri «ikke dekket».
 */
async function runArticles(target, flags) {
  const match = stringFlag(flags, "match");
  const status = stringFlag(flags, "status");
  const cms = stringFlag(flags, "cms");
  const hours = intFlag(flags, "hours");
  const top = intFlag(flags, "top", ARTICLE_TOP);
  const limit = intFlag(flags, "limit", match ? ARTICLE_WINDOW : DEFAULT_LIMIT);

  const { items, truncated, pages } = await apiList(
    target,
    "/api/v1/articles",
    { status, cms, hours },
    limit,
  );

  if (!match) {
    return {
      kind: "articles",
      items,
      meta: { hentet: items.length, sider: pages, taketNådd: truncated, filter: { status, cms, hours } },
      render: () => renderArticles(items, { truncated }),
    };
  }

  const ranked = rankArticles(items, match, { top });
  const meta = {
    match,
    søkeord: ranked.query,
    vindu: items.length,
    sider: pages,
    taketNådd: truncated,
    kandidater: ranked.hits.length,
    flereTreff: ranked.flereTreff,
    svake: ranked.svake,
    ukjenteOrd: ranked.ukjenteOrd,
    regel: `to fellesord, eller ett i et tungt felt (vekt ≥ ${HEAVY_FIELD_WEIGHT})`,
    // Forbeholdet er en del av SVARET, ikke en fotnote i dokumentasjonen: uten
    // det leses «0 treff» som «ikke dekket», og det er feilslutningen som får
    // noen til å skrive en sak redaksjonen publiserte i fjor.
    forbehold:
      `Lokal ordmatch mot de ${items.length} nyeste artiklene — API-et har ingen tekstsøk. ` +
      `Ingen treff betyr «ikke blant disse», ikke «ikke dekket». Ordoverlapp fanger ikke ` +
      `omskrivinger: «prisfall i Bodø» og «nedgang i Nordland» er samme sak for en leser ` +
      `og null treff her.`,
  };

  return {
    kind: "articles-match",
    items: ranked.hits.map((h) => h.article),
    data: ranked.hits,
    meta,
    render: () => renderArticleMatches(ranked, meta),
  };
}

async function runArticle(target, flags, positional) {
  const id = requireId(positional, "article");
  const body = await apiGet(target, `/api/v1/articles/${encodeURIComponent(id)}`);
  return {
    kind: "article",
    items: [body.data],
    render: () => renderArticle(body.data, { full: true }),
  };
}

async function runProfile(target) {
  const body = await apiGet(target, "/api/v1/profile");
  return {
    kind: "profile",
    items: [body.data],
    render: () => renderProfile(body.data),
  };
}

// ---------------------------------------------------------------------------
// Hjelpere
// ---------------------------------------------------------------------------

/**
 * Signalene gruppert på de fire kategoriene, med forklaringen som følger dem.
 *
 * Tomme kategorier utelates — en runde skal ikke fylles med nuller.
 */
function grupperSignaler(signals) {
  return SIGNAL_BUCKETS.map(({ key, explain }) => {
    const items = signals.filter((s) => bucketOf(s) === key);
    return items.length
      ? { kategori: key, tittel: bucketTitle(key, items), betyr: explain, antall: items.length, ids: items.map((s) => s.id) }
      : null;
  }).filter(Boolean);
}

/**
 * Hvor mange signaler per redaksjonelt mønster, flest først.
 *
 * `matchedPattern` er den samme strengen som `criteria.patterns[].name` i
 * profilen, så fordelingen sier hvilke av redaksjonens egne mønstre som er i
 * bevegelse. Signaler uten mønstertreff samles for seg — en topp der er ikke en
 * feil, men en opplysning: radaren finner noe profilen ikke forklarer.
 */
function fordelingPåMønster(signals) {
  const teller = new Map();
  for (const signal of signals) {
    const monster = signal.details?.matchedPattern ?? "uten mønstertreff";
    if (!teller.has(monster)) teller.set(monster, []);
    teller.get(monster).push(signal.id);
  }
  return [...teller.entries()]
    .map(([monster, ids]) => ({ monster, antall: ids.length, ids }))
    .sort((a, b) => b.antall - a.antall || a.monster.localeCompare(b.monster, "nb"));
}

/**
 * Signalene der SAKEN er gammel selv om signalet er ferskt.
 *
 * Typisk et fritt temasøk: det hentes uavhengig av publiseringstidspunkt, så et
 * treff fra 2023 kommer inn som «oppdaget for 45 min siden». Uten dette flagget
 * prioriteres en ferdig behandlet sak som en fersk hendelse.
 */
function gamleSaker(signals) {
  return signals
    .filter((s) => publishedNote(s).startsWith("GAMMEL SAK"))
    .map((s) => ({
      id: s.id,
      tittel: s.title,
      url: s.url ?? null,
      kategori: bucketOf(s),
      publisert: s.details?.publishedDate ?? null,
      oppdaget: s.detectedAt ?? null,
      merk: `publisert mer enn ${STALE_AFTER_DAYS} dager før den ble oppdaget`,
    }));
}

function matchOrigin(signal, wanted) {
  if (wanted === "null" || wanted === "topic_search") return signal.origin === null;
  return signal.origin === wanted;
}

function matchPattern(value, wanted) {
  return typeof value === "string" && value.toLowerCase().includes(wanted.toLowerCase());
}

function assertOneOf(value, allowed, name) {
  if (value === null) return null;
  if (!allowed.includes(value)) {
    throw new ApiError(
      `Ugyldig --${name}: «${value}». Tillatt: ${allowed.join(", ")}.`,
    );
  }
  return value;
}

function requireId(positional, mode) {
  const id = positional[0];
  if (!id) throw new ApiError(`Modusen «${mode}» krever en id: kasus.mjs ${mode} <id>`);
  return id;
}

function listOutput(filtered, fetched, truncated, noun, renderOne) {
  const parts = [];

  if (!filtered.length) {
    // «Tomt» og «filtrert bort» er ikke samme svar, og forveksles lett.
    parts.push(
      fetched === 0
        ? `Ingen ${noun} for denne organisasjonen med dette filteret.`
        : `${fetched} ${noun} ble hentet, men ingen passerte det lokale filteret (--origin/--pattern).`,
    );
    return parts.join("\n");
  }

  parts.push(`${filtered.length} ${noun}${fetched !== filtered.length ? ` (av ${fetched} hentet)` : ""}:`);
  for (const item of filtered) parts.push("", renderOne(item));

  if (truncated) {
    parts.push(
      "",
      "Taket er nådd — det finnes MER enn dette. Øk --limit for å hente flere.",
    );
  }
  return parts.join("\n");
}

function helpText() {
  const lines = ["kasus — read-only CLI mot Kasus' offentlige API", "", "Modi:"];
  for (const [name, mode] of Object.entries(MODES)) {
    lines.push(`  ${name}${mode.args ? ` ${mode.args}` : ""}`);
    lines.push(`      ${mode.summary}`);
    lines.push(`      flagg: ${mode.flags.map((f) => `--${f}`).join(" ")}`);
  }
  lines.push(
    "",
    "Variabler:",
    "  KASUS_API_KEY[_<ENV>]     PÅKREVD. Nøkkel fra Innstillinger → API-nøkler.",
    "  KASUS_BASE_URL[_<ENV>]    Valgfri. Default https://app.kasus.io.",
    "  KASUS_TIMEOUT_MS[_<ENV>]  Valgfri. Default 30000.",
    "  KASUS_STATE_FILE[_<ENV>]  Valgfri. Default .claude/kasus-state.json (fra cwd).",
    "                            Her ligger kvitteringen «nytt» måler siden-sist mot.",
    "",
    "Per-miljø-variabel vinner over den delte. Suffikset er miljønavnet i",
    "VERSALER med bindestrek → understrek (pre-prod → PRE_PROD).",
  );
  return lines.join("\n");
}

function manifest() {
  return {
    tool: "kasus",
    version: VERSION,
    readOnly: true,
    modes: Object.entries(MODES).map(([name, mode]) => ({
      name,
      summary: mode.summary,
      flags: mode.flags,
      args: mode.args ?? null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Inngang
// ---------------------------------------------------------------------------

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));

  if (flags.list) {
    process.stdout.write(`${JSON.stringify(manifest(), null, 2)}\n`);
    return;
  }
  if (flags.help || !positional.length) {
    process.stdout.write(`${helpText()}\n`);
    return;
  }

  const modeName = positional[0];
  const mode = MODES[modeName];
  if (!mode) {
    throw new ApiError(
      `Ukjent modus «${modeName}». Kjente modi: ${Object.keys(MODES).join(", ")}. ` +
        `Kjør uten argumenter for hjelp.`,
    );
  }

  requireKnownFlags(flags, [...mode.flags, "help", "list"]);

  const target = resolveTarget({ env: stringFlag(flags, "env") });
  const result = await mode.run(target, flags, positional.slice(1));

  if (flags.json) {
    // JSON klipper ikke tekst — et artikkelutkast trenger hele `plot`/`angle`.
    process.stdout.write(
      `${JSON.stringify(
        {
          target: {
            baseUrl: target.baseUrl,
            baseUrlSource: target.baseUrlSource,
            apiKeySource: target.apiKeySource,
            env: target.env,
            readOnly: true,
          },
          kind: result.kind,
          meta: result.meta ?? null,
          // `nytt` har to strømmer og kan ikke være én flat liste uten å miste
          // hvilken av dem et element hørte til. `data` overstyrer derfor `items`
          // der modusen har en egen form.
          data: result.data ?? result.items,
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  process.stdout.write(`${headerLine(target)}\n\n${result.render()}\n`);
}

main().catch((err) => {
  // De tre klassene er «feil brukeren kan rette»: manglende konfigurasjon, et
  // svar fra API-et, eller et flagg som ikke stemmer. De skrives som én linje
  // uten stack trace — en stack trace begraver beskjeden om hva som må rettes.
  if (err instanceof ConfigError || err instanceof ApiError || err instanceof UsageError) {
    process.stderr.write(`${err.message}\n`);
    process.exit(2);
  }
  process.stderr.write(`Uventet feil: ${err?.stack ?? err}\n`);
  process.exit(1);
});
