#!/usr/bin/env node
/**
 * Enhetstester for kasus-verktøyet. Kjøres av `/kasus:test` (self-test.sh) med
 * Node-innebygd `node:test` — ingen avhengigheter, ingen byggesteg.
 *
 * Verktøyet er bare kvitteringen: dataene kommer fra MCP. Testene er derfor
 * skrevet mot det som feiler STILLE hvis det knekker — at to organisasjoner ikke
 * deler «siden sist», at en ødelagt fil ikke nullstilles i stillhet, at bare
 * `kvitter` skriver, og at verktøyet ikke har noen nettverkskode igjen.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

import { boolFlag, intFlag, parseArgs, requireKnownFlags, UsageError } from "../lib/args.mjs";
import { ConfigError, DEFAULT_MCP_URL, hostOf, requireOrg, resolveMcpUrl } from "./target.mjs";
import {
  ack,
  clearTarget,
  DEFAULT_STATE_FILE,
  entryFor,
  FIRST_RUN_HOURS,
  MAX_SEEN_IDS,
  normalizeAt,
  readState,
  resolveStatePath,
  STATE_VERSION,
  targetKey,
  windowFor,
  writeState,
} from "./state.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(HERE, "..", "..");
const CLI = join(HERE, "kasus.mjs");

// ---------------------------------------------------------------------------
// Argumenter
// ---------------------------------------------------------------------------

test("parseArgs: --nøkkel verdi, --nøkkel=verdi, flagg og posisjonelle", () => {
  const { flags, positional } = parseArgs(["vindu", "--org", "avisa", "--hours=5", "--json"]);
  assert.deepEqual(positional, ["vindu"]);
  assert.deepEqual(flags, { org: "avisa", hours: "5", json: true });
});

test("requireKnownFlags: en skrivefeil avvises framfor å bli ignorert stille", () => {
  assert.throws(() => requireKnownFlags({ huors: "5" }, ["hours"]), /Ukjent flagg: --huors/);
});

test("intFlag: satt men ugyldig er en feil, ikke en grunn til å bruke defaulten", () => {
  assert.equal(intFlag({}, "hours", 20), 20);
  assert.equal(intFlag({ hours: "5" }, "hours", 20), 5);
  assert.throws(() => intFlag({ hours: "abc" }, "hours", 20), /positivt tall/);
  assert.throws(() => intFlag({ hours: "0" }, "hours", 20), /positivt tall/);
});

test("boolFlag: --flagg alene er på, en verdi må være entydig", () => {
  assert.equal(boolFlag({}, "reset"), false);
  assert.equal(boolFlag({ reset: true }, "reset"), true);
  assert.equal(boolFlag({ reset: "ja" }, "reset"), true);
  assert.equal(boolFlag({ reset: "false" }, "reset"), false);
  assert.throws(() => boolFlag({ reset: "proposal" }, "reset"), UsageError);
});

// ---------------------------------------------------------------------------
// Mål: MCP-adressen og organisasjonen
// ---------------------------------------------------------------------------

test("resolveMcpUrl: defaulten er den samme som i .mcp.json", () => {
  const mcp = JSON.parse(readFileSync(join(PLUGIN_ROOT, ".mcp.json"), "utf8"));
  const url = mcp.mcpServers?.kasus?.url;
  // To defaulter som driver fra hverandre gir en kvittering for en annen
  // installasjon enn den dataene kom fra.
  assert.equal(url, `\${KASUS_MCP_URL:-${DEFAULT_MCP_URL}}`);
  assert.deepEqual(resolveMcpUrl({}), { url: DEFAULT_MCP_URL, source: "default (app.kasus.io)" });
});

test("resolveMcpUrl: variabelen vinner, og en adresse uten protokoll er en feil", () => {
  assert.deepEqual(resolveMcpUrl({ KASUS_MCP_URL: "https://staging.kasus.io/api/mcp" }), {
    url: "https://staging.kasus.io/api/mcp",
    source: "KASUS_MCP_URL",
  });
  assert.throws(() => resolveMcpUrl({ KASUS_MCP_URL: "staging.kasus.io" }), ConfigError);
  assert.equal(hostOf("https://staging.kasus.io/api/mcp"), "staging.kasus.io");
});

test("requireOrg: påkrevd, og peker på get_organization", () => {
  assert.throws(() => requireOrg(null), /get_organization/);
  assert.throws(() => requireOrg("../../etc"), ConfigError);
  assert.equal(requireOrg("testavisa"), "testavisa");
});

test("targetKey: to organisasjoner, eller to installasjoner, deler IKKE kvittering", () => {
  const a = targetKey({ host: "app.kasus.io", org: "avisa" });
  assert.notEqual(a, targetKey({ host: "app.kasus.io", org: "annen" }));
  assert.notEqual(a, targetKey({ host: "staging.kasus.io", org: "avisa" }));
  assert.equal(a, "app.kasus.io|avisa");
});

// ---------------------------------------------------------------------------
// Kvitteringen — «siden sist»
// ---------------------------------------------------------------------------

/** Egen mappe per test, så en test ikke arver en annen tests kvittering. */
function tmpStatePath(navn) {
  const dir = mkdtempSync(join(tmpdir(), `kasus-state-${navn}-`));
  return join(dir, "under", "kasus-state.json");
}

const KEY = targetKey({ host: "app.kasus.io", org: "avisa" });
const ACK = { key: KEY, host: "app.kasus.io", org: "avisa" };

test("readState: fil som ikke finnes er første saksløp, ikke en feil", () => {
  const { state, existed } = readState(tmpStatePath("mangler"));
  assert.equal(existed, false);
  assert.deepEqual(state, { version: STATE_VERSION, targets: {} });
});

test("readState: ødelagt fil stopper framfor å nullstille i stillhet", () => {
  const path = tmpStatePath("odelagt");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "{ dette er ikke json");

  assert.throws(
    () => readState(path),
    (err) => {
      assert.ok(err instanceof ConfigError);
      assert.match(err.message, /ikke gyldig JSON/);
      assert.match(err.message, /kvitter --reset/);
      return true;
    },
  );

  // --reset må være veien UT av en ødelagt fil, ellers er den en blindvei.
  const tolerant = readState(path, { onCorrupt: "empty" });
  assert.equal(tolerant.corrupt, true);
  assert.deepEqual(tolerant.state.targets, {});
});

test("readState: ukjent formatversjon tolkes ikke på gjett", () => {
  const path = tmpStatePath("versjon");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ version: 99, targets: { a: {} } }));
  assert.throws(() => readState(path), /versjon «99»/);
});

test("windowFor: uten kvittering er vinduet 24 t og basisen SIES", () => {
  const now = Date.parse("2026-08-31T12:00:00Z");
  const w = windowFor({ checkpoint: null, now });
  assert.equal(w.hours, FIRST_RUN_HOURS);
  assert.equal(w.basis, "første saksløp");
  assert.equal(new Date(w.from).toISOString(), "2026-08-30T12:00:00.000Z");
});

test("windowFor: kvitteringen får etterslep bakover, og timer rundes OPP", () => {
  const now = Date.parse("2026-08-31T12:00:00Z");
  const w = windowFor({ checkpoint: "2026-08-31T09:30:00Z", now });
  // 09:30 minus 2 t etterslep = 07:30, altså 4,5 t tilbake → 5 hele timer.
  assert.equal(new Date(w.from).toISOString(), "2026-08-31T07:30:00.000Z");
  assert.equal(w.hours, 5);
  assert.equal(w.basis, "kvittering");
});

test("windowFor: --hours overstyrer kvitteringen, og sier at den er overstyrt", () => {
  const now = Date.parse("2026-08-31T12:00:00Z");
  const w = windowFor({ checkpoint: "2026-08-31T11:00:00Z", now, override: 72 });
  assert.equal(w.hours, 72);
  assert.equal(w.basis, "overstyrt");
});

test("ack: setter kvitteringen, slår sammen id-er og fjerner duplikater", () => {
  const at = "2026-08-31T12:00:00.000Z";
  const first = ack({ version: STATE_VERSION, targets: {} }, { ...ACK, at, ids: ["a", "b", "a"] });
  const entry = entryFor(first, KEY);
  assert.deepEqual(entry.checkpoints, { signals: at });
  assert.deepEqual(entry.seenIds, ["a", "b"]);
  assert.equal(first.targets[KEY].org, "avisa");

  const senere = "2026-08-31T13:00:00.000Z";
  const second = ack(first, { ...ACK, at: senere, ids: ["b", "c"] });
  assert.deepEqual(entryFor(second, KEY).seenIds, ["a", "b", "c"]);
  assert.equal(entryFor(second, KEY).checkpoints.signals, senere);
});

test("ack: at=null beholder tidspunktet — et halvferdig saksløp svelger ingenting", () => {
  const at = "2026-08-31T12:00:00.000Z";
  const first = ack({ version: STATE_VERSION, targets: {} }, { ...ACK, at, ids: ["a"] });
  const bareIder = ack(first, { ...ACK, at: null, ids: ["b"] });
  assert.deepEqual(entryFor(bareIder, KEY).checkpoints, { signals: at });
  assert.deepEqual(entryFor(bareIder, KEY).seenIds, ["a", "b"]);
});

test("ack: taket på huskede id-er kutter de ELDSTE", () => {
  const mange = Array.from({ length: MAX_SEEN_IDS + 50 }, (_, i) => `id-${i}`);
  const state = ack({ version: STATE_VERSION, targets: {} }, { ...ACK, at: "2026-08-31T12:00:00.000Z", ids: mange });
  const seen = entryFor(state, KEY).seenIds;
  assert.equal(seen.length, MAX_SEEN_IDS);
  assert.equal(seen.at(-1), `id-${MAX_SEEN_IDS + 49}`);
  assert.equal(seen.includes("id-0"), false);
});

test("clearTarget: rører bare én organisasjon, og sier om det fantes noe", () => {
  const state = { version: STATE_VERSION, targets: { a: { host: "a" }, b: { host: "b" } } };
  const { state: next, removed } = clearTarget(state, "a");
  assert.equal(removed, true);
  assert.deepEqual(Object.keys(next.targets), ["b"]);
  assert.equal(clearTarget(next, "finnes-ikke").removed, false);
});

test("writeState: atomisk, oppretter mappa, og etterlater ingen temp-fil", () => {
  const path = tmpStatePath("skriv");
  const state = ack({ version: STATE_VERSION, targets: {} }, { ...ACK, at: "2026-08-31T12:00:00.000Z", ids: ["a"] });
  writeState(path, state);
  assert.deepEqual(readState(path).state, state);
  assert.deepEqual(readdirSync(dirname(path)).filter((f) => f.includes(".tmp")), []);
});

test("normalizeAt: ulesbart og framtidig tidspunkt avvises", () => {
  const now = Date.parse("2026-08-31T12:00:00Z");
  assert.equal(normalizeAt("2026-08-31T09:00:00Z", now), "2026-08-31T09:00:00.000Z");
  assert.throws(() => normalizeAt("i går", now), /ikke et tidspunkt jeg kan lese/);
  assert.throws(() => normalizeAt("2099-01-01T00:00:00Z", now), /fram i tid/);
});

test("resolveStatePath: relativ sti tolkes fra cwd, og kilden sies", () => {
  const fraDefault = resolveStatePath({ source: {}, cwd: "/repo" });
  assert.equal(fraDefault.path, join("/repo", DEFAULT_STATE_FILE));
  assert.match(fraDefault.source, /^default \(/);

  const satt = resolveStatePath({ source: { KASUS_STATE_FILE: "delt/state.json" }, cwd: "/repo" });
  assert.equal(satt.path, "/repo/delt/state.json");
  assert.equal(satt.source, "KASUS_STATE_FILE");

  assert.equal(resolveStatePath({ source: { KASUS_STATE_FILE: "/delt/a.json" }, cwd: "/repo" }).path, "/delt/a.json");
});

// ---------------------------------------------------------------------------
// CLI-en, ende til ende
// ---------------------------------------------------------------------------

function cli(args, cwd) {
  const env = { ...process.env, KASUS_STATE_FILE: "", KASUS_MCP_URL: "" };
  return JSON.parse(execFileSync(process.execPath, [CLI, ...args, "--json"], { cwd, env, encoding: "utf8" }));
}

test("vindu: første gang er 24 t, og listevinduet følger vindusregelen", () => {
  const cwd = mkdtempSync(join(tmpdir(), "kasus-cli-"));
  const { meta } = cli(["vindu", "--org", "avisa"], cwd);
  assert.equal(meta.kvittering, null);
  assert.equal(meta.vindu.basis, "første saksløp");
  assert.equal(meta.listevindu, 24);
  assert.deepEqual(meta.altSett, []);
  assert.ok(Date.parse(meta.kvitterAt) > 0);
});

test("vindu → kvitter → vindu: gulvet er 24 t, og kvitteringen hever det", () => {
  const cwd = mkdtempSync(join(tmpdir(), "kasus-cli-"));
  const femDager = new Date(Date.now() - 5 * 86_400_000).toISOString();
  cli(["kvitter", "--org", "avisa", "--at", femDager, "--ids", "s1,s2"], cwd);

  const { meta } = cli(["vindu", "--org", "avisa"], cwd);
  assert.equal(meta.vindu.basis, "kvittering");
  assert.ok(meta.vindu.hours >= 5 * 24 + 2, "etterslepet skal med");
  assert.equal(meta.listevindu, meta.vindu.hours);
  assert.deepEqual(meta.altSett, ["s1", "s2"]);

  // En annen organisasjon i samme repo arver ingenting.
  assert.equal(cli(["vindu", "--org", "annen"], cwd).meta.vindu.basis, "første saksløp");
  // --hours overstyrer begge.
  assert.equal(cli(["vindu", "--org", "avisa", "--hours", "6"], cwd).meta.listevindu, 6);
});

test("vindu skriver ingenting — bare kvitter lager fila", () => {
  const cwd = mkdtempSync(join(tmpdir(), "kasus-cli-"));
  cli(["vindu", "--org", "avisa"], cwd);
  assert.deepEqual(readdirSync(cwd), []);
  cli(["kvitter", "--org", "avisa", "--ids", "s1", "--ids-only"], cwd);
  assert.deepEqual(readdirSync(join(cwd, ".claude")), ["kasus-state.json"]);
});

test("vindu har ingen skrivende kodesti i kildekoden", () => {
  const src = readFileSync(CLI, "utf8");
  const vindu = src.slice(src.indexOf("async function runVindu"), src.indexOf("async function runKvitter"));
  assert.ok(vindu.length > 200, "fant ikke runVindu-kroppen");
  assert.equal(/writeState\s*\(/.test(vindu), false);
  assert.equal(/\back\s*\(/.test(vindu), false);
});

test("scriptene har ingen nettverkskode — dataene kommer fra MCP", () => {
  const filer = ["kasus.mjs", "state.mjs", "target.mjs", join("..", "lib", "args.mjs")];
  for (const fil of filer) {
    const src = readFileSync(join(HERE, fil), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    assert.equal(/\bfetch\s*\(|node:https?|node:net|XMLHttpRequest/.test(src), false, `${fil} har nettverkskode`);
  }
});
