#!/usr/bin/env node
/**
 * Enhetstester for kasus-verktøyet. Kjøres av `/kasus:test` (self-test.sh) med
 * Node-innebygd `node:test` — ingen avhengigheter, ingen byggesteg.
 *
 * Testene er skrevet mot de tingene som feiler STILLE hvis de knekker:
 * mål-presedensen, at nøkkelen ikke lekker i output, at maskeringen tar dybden
 * MEN ikke spiser redaksjonelle felt som `keyFigures`, at pagineringen sier fra
 * når taket er nådd, og at det ikke finnes en skrivende kodesti.
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

import { envSuffix, envVar, readEnvValue } from "../lib/env.mjs";
import { boolFlag, intFlag, parseArgs, requireKnownFlags, UsageError } from "../lib/args.mjs";
import { clip, fmtAge } from "../lib/table.mjs";
import { isSecretKey, redact } from "./redact.mjs";
import { ConfigError, DEFAULT_BASE_URL, headerLine, resolveTarget, variableNames } from "./targets.mjs";
import { apiGet, apiList, ApiError } from "./api.mjs";
import {
  bucketOf,
  bucketTitle,
  describeOrigin,
  publishedNote,
  SIGNAL_BUCKETS,
} from "./render.mjs";
import {
  documentFrequency,
  HEAVY_FIELD_WEIGHT,
  isCandidate,
  MIN_TERMS,
  rankArticles,
  scoreArticle,
  stripHtml,
  terms,
} from "./match.mjs";
import {
  ack,
  classify,
  clearTarget,
  DEFAULT_STATE_FILE,
  entryFor,
  fingerprint,
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
const KEY = "kasus_sk_hemmelig_verdi_som_ikke_skal_lekke";

// ---------------------------------------------------------------------------
// Miljønavn → variabelnavn
// ---------------------------------------------------------------------------

test("envSuffix: bindestrek blir understrek, fordi shell ikke kan sette annet", () => {
  assert.equal(envSuffix("production"), "PRODUCTION");
  assert.equal(envSuffix("pre-prod"), "PRE_PROD");
  assert.equal(envSuffix(" staging "), "STAGING");
  assert.equal(envVar("KASUS_API_KEY", "pre-prod"), "KASUS_API_KEY_PRE_PROD");
});

test("readEnvValue: per-miljø vinner over delt, og kilden sies", () => {
  const source = { KASUS_API_KEY: "delt", KASUS_API_KEY_STAGING: "staging" };
  assert.deepEqual(readEnvValue("KASUS_API_KEY", "staging", source), {
    value: "staging",
    source: "KASUS_API_KEY_STAGING",
    tried: ["KASUS_API_KEY_STAGING", "KASUS_API_KEY"],
  });
  assert.equal(readEnvValue("KASUS_API_KEY", "production", source).source, "KASUS_API_KEY");
  assert.equal(readEnvValue("KASUS_API_KEY", null, source).value, "delt");
});

test("readEnvValue: tom streng teller som usatt", () => {
  const r = readEnvValue("KASUS_API_KEY", null, { KASUS_API_KEY: "   " });
  assert.equal(r.value, null);
  assert.equal(r.source, null);
});

// ---------------------------------------------------------------------------
// Mål-oppløsning
// ---------------------------------------------------------------------------

test("resolveTarget: manglende nøkkel stopper med MANGLER og nevner begge navn", () => {
  assert.throws(
    () => resolveTarget({ env: "staging", source: {} }),
    (err) => {
      assert.ok(err instanceof ConfigError);
      assert.match(err.message, /^MANGLER:/);
      assert.match(err.message, /KASUS_API_KEY_STAGING eller KASUS_API_KEY/);
      return true;
    },
  );
});

test("resolveTarget: base-URL defaulter, og kilden sier at ingen konfig lå bak", () => {
  const t = resolveTarget({ source: { KASUS_API_KEY: KEY } });
  assert.equal(t.baseUrl, DEFAULT_BASE_URL);
  assert.equal(t.baseUrlSource, "default (app.kasus.io)");
  assert.equal(t.timeoutMs, 30000);
});

test("resolveTarget: per-miljø base-URL vinner, og etterslepende skråstrek fjernes", () => {
  const t = resolveTarget({
    env: "staging",
    source: {
      KASUS_API_KEY_STAGING: KEY,
      KASUS_BASE_URL: "https://app.kasus.io",
      KASUS_BASE_URL_STAGING: "https://staging.kasus.io/",
    },
  });
  assert.equal(t.baseUrl, "https://staging.kasus.io");
  assert.equal(t.baseUrlSource, "KASUS_BASE_URL_STAGING");
  assert.equal(t.apiKeySource, "KASUS_API_KEY_STAGING");
});

test("resolveTarget: en base-URL uten protokoll er en feil, ikke en gjetning", () => {
  assert.throws(
    () => resolveTarget({ source: { KASUS_API_KEY: KEY, KASUS_BASE_URL: "app.kasus.io" } }),
    ConfigError,
  );
});

test("resolveTarget: ugyldig timeout stopper framfor å falle tilbake", () => {
  assert.throws(
    () => resolveTarget({ source: { KASUS_API_KEY: KEY, KASUS_TIMEOUT_MS: "snart" } }),
    ConfigError,
  );
});

test("headerLine: nøkkelverdien er IKKE i outputen — kun variabelnavnet", () => {
  const t = resolveTarget({ env: "staging", source: { KASUS_API_KEY_STAGING: KEY } });
  const header = headerLine(t);
  assert.ok(!header.includes(KEY), `nøkkelen lekket: ${header}`);
  assert.match(header, /\(satt\) fra KASUS_API_KEY_STAGING/);
  assert.match(header, /read-only/);
  assert.match(header, /app\.kasus\.io/);
});

test("variableNames: uten miljø forsøkes bare den delte varianten", () => {
  assert.deepEqual(variableNames(null).apiKey, ["KASUS_API_KEY"]);
  assert.deepEqual(variableNames("pre-prod").baseUrl, [
    "KASUS_BASE_URL_PRE_PROD",
    "KASUS_BASE_URL",
  ]);
});

// ---------------------------------------------------------------------------
// Maskering
// ---------------------------------------------------------------------------

test("isSecretKey: hemmelig-navngitte nøkler treffes i alle skrivemåter", () => {
  for (const key of [
    "apiKey",
    "api_key",
    "API-KEY",
    "access_token",
    "authorization",
    "Cookie",
    "clientSecret",
    "password",
    "private_key",
    "bearer",
  ]) {
    assert.ok(isSecretKey(key), `skulle maskert ${key}`);
  }
});

test("isSecretKey: redaksjonelle felt med «key» i navnet maskeres IKKE", () => {
  // Dette er den farlige retningen: en for bred regel spiser nøkkeltallene
  // artikkelen skal bygges på, og resultatet ser ut som «kilden hadde ingen tall».
  for (const key of ["keyFigures", "keyStats", "keyActors", "monkey", "keywords", "turnkey"]) {
    assert.ok(!isSecretKey(key), `skulle IKKE maskert ${key}`);
  }
});

test("redact: maskerer i dybden, gjennom arrays, og beholder strukturen", () => {
  const out = redact({
    title: "Boligprisene faller",
    details: {
      keyFigures: ["-4,2 %"],
      config: { configurable: { openai_api_key: "sk-xxx" } },
    },
    sources: [{ url: "https://x.no", token: "abc" }],
  });

  assert.equal(out.details.config.configurable.openai_api_key, "[maskert]");
  assert.equal(out.sources[0].token, "[maskert]");
  assert.equal(out.sources[0].url, "https://x.no");
  assert.deepEqual(out.details.keyFigures, ["-4,2 %"]);
  assert.equal(out.title, "Boligprisene faller");
});

test("redact: for dyp nesting klippes framfor å rekursere i det uendelige", () => {
  let deep = "bunn";
  for (let i = 0; i < 20; i++) deep = { nivå: deep };
  const out = JSON.stringify(redact(deep));
  assert.match(out, /klippet: for dyp nesting/);
});

// ---------------------------------------------------------------------------
// Argumenter
// ---------------------------------------------------------------------------

test("parseArgs: --nøkkel verdi, --nøkkel=verdi, flagg og posisjonelle", () => {
  const { flags, positional } = parseArgs(["signals", "--status", "new", "--limit=5", "--json"]);
  assert.deepEqual(positional, ["signals"]);
  assert.deepEqual(flags, { status: "new", limit: "5", json: true });
});

test("requireKnownFlags: en skrivefeil avvises framfor å bli ignorert stille", () => {
  assert.throws(() => requireKnownFlags({ limt: "5" }, ["limit"]), /Ukjent flagg: --limt/);
});

test("intFlag: satt men ugyldig er en feil, ikke en grunn til å bruke defaulten", () => {
  assert.equal(intFlag({}, "limit", 20), 20);
  assert.equal(intFlag({ limit: "5" }, "limit", 20), 5);
  assert.throws(() => intFlag({ limit: "abc" }, "limit", 20), /positivt tall/);
  assert.throws(() => intFlag({ limit: "0" }, "limit", 20), /positivt tall/);
});

// ---------------------------------------------------------------------------
// Opphav (origin)
// ---------------------------------------------------------------------------

test("describeOrigin: null skiller mellom konkurrent-forside og fritt temasøk", () => {
  assert.match(describeOrigin({ origin: null, type: "competitor_article" }), /forside/);
  assert.match(describeOrigin({ origin: null, type: "market_signal" }), /fritt temasøk/);
});

test("describeOrigin: en ukjent origin-verdi behandles som «annet opphav»", () => {
  // API-et kan legge til nye verdier uten at det er en brytende endring.
  assert.match(describeOrigin({ origin: "noe_nytt", type: "market_signal" }), /ukjent opphav/);
  assert.match(describeOrigin({ origin: "own_followup" }), /EGEN fersk sak/);
});

// ---------------------------------------------------------------------------
// HTTP-laget (stubbet fetch)
// ---------------------------------------------------------------------------

function withFetch(handler, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return (async () => {
    try {
      return await fn();
    } finally {
      globalThis.fetch = original;
    }
  })();
}

const target = () => resolveTarget({ source: { KASUS_API_KEY: KEY } });

test("apiGet: sender bearer-token og GET, og maskerer svaret", async () => {
  const seen = {};
  const body = await withFetch(
    async (url, opts) => {
      seen.url = String(url);
      seen.method = opts.method;
      seen.auth = opts.headers.Authorization;
      return { ok: true, status: 200, json: async () => ({ data: { token: "abc", id: "1" } }) };
    },
    () => apiGet(target(), "/api/v1/signals", { status: "new", tom: "" }),
  );

  assert.equal(seen.method, "GET");
  assert.equal(seen.auth, `Bearer ${KEY}`);
  assert.match(seen.url, /\/api\/v1\/signals\?status=new$/, "tomme query-verdier skal utelates");
  assert.equal(body.data.token, "[maskert]");
});

test("apiGet: 401 peker på variabelnavnet, og lekker ikke nøkkelen", async () => {
  await withFetch(
    async () => ({ ok: false, status: 401, statusText: "Unauthorized", json: async () => ({ error: "Unauthorized" }) }),
    async () => {
      await assert.rejects(apiGet(target(), "/api/v1/profile"), (err) => {
        assert.ok(err instanceof ApiError);
        assert.match(err.message, /KASUS_API_KEY/);
        assert.match(err.message, /tilbakekalt, utløpt/);
        assert.ok(!err.message.includes(KEY), "nøkkelen lekket i feilmeldingen");
        return true;
      });
    },
  );
});

test("apiGet: 404 sier at det KAN være en annen organisasjon", async () => {
  await withFetch(
    async () => ({ ok: false, status: 404, statusText: "Not Found", json: async () => ({ error: "Not found" }) }),
    async () => {
      await assert.rejects(apiGet(target(), "/api/v1/signals/xyz"), (err) => {
        assert.match(err.message, /annen organisasjon/);
        return true;
      });
    },
  );
});

test("apiGet: 200 med ikke-JSON sier at base-URL-en kanskje ikke er Kasus", async () => {
  await withFetch(
    async () => ({ ok: true, status: 200, json: async () => { throw new Error("not json"); } }),
    async () => {
      await assert.rejects(apiGet(target(), "/api/v1/profile"), /ikke med JSON/);
    },
  );
});

test("apiList: følger nextCursor, og SIER fra når taket er nådd", async () => {
  const pages = [
    { data: [{ id: "1" }, { id: "2" }], nextCursor: "2" },
    { data: [{ id: "3" }], nextCursor: "3" },
  ];
  let call = 0;
  const limits = [];

  const res = await withFetch(
    async (url) => {
      limits.push(new URL(url).searchParams.get("limit"));
      const page = pages[call++] ?? { data: [], nextCursor: null };
      return { ok: true, status: 200, json: async () => page };
    },
    () => apiList(target(), "/api/v1/signals", {}, 3),
  );

  assert.equal(res.items.length, 3);
  assert.equal(res.pages, 2);
  assert.equal(res.truncated, true, "nextCursor var satt da taket ble nådd");
  assert.deepEqual(limits, ["3", "1"], "andre side ber bare om det som mangler");
});

test("apiList: sider på maks 100 selv om --limit er høyere", async () => {
  const limits = [];
  await withFetch(
    async (url) => {
      limits.push(Number(new URL(url).searchParams.get("limit")));
      return { ok: true, status: 200, json: async () => ({ data: [], nextCursor: null }) };
    },
    () => apiList(target(), "/api/v1/signals", {}, 500),
  );
  assert.deepEqual(limits, [100]);
});

// ---------------------------------------------------------------------------
// Read-only: garden er FRAVÆRET av en skrivende kodesti
// ---------------------------------------------------------------------------

test("api.mjs har ingen annen HTTP-metode enn GET", () => {
  const src = readFileSync(join(HERE, "api.mjs"), "utf8");
  const methods = [...src.matchAll(/method:\s*"([A-Z]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(methods)], ["GET"]);
  assert.equal(/\b(POST|PUT|PATCH|DELETE)\b/.test(src.replace(/^\s*\*.*$/gm, "")), false);
});

// ---------------------------------------------------------------------------
// Formatering
// ---------------------------------------------------------------------------

test("clip: sier AT teksten er klippet, og hvor lang den var", () => {
  const out = clip("a".repeat(300), 50);
  assert.match(out, /\[klippet, 300 tegn totalt\]/);
  assert.equal(clip("kort", 50), "kort");
  assert.equal(clip("med\n  linjeskift", 50), "med linjeskift");
});

test("fmtAge: relativ alder i minutter, timer og dager", () => {
  const ago = (mins) => new Date(Date.now() - mins * 60000).toISOString();
  assert.match(fmtAge(ago(10)), /for 10 min siden/);
  assert.match(fmtAge(ago(120)), /for 2 t siden/);
  assert.match(fmtAge(ago(60 * 24 * 5)), /for 5 d siden/);
});

// ---------------------------------------------------------------------------
// Kvitteringen — «siden sist»
// ---------------------------------------------------------------------------

/** Egen mappe per test, så en test ikke arver en annen tests kvittering. */
function tmpStatePath(navn) {
  const dir = mkdtempSync(join(tmpdir(), `kasus-state-${navn}-`));
  return join(dir, "under", "kasus-state.json");
}

const TARGET = { baseUrl: "https://app.kasus.io", env: null, apiKey: KEY };

test("targetKey: to nøkler på samme vert deler IKKE kvittering", () => {
  const a = targetKey(TARGET);
  const b = targetKey({ ...TARGET, apiKey: `${KEY}_annen_redaksjon` });
  assert.notEqual(a, b);
  // Nøkkelen avgjør organisasjonen, så en byttet nøkkel skal ikke arve
  // «siden sist» fra den forrige.
  assert.equal(a.startsWith("app.kasus.io|-|"), true);
});

test("fingerprint: enveis, kort, og inneholder ikke nøkkelen", () => {
  const fp = fingerprint(KEY);
  assert.match(fp, /^[0-9a-f]{12}$/);
  assert.equal(fp.includes(KEY), false);
  assert.equal(KEY.includes(fp), false);
  assert.equal(fingerprint(KEY), fp);
});

test("readState: fil som ikke finnes er første runde, ikke en feil", () => {
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
  assert.equal(w.basis, "første runde");
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

test("classify: skiller «alt sett» fra «utenfor vinduet»", () => {
  const from = Date.parse("2026-08-31T10:00:00Z");
  const ctx = { from, seenIds: new Set(["alt-sett"]) };

  assert.equal(classify({ id: "alt-sett" }, "2026-08-31T11:00:00Z", ctx), "alt sett");
  assert.equal(classify({ id: "ny" }, "2026-08-31T11:00:00Z", ctx), "ny");
  assert.equal(classify({ id: "gammel" }, "2026-08-31T09:00:00Z", ctx), "utenfor vinduet");
  // Et element uten brukbart tidspunkt VISES — en utelatelse her er et signal
  // ingen får se, og det er den dyre feilen av de to.
  assert.equal(classify({ id: "udatert" }, null, ctx), "uten tidspunkt");
  assert.equal(classify({ id: "rar" }, "i går", ctx), "uten tidspunkt");
});

test("ack: setter kvitteringen, slår sammen id-er og fjerner duplikater", () => {
  const key = targetKey(TARGET);
  const at = "2026-08-31T12:00:00.000Z";

  const first = ack({ version: STATE_VERSION, targets: {} }, {
    key, host: "app.kasus.io", env: null, at, ids: ["a", "b", "a"],
  });
  const entry = entryFor(first, key);
  assert.deepEqual(entry.checkpoints, { signals: at });
  assert.deepEqual(entry.seenIds, ["a", "b"]);

  const senere = "2026-08-31T13:00:00.000Z";
  const second = ack(first, { key, host: "app.kasus.io", env: null, at: senere, ids: ["b", "c"] });
  assert.deepEqual(entryFor(second, key).seenIds, ["a", "b", "c"]);
  assert.equal(entryFor(second, key).checkpoints.signals, senere);
});

test("ack: at=null beholder tidspunktet — en halvferdig runde svelger ingenting", () => {
  const key = targetKey(TARGET);
  const at = "2026-08-31T12:00:00.000Z";
  const first = ack({ version: STATE_VERSION, targets: {} }, {
    key, host: "app.kasus.io", env: null, at, ids: ["a"],
  });
  const bare_ider = ack(first, { key, host: "app.kasus.io", env: null, at: null, ids: ["b"] });

  assert.deepEqual(entryFor(bare_ider, key).checkpoints, { signals: at });
  assert.deepEqual(entryFor(bare_ider, key).seenIds, ["a", "b"]);
});

test("ack: taket på huskede id-er kutter de ELDSTE", () => {
  const key = targetKey(TARGET);
  const mange = Array.from({ length: MAX_SEEN_IDS + 50 }, (_, i) => `id-${i}`);
  const state = ack({ version: STATE_VERSION, targets: {} }, {
    key, host: "app.kasus.io", env: null, at: "2026-08-31T12:00:00.000Z", ids: mange,
  });

  const seen = entryFor(state, key).seenIds;
  assert.equal(seen.length, MAX_SEEN_IDS);
  assert.equal(seen.at(-1), `id-${MAX_SEEN_IDS + 49}`);
  // De eldste er de som er lengst utenfor etterslep-vinduet, og dermed de som
  // ikke kan komme tilbake som støy.
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
  const key = targetKey(TARGET);
  const state = ack({ version: STATE_VERSION, targets: {} }, {
    key, host: "app.kasus.io", env: null, at: "2026-08-31T12:00:00.000Z", ids: ["a"],
  });

  writeState(path, state);
  assert.deepEqual(readState(path).state, state);
  assert.deepEqual(
    readdirSync(dirname(path)).filter((f) => f.includes(".tmp")),
    [],
  );
});

test("kvitteringsfila inneholder IKKE API-nøkkelen", () => {
  const path = tmpStatePath("hemmelig");
  const key = targetKey(TARGET);
  writeState(
    path,
    ack({ version: STATE_VERSION, targets: {} }, {
      key, host: "app.kasus.io", env: null, at: "2026-08-31T12:00:00.000Z", ids: ["a"],
    }),
  );
  const raw = readFileSync(path, "utf8");
  assert.equal(raw.includes(KEY), false);
  assert.equal(raw.includes(fingerprint(KEY)), true);
});

test("normalizeAt: ulesbart og framtidig tidspunkt avvises", () => {
  const now = Date.parse("2026-08-31T12:00:00Z");
  assert.equal(normalizeAt("2026-08-31T09:00:00Z", now), "2026-08-31T09:00:00.000Z");
  assert.throws(() => normalizeAt("i går", now), /ikke et tidspunkt jeg kan lese/);
  assert.throws(() => normalizeAt("2099-01-01T00:00:00Z", now), /fram i tid/);
});

test("resolveStatePath: relativ sti tolkes fra cwd, og kilden sies", () => {
  const fra_default = resolveStatePath({ source: {}, cwd: "/repo" });
  assert.equal(fra_default.path, join("/repo", DEFAULT_STATE_FILE));
  assert.match(fra_default.source, /^default \(/);

  const satt = resolveStatePath({
    source: { KASUS_STATE_FILE: "delt/state.json" },
    cwd: "/repo",
  });
  assert.equal(satt.path, "/repo/delt/state.json");
  assert.equal(satt.source, "KASUS_STATE_FILE");

  const absolutt = resolveStatePath({
    env: "staging",
    source: { KASUS_STATE_FILE: "/delt/a.json", KASUS_STATE_FILE_STAGING: "/delt/b.json" },
    cwd: "/repo",
  });
  assert.equal(absolutt.path, "/delt/b.json");
  assert.equal(absolutt.source, "KASUS_STATE_FILE_STAGING");
});

// ---------------------------------------------------------------------------
// Bare «kvitter» skriver
// ---------------------------------------------------------------------------

test("«nytt» har ingen skrivende kodesti — bare «kvitter» flytter kvitteringen", () => {
  const src = readFileSync(join(HERE, "kasus.mjs"), "utf8");
  const nytt = src.slice(
    src.indexOf("async function runNytt"),
    src.indexOf("async function runKvitter"),
  );
  assert.ok(nytt.length > 200, "fant ikke runNytt-kroppen");
  // En oversikt som kvitterte seg selv ville betydd at et avbrutt kall mistet
  // signalene sine uten at noe sa fra.
  assert.equal(/writeState\s*\(/.test(nytt), false);
  assert.equal(/\back\s*\(/.test(nytt), false);
  assert.equal(/writeState\s*\(/.test(src.slice(src.indexOf("async function runKvitter"))), true);
});

// ---------------------------------------------------------------------------
// Av/på-flagg
// ---------------------------------------------------------------------------

test("boolFlag: --flagg alene er på, en verdi må være entydig", () => {
  assert.equal(boolFlag({}, "all"), false);
  assert.equal(boolFlag({ all: true }, "all"), true);
  assert.equal(boolFlag({ all: "ja" }, "all"), true);
  assert.equal(boolFlag({ all: "false" }, "all"), false);
  // `--all proposal` spiser det neste ordet. Det skal SIES, ikke tolkes som «av»
  // og gi et svar med feil innhold.
  assert.throws(() => boolFlag({ all: "proposal" }, "all"), UsageError);
});

// ---------------------------------------------------------------------------
// De fire kategoriene, og forskjellen mellom oppdaget og publisert
// ---------------------------------------------------------------------------

test("bucketOf: de fire kategoriene skiller det som ellers ser likt ut", () => {
  // Begge oppfølgingssøkene lagrer funnene som market_signal, og origin er null
  // for BÅDE konkurrent-forside og fritt temasøk. Uten begge feltene smelter
  // fire ulike ting sammen til én.
  assert.equal(bucketOf({ origin: "own_followup", type: "market_signal" }), "egen_oppfolging");
  assert.equal(
    bucketOf({ origin: "competitor_followup", type: "market_signal" }),
    "konkurrent_oppfolging",
  );
  assert.equal(bucketOf({ origin: null, type: "competitor_article" }), "konkurrentsak");
  assert.equal(bucketOf({ origin: null, type: "market_signal" }), "temasok");
  assert.equal(bucketOf({ origin: "partner_feed", type: "market_signal" }), "annet");
});

test("SIGNAL_BUCKETS: hver kategori har en forklaring, og rekkefølgen er redaksjonell", () => {
  assert.deepEqual(
    SIGNAL_BUCKETS.map((b) => b.key),
    ["egen_oppfolging", "konkurrent_oppfolging", "konkurrentsak", "temasok", "annet"],
  );
  // Forklaringen vises i HVER runde, så en tom forklaring er en kategori uten
  // tiltak knyttet til den.
  for (const bucket of SIGNAL_BUCKETS) {
    assert.ok(bucket.title.length > 3, `${bucket.key} mangler tittel`);
    assert.ok(bucket.explain.length > 40, `${bucket.key} mangler forklaring`);
  }
  // Ukjent opphav tar med den rå verdien, ellers er den umulig å slå opp.
  assert.match(bucketTitle("annet", [{ origin: "partner_feed" }]), /partner_feed/);
  assert.equal(bucketTitle("temasok"), "FRITT TEMASØK");
});

test("publishedNote: en gammel sak i et temasøk MERKES som gammel", () => {
  const detectedAt = "2026-08-31T10:00:00Z";
  // Det dyre tilfellet: signalet er ferskt, saken er to år gammel.
  assert.match(
    publishedNote({ detectedAt, details: { publishedDate: "2024-07-12T10:00:00Z" } }),
    /^GAMMEL SAK: publisert for 2 år siden/,
  );
  // Innenfor en uke er publisering og oppdagelse praktisk talt samme hendelse.
  assert.match(
    publishedNote({ detectedAt, details: { publishedDate: "2026-08-30T10:00:00Z" } }),
    /^publisert for/,
  );
  // Manglende dato er ikke det samme som fersk, og skal ikke leses som fersk.
  assert.equal(publishedNote({ detectedAt, details: {} }), "publisert: ukjent dato");
  assert.equal(
    publishedNote({ detectedAt, details: { publishedDate: "ikke en dato" } }),
    "publisert: ukjent dato",
  );
});

test("fmtAge: gamle datoer i måneder og år, ellers må de regnes om i hodet", () => {
  const ago = (dager) => new Date(Date.now() - dager * 86400000).toISOString();
  assert.match(fmtAge(ago(5)), /for 5 d siden/);
  assert.match(fmtAge(ago(90)), /for 3 mnd siden/);
  assert.match(fmtAge(ago(400)), /for over ett år siden/);
  assert.match(fmtAge(ago(780)), /for 2 år siden/);
});

// ---------------------------------------------------------------------------
// «Har vi dekket dette før?» — lokal matching mot egne artikler
// ---------------------------------------------------------------------------

const EGNE_ARTIKLER = [
  {
    id: "a1",
    title: "Boligprisene faller i Bodø for fjerde kvartal på rad",
    subtitle: "Kvadratmeterprisen ned 3,1 prosent.",
    kicker: "Boligmarkedet",
    tags: ["bolig", "bodø"],
    sectionTag: "Økonomi",
    excerpt: "Boligprisene i Bodø falt 3,1 prosent siste kvartal, viser tall fra SSB.",
    published: "2026-07-17T05:00:00Z",
  },
  {
    id: "a2",
    title: "Tromsø mangler 2000 boliger",
    tags: ["bolig", "tromsø"],
    sectionTag: "Nyheter",
    excerpt: "Tromsø kommune mangler 2000 boliger fram mot 2030.",
    published: "2026-08-19T05:00:00Z",
  },
  {
    id: "a3",
    title: "Norges Bank holder renten uendret",
    tags: ["renter"],
    sectionTag: "Økonomi",
    excerpt: "Renten holdes uendret på 4,5 prosent.",
    published: "2026-08-28T05:00:00Z",
  },
];

test("stripHtml: body fra Labrador ER html, og må bli lesbar tekst", () => {
  assert.equal(stripHtml("<p>Prisene <b>falt</b></p>"), "Prisene falt");
  assert.equal(stripHtml("a&nbsp;b"), "a b");
  assert.equal(stripHtml(null), "");
});

test("terms: stoppord og for korte ord ut, forkortelser og årstall inn", () => {
  const t = terms("SSB melder at prisene i Bodø falt med 4,2 prosent i 2026");
  assert.ok(t.has("ssb"), "forkortelser er ofte hele poenget i en nyhetssak");
  assert.ok(t.has("bodø"));
  assert.ok(t.has("2026"), "årstall skiller to saker om samme tema");
  assert.ok(!t.has("prosent"), "«prosent» treffer alt");
  assert.ok(!t.has("med"));
  assert.ok(!t.has("at"), "for kort");
});

test("documentFrequency: et ord i alle artiklene veier nesten ingenting", () => {
  const df = documentFrequency(EGNE_ARTIKLER);
  // «bolig» står i to av tre; «renten» i én. Det er forskjellen som gjør at et
  // treff på et særegent ord rangeres over et treff på husets favorittord.
  assert.equal(df.get("bolig"), 2);
  assert.equal(df.get("renten"), 1);
  assert.equal(df.has("fiskeoppdrett"), false);
});

test("scoreArticle: et ord teller i det TYNGSTE feltet det står i", () => {
  const df = documentFrequency(EGNE_ARTIKLER);
  const corpus = { df, total: EGNE_ARTIKLER.length };
  const query = terms("Boligprisene i Bodø falt");

  const bodø = scoreArticle(EGNE_ARTIKLER[0], query, corpus);
  const tromsø = scoreArticle(EGNE_ARTIKLER[1], query, corpus);

  assert.ok(bodø.styrke > tromsø.styrke, "Bodø-saken skal rangeres først");
  assert.ok(bodø.matched.includes("bodø"));
  assert.equal(bodø.toppfelt, 4, "«bodø» står i tittelen, som er tyngste felt");
  assert.deepEqual(scoreArticle(EGNE_ARTIKLER[0], new Set()).matched, []);
});

test("isCandidate: to fellesord, ELLER ett i et tungt felt", () => {
  // Regelen er permissiv med vilje: å vise en artikkel som ikke var samme sak
  // koster tretti sekunders lesing, å skjule en publisert sak koster en dublett.
  assert.equal(isCandidate({ matched: ["a", "b"], toppfelt: 1 }), true);
  assert.equal(isCandidate({ matched: ["a"], toppfelt: HEAVY_FIELD_WEIGHT }), true);
  assert.equal(isCandidate({ matched: ["a"], toppfelt: 1 }), false);
  assert.equal(isCandidate({ matched: [], toppfelt: 0 }), false);
  assert.equal(MIN_TERMS, 2);
});

test("rankArticles: finner egen dekning, og sier hvilke ord som traff", () => {
  const r = rankArticles(
    EGNE_ARTIKLER,
    "SSB: kvadratmeterprisen i Bodø falt 4,2 prosent siste kvartal",
    { top: 5 },
  );
  assert.equal(r.hits[0].article.id, "a1");
  assert.ok(r.hits[0].matched.includes("kvadratmeterprisen"));
  assert.equal(r.vurdert, 3);
});

test("rankArticles: ukjente ord er et SVAR — temaet er udekket", () => {
  const r = rankArticles(EGNE_ARTIKLER, "Lakselus og fiskeoppdrett i Finnmark", { top: 5 });
  assert.deepEqual(r.hits, []);
  // Dette er den nyttige opplysningen: ingen av ordene finnes i egne saker.
  assert.deepEqual(r.ukjenteOrd.sort(), ["fiskeoppdrett", "finnmark", "lakselus"].sort());
});

test("rankArticles: --top kutter, men SIER hvor mange som ikke ble vist", () => {
  const r = rankArticles(EGNE_ARTIKLER, "bolig boliger", { top: 1 });
  assert.equal(r.hits.length, 1);
  assert.equal(r.flereTreff, 1);
});

test("rankArticles: tom tekst gir ingen treff framfor alle treff", () => {
  const r = rankArticles(EGNE_ARTIKLER, "   ", { top: 5 });
  assert.deepEqual(r.hits, []);
  assert.deepEqual(r.query, []);
});
