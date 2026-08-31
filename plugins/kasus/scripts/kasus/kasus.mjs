#!/usr/bin/env node
/**
 * kasus — read-only CLI mot Kasus' offentlige API (`/api/v1`).
 *
 * Avhengighetsfri ESM, Node 18+ (bruker innebygd `fetch`). Pluginen kjører fra
 * en cache-mappe i konsumentens repo og kan ikke anta at noe er installert.
 *
 * Bruk:
 *   kasus.mjs signals [--status new] [--type market_signal] [--origin own_followup]
 *                     [--pattern «navn»] [--hours 24] [--limit 20] [--json]
 *   kasus.mjs signal <id> [--json]
 *   kasus.mjs briefs  [--status proposal] [--origin radar] [--pattern «navn»]
 *                     [--hours 24] [--limit 20] [--json]
 *   kasus.mjs brief <id> [--json]
 *   kasus.mjs profile [--json]
 *   kasus.mjs --list --json
 *
 * Alle modi tar `--env <navn>` for per-miljø-variabler.
 */

import { apiGet, apiList, ApiError } from "./api.mjs";
import { intFlag, parseArgs, requireKnownFlags, stringFlag } from "../lib/args.mjs";
import { renderBrief, renderProfile, renderSignal } from "./render.mjs";
import { ConfigError, headerLine, resolveTarget } from "./targets.mjs";

const VERSION = "0.1.0";
const DEFAULT_LIMIT = 20;

/** Tillatte serverside-verdier. Sjekkes lokalt for å gi et bedre svar enn 400. */
const SIGNAL_STATUSES = ["new", "seen", "promoted", "dismissed"];
const SIGNAL_TYPES = ["competitor_article", "market_signal"];
const BRIEF_STATUSES = ["candidate", "proposal", "draft", "final", "dismissed"];

const COMMON_FLAGS = ["env", "json"];

/**
 * Manifestet. `/kasus:test` validerer det, og kommandoene refererer til modi-navn
 * herfra — så en modus som fjernes eller får nytt navn blir en rød test framfor
 * en kommando som feiler hos brukeren.
 */
const MODES = {
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
  briefs: {
    summary: "Liste story-briefs, nyeste først (etter createdAt).",
    flags: [...COMMON_FLAGS, "status", "origin", "pattern", "hours", "limit"],
    run: runBriefs,
  },
  brief: {
    summary: "Én story-brief med hele plot, vinkling, aktører og kilder.",
    flags: [...COMMON_FLAGS],
    args: "<id>",
    run: runBrief,
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

async function runBriefs(target, flags) {
  const status = assertOneOf(stringFlag(flags, "status"), BRIEF_STATUSES, "status");
  const hours = intFlag(flags, "hours");
  const limit = intFlag(flags, "limit", DEFAULT_LIMIT);
  const origin = stringFlag(flags, "origin");
  const pattern = stringFlag(flags, "pattern");

  const { items, truncated, pages } = await apiList(
    target,
    "/api/v1/story-briefs",
    { status, hours },
    limit,
  );

  const filtered = items
    .filter((b) => (origin ? String(b.origin) === origin : true))
    .filter((b) => (pattern ? matchPattern(b.matchedPattern, pattern) : true));

  return {
    kind: "briefs",
    items: filtered,
    meta: {
      hentet: items.length,
      etterFilter: filtered.length,
      sider: pages,
      taketNådd: truncated,
      filter: { status, hours, origin, pattern },
    },
    render: () =>
      listOutput(filtered, items.length, truncated, "story-briefs", (b) => renderBrief(b)),
  };
}

async function runBrief(target, flags, positional) {
  const id = requireId(positional, "brief");
  const body = await apiGet(target, `/api/v1/story-briefs/${encodeURIComponent(id)}`);
  return {
    kind: "brief",
    items: [body.data],
    render: () => renderBrief(body.data, { full: true }),
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
          data: result.items,
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
  if (err instanceof ConfigError || err instanceof ApiError) {
    process.stderr.write(`${err.message}\n`);
    process.exit(2);
  }
  if (err instanceof Error && /Ukjent flagg|krever en verdi|må være et positivt tall/.test(err.message)) {
    process.stderr.write(`${err.message}\n`);
    process.exit(2);
  }
  process.stderr.write(`Uventet feil: ${err?.stack ?? err}\n`);
  process.exit(1);
});
