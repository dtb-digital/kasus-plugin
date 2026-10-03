#!/usr/bin/env node
/**
 * kasus — kvitteringen for saksløpet. Ingen nettverk.
 *
 * All data kommer fra Kasus' MCP-server (`.mcp.json` i pluginroten), som Claude
 * kaller direkte: radarsignaler, story-briefs, egne artikler og profilen. Det
 * ENESTE MCP-serveren ikke kan svare på er hva DENNE journalisten har sett — det
 * ligger på disk i redaksjonens repo, og det er hele jobben til dette verktøyet.
 *
 * Avhengighetsfri ESM, Node 18+. Pluginen kjører fra en cache-mappe i
 * konsumentens repo og kan ikke anta at noe er installert.
 *
 * Bruk:
 *   kasus.mjs vindu   --org <slug> [--hours N] [--json]
 *   kasus.mjs kvitter --org <slug> [--at <ISO>] [--ids id1,id2] [--ids-only] [--reset] [--json]
 *   kasus.mjs --list --json
 *
 * `--org` er organisasjonens slug fra MCP-verktøyet `get_organization`.
 */

import {
  boolFlag,
  intFlag,
  parseArgs,
  requireKnownFlags,
  stringFlag,
  UsageError,
} from "../lib/args.mjs";
import { ConfigError, hostOf, requireOrg, resolveMcpUrl } from "./target.mjs";
import {
  ack,
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

const VERSION = "0.22.0";

/**
 * Gulvet i vindusregelen (`references/vindu.md`): listene ser aldri kortere
 * tilbake enn et døgn, men alltid minst så langt som «siden sist».
 */
const LIST_FLOOR_HOURS = 24;

const COMMON_FLAGS = ["org", "json"];

/**
 * Manifestet. `/kasus:test` validerer det, og kommandoene refererer til
 * modusnavn herfra — så en modus som fjernes eller får nytt navn blir en rød
 * test framfor en kommando som feiler hos brukeren.
 */
const MODES = {
  vindu: {
    summary:
      "Hvor langt tilbake saksløpet skal se: kvitteringen, vinduet «siden sist», listevinduet etter vindusregelen og id-ene som alt er sett. Leser bare — skriver ingenting.",
    flags: [...COMMON_FLAGS, "hours"],
    run: runVindu,
  },
  kvitter: {
    summary:
      "Kvitterer for saksløpet: alt eldre enn tidspunktet regnes som sett. Det ENESTE som skriver kvitteringen.",
    flags: [...COMMON_FLAGS, "at", "ids", "ids-only", "reset"],
    run: runKvitter,
  },
};

// ---------------------------------------------------------------------------
// Modi
// ---------------------------------------------------------------------------

/**
 * Vinduet saksløpet hentes for. Henter ingen signaler — det gjør Claude med
 * `list_radar_signals` — men gir alt som trengs for å si hvilke av dem som er
 * NYE: starten på vinduet og id-ene som alt er kvittert for.
 *
 * Modusen er LESENDE, og det er ikke en bekvemmelighet: en oversikt som
 * kvitterte seg selv ville betydd at et avbrutt saksløp mistet signalene sine
 * uten at noe sa fra. `kvitter` er et eget, eksplisitt steg.
 */
async function runVindu(ctx, flags) {
  const override = intFlag(flags, "hours");
  const now = Date.now();

  const { state } = readState(ctx.statePath);
  const entry = entryFor(state, ctx.key);
  const window = windowFor({ checkpoint: entry.checkpoints.signals, now, override });

  const meta = {
    org: ctx.org,
    mcp: { host: ctx.host, kilde: ctx.mcpSource },
    kvitteringsfil: ctx.statePath,
    kvitteringskilde: ctx.stateSource,
    kvittering: entry.checkpoints.signals,
    vindu: { ...window, fra: new Date(window.from).toISOString() },
    // Vindusregelen, regnet ut ÉN gang her framfor i hver prompt:
    // brukerens --hours, ellers max(24, vinduet siden sist).
    listevindu: override ?? Math.max(LIST_FLOOR_HOURS, window.hours),
    etterslepTimer: LAG_HOURS,
    altSett: entry.seenIds,
    // Tidspunktet som SKAL brukes hvis saksløpet fullføres: da uthentingen ble
    // gjort, ikke da kvitteringen skrives. Det som kom inn mens dere jobbet er
    // fortsatt nytt neste gang.
    kvitterAt: new Date(now).toISOString(),
  };

  return { kind: "vindu", meta, render: () => renderVindu(meta) };
}

/**
 * Kvitterer for saksløpet. Det ENESTE stedet kvitteringen skrives.
 *
 * Uten `--at` er tidspunktet NÅ, og det betyr at alt eldre regnes som sett —
 * også det brukeren ikke fikk se. Det sies i outputen framfor å være en
 * antagelse, fordi det er den ene måten en kvittering kan skjule noe.
 */
async function runKvitter(ctx, flags) {
  const reset = boolFlag(flags, "reset");
  const atFlag = stringFlag(flags, "at");
  const idsFlag = stringFlag(flags, "ids");
  const idsOnly = boolFlag(flags, "ids-only");

  if (reset && (atFlag || idsFlag || idsOnly)) {
    throw new UsageError(
      "--reset nullstiller kvitteringen og kan ikke kombineres med --at, --ids eller --ids-only. Velg én.",
    );
  }
  if (idsOnly && atFlag) {
    throw new UsageError("--ids-only beholder kvitteringstidspunktet, så --at ville motsagt det. Velg én.");
  }
  if (idsOnly && !idsFlag) {
    throw new UsageError("--ids-only uten --ids gjør ingenting: den kvitterer for id-ene du oppgir, og bare dem.");
  }

  if (reset) {
    // Toleranse for en ødelagt fil er hele poenget med --reset: den skal være
    // veien UT av en fil ingen kan lese, ikke et kall som stopper på den.
    const { state, corrupt } = readState(ctx.statePath, { onCorrupt: "empty" });
    const { state: next, removed } = clearTarget(state, ctx.key);
    writeState(ctx.statePath, next);
    const meta = { path: ctx.statePath, source: ctx.stateSource, removed, corrupt, firstRunHours: FIRST_RUN_HOURS };
    return { kind: "kvitter-reset", meta, render: () => renderReset(meta) };
  }

  const { state } = readState(ctx.statePath);
  const before = entryFor(state, ctx.key);
  // `null` = behold tidspunktet. Bare de oppgitte id-ene regnes som sett, så et
  // halvferdig saksløp ikke svelger det den ikke rakk å se på.
  const at = idsOnly ? null : atFlag ? normalizeAt(atFlag) : new Date().toISOString();
  const ids = idsFlag ? idsFlag.split(",").map((id) => id.trim()).filter(Boolean) : [];

  const next = ack(state, { key: ctx.key, host: ctx.host, org: ctx.org, at, ids });
  writeState(ctx.statePath, next);

  const after = entryFor(next, ctx.key);
  const meta = {
    path: ctx.statePath,
    source: ctx.stateSource,
    before: before.checkpoints,
    after: after.checkpoints,
    seenIds: after.seenIds.length,
    addedIds: ids.length,
    keptTime: idsOnly,
    implicitNow: !idsOnly && !atFlag,
    maxSeenIds: MAX_SEEN_IDS,
  };
  return { kind: "kvitter", meta, render: () => renderAck(meta) };
}

// ---------------------------------------------------------------------------
// Tekst
// ---------------------------------------------------------------------------

function renderVindu(meta) {
  const basis = {
    kvittering: `siden kvitteringen ${meta.kvittering} (pluss ${meta.etterslepTimer} t etterslep)`,
    "første saksløp": `første saksløp — ingen kvittering ennå, så siste ${FIRST_RUN_HOURS} timer`,
    overstyrt: "overstyrt med --hours",
  }[meta.vindu.basis];
  return [
    `Organisasjon: ${meta.org} · Kasus: ${meta.mcp.host} (${meta.mcp.kilde})`,
    `Kvitteringsfil: ${meta.kvitteringsfil} (${meta.kvitteringskilde})`,
    "",
    `Nytt siden sist: fra ${meta.vindu.fra} — ${meta.vindu.hours} t, ${basis}.`,
    `Listevindu (vindusregelen): ${meta.listevindu} t.`,
    `Alt sett: ${meta.altSett.length} id-er.`,
    "",
    "Dette leser IKKE noe som sett — bare «kvitter» skriver. Når saksløpet er gjort:",
    `  kasus.mjs kvitter --org ${meta.org} --at ${meta.kvitterAt} --ids <de viste id-ene>`,
  ].join("\n");
}

function renderAck(meta) {
  const lines = [`Kvittert i ${meta.path}.`];
  if (meta.keptTime) {
    lines.push(`Tidspunktet står (${meta.after.signals ?? "ingen kvittering"}); ${meta.addedIds} id-er regnes nå som sett.`);
  } else {
    lines.push(`Kvitteringen er flyttet fra ${meta.before.signals ?? "ingen"} til ${meta.after.signals}.`);
    if (meta.implicitNow) {
      lines.push("MERK: uten --at er tidspunktet NÅ — alt eldre regnes som sett, også det som ikke ble vist.");
    }
    if (meta.addedIds) lines.push(`${meta.addedIds} id-er lagt til som sett.`);
  }
  lines.push(`Husker ${meta.seenIds} id-er (maks ${meta.maxSeenIds}).`);
  return lines.join("\n");
}

function renderReset(meta) {
  const lines = [
    meta.removed
      ? `Kvitteringen for denne organisasjonen er nullstilt i ${meta.path}.`
      : `Det fantes ingen kvittering for denne organisasjonen i ${meta.path}.`,
  ];
  if (meta.corrupt) lines.push("Fila var ødelagt eller fra en annen versjon, og er skrevet på nytt.");
  lines.push(`Neste saksløp ser ${meta.firstRunHours} timer tilbake.`);
  return lines.join("\n");
}

function helpText() {
  const lines = ["kasus — kvitteringen for saksløpet (ingen nettverk; data kommer fra MCP)", "", "Modi:"];
  for (const [name, mode] of Object.entries(MODES)) {
    lines.push(`  ${name}`, `      ${mode.summary}`, `      flagg: ${mode.flags.map((f) => `--${f}`).join(" ")}`);
  }
  lines.push(
    "",
    "Variabler:",
    "  KASUS_MCP_URL     Valgfri. Default https://app.kasus.io/api/mcp (samme som .mcp.json).",
    "  KASUS_STATE_FILE  Valgfri. Default .claude/kasus-state.json (fra cwd).",
  );
  return lines.join("\n");
}

function manifest() {
  return {
    tool: "kasus",
    version: VERSION,
    network: false,
    modes: Object.entries(MODES).map(([name, mode]) => ({ name, summary: mode.summary, flags: mode.flags })),
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
    throw new UsageError(
      `Ukjent modus «${modeName}». Kjente modi: ${Object.keys(MODES).join(", ")}. ` +
        `Data hentes med MCP-verktøyene (mcp__plugin_kasus_kasus__*), ikke her.`,
    );
  }
  requireKnownFlags(flags, [...mode.flags, "help", "list"]);

  const org = requireOrg(stringFlag(flags, "org"));
  const mcp = resolveMcpUrl();
  const host = hostOf(mcp.url);
  const { path: statePath, source: stateSource } = resolveStatePath();
  const ctx = { org, host, mcpSource: mcp.source, statePath, stateSource, key: targetKey({ host, org }) };

  const result = await mode.run(ctx, flags);

  if (flags.json) {
    process.stdout.write(`${JSON.stringify({ kind: result.kind, meta: result.meta }, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${result.render()}\n`);
}

main().catch((err) => {
  // «Feil brukeren kan rette» skrives som én linje uten stack trace — en stack
  // trace begraver beskjeden om hva som må rettes.
  if (err instanceof ConfigError || err instanceof UsageError) {
    process.stderr.write(`${err.message}\n`);
    process.exit(2);
  }
  process.stderr.write(`Uventet feil: ${err?.stack ?? err}\n`);
  process.exit(1);
});
