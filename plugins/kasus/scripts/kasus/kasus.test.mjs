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
import { clip, fmtAge, stripHtml } from "../lib/table.mjs";
import { isSecretKey, redact } from "./redact.mjs";
import { ConfigError, DEFAULT_BASE_URL, headerLine, resolveTarget, variableNames } from "./targets.mjs";
import { apiGet, apiList, ApiError } from "./api.mjs";
import {
  bucketOf,
  bucketTitle,
  describeOrigin,
  publishedNote,
  renderArticleWindow,
  renderDigest,
  renderSignalWindow,
  SIGNAL_BUCKETS,
} from "./render.mjs";
import {
  ARTICLE_WINDOW_FIELDS,
  articleWindowCaveat,
  compactArticle,
  splitUnpublished,
} from "./articles.mjs";
import {
  applyLocalFilters,
  compactSignal,
  SIGNAL_CATEGORIES,
  SIGNAL_WINDOW_FIELDS,
  signalWindowCaveat,
} from "./signals.mjs";
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

test("ack: at=null beholder tidspunktet — et halvferdig saksløp svelger ingenting", () => {
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
  // Forklaringen vises i HVERT saksløp, så en tom forklaring er en kategori uten
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
    url: "https://eksempel.no/bodo",
    // De tunge feltene som IKKE skal med i vinduet.
    body: "<p>Lang brødtekst med <b>markup</b>.</p>",
    wordCount: 812,
    bylines: ["Kari Nordmann"],
  },
  {
    id: "a2",
    title: "Tromsø mangler 2000 boliger",
    tags: [],
    sectionTag: "Nyheter",
    excerpt: "",
    published: null,
    url: "https://eksempel.no/tromso",
  },
];

test("stripHtml: body fra Labrador ER html, og må bli lesbar tekst", () => {
  assert.equal(stripHtml("<p>Prisene <b>falt</b></p>"), "Prisene falt");
  assert.equal(stripHtml("a&nbsp;b"), "a b");
  assert.equal(stripHtml(null), "");
});

test("compactArticle: brødteksten er det tunge feltet, og skal IKKE med", () => {
  // 200 brødtekster er hundretusener av tokens for et spørsmål som avgjøres på
  // tittel, ingress og dato. De få som betyr noe hentes med «article <id>».
  const kort = compactArticle(EGNE_ARTIKLER[0]);
  assert.equal(kort.body, undefined);
  assert.equal(kort.wordCount, undefined);
  assert.equal(kort.bylines, undefined);
});

test("compactArticle: feltene et spørsmål om egen dekning trenger, er med", () => {
  const kort = compactArticle(EGNE_ARTIKLER[0]);
  // id og url fordi et svar skal kunne ettergås, published fordi den avgjør
  // dublett vs. oppfølging oftere enn tittelen gjør.
  for (const felt of ["id", "title", "kicker", "subtitle", "tags", "sectionTag", "excerpt", "published", "url"]) {
    assert.ok(felt in kort, `${felt} mangler i vinduet`);
  }
  assert.deepEqual(Object.keys(kort).sort(), [...ARTICLE_WINDOW_FIELDS].sort());
});

test("compactArticle: tomme felt utelates framfor å bli null-støy", () => {
  // 200 artikler med fire tomme nøkler hver er 800 linjer støy i et grunnlag
  // som skal LESES.
  const kort = compactArticle(EGNE_ARTIKLER[1]);
  assert.equal("tags" in kort, false, "tom liste skal utelates");
  assert.equal("excerpt" in kort, false, "tom streng skal utelates");
  assert.equal("published" in kort, false, "null skal utelates — rendringen sier UPUBLISERT");
  assert.equal(kort.id, "a2");
});

test("compactArticle: ingressen strippes for html og får et tak", () => {
  // Entiteter blir mellomrom, ikke tegnet — samme oppførsel som `body` har hatt.
  const kort = compactArticle({ id: "x", excerpt: "<p>Ett  &amp;  to</p>" });
  assert.equal(kort.excerpt, "Ett to");
  const lang = compactArticle({ id: "y", excerpt: "a".repeat(900) });
  assert.ok(lang.excerpt.length < 500, "ingressen skal klippes");
  assert.ok(lang.excerpt.endsWith("…"), "og si at den er klippet");
});

test("articleWindowCaveat: taket nådd er alvorlig uansett spørsmål", () => {
  // Det ene forbeholdet som gjør et svar ubrukelig: det MANGLER data.
  const c = articleWindowCaveat({ vindu: 200, taketNådd: true, filter: { hours: 24 } });
  assert.match(c, /TAKET ER NÅDD/);
  assert.match(c, /ufullstendig/);
});

test("articleWindowCaveat: med tidsgrense er svaret FULLSTENDIG, og det sies", () => {
  // «Hva har vi skrevet i dag?» har ikke vindusproblemet. Å resitere et
  // vindusforbehold her ville sådd tvil om et svar som faktisk er komplett.
  const c = articleWindowCaveat({ vindu: 7, filter: { hours: 24 } });
  assert.match(c, /FULLSTENDIG/);
  // Vindusforbeholdet skal IKKE resiteres her — det er kladdesetningen som
  // (legitimt) også nevner «ingen treff», så testen må peke på selve påstanden.
  assert.doesNotMatch(c, /ikke blant disse/);
  assert.doesNotMatch(c, /en eldre sak er usynlig/);
});

test("articleWindowCaveat: uten tidsgrense ER vinduet grensen", () => {
  // «Har vi skrevet om dette før?» har ingen tidsgrense, og da er den ene
  // feilslutningen som koster en dublett i spill.
  const c = articleWindowCaveat({ vindu: 200, filter: {} });
  assert.match(c, /200 nyeste/);
  assert.match(c, /«ikke blant disse», ikke «finnes ikke»/);
});

test("articleWindowCaveat: et filter som utelater noe, sier at det utelater noe", () => {
  const c = articleWindowCaveat({ vindu: 12, filter: { status: "P", cms: "labrador" } });
  assert.match(c, /status=P og cms=labrador/);
  assert.match(c, /ikke vurdert/);
});

test("articleWindowCaveat: sier alltid at brødteksten IKKE er med", () => {
  for (const filter of [{}, { hours: 24 }, { status: "P" }]) {
    assert.match(articleWindowCaveat({ vindu: 3, filter }), /article <id>/);
  }
});

test("splitUnpublished: kladd = ingen publiseringsdato, ikke et status-token", () => {
  // `status` er FRITEKST og varierer med CMS: P/D hos Labrador, Sanity og
  // HubSpot, men draft/pending/private hos WordPress. En sjekk på status ville
  // virket for noen redaksjoner og stille feilet for andre.
  const { publisert, utenPublisering } = splitUnpublished([
    { id: "p1", published: "2026-08-01T00:00:00Z", status: "P" },
    { id: "d1", published: null, status: "D" },
    { id: "d2", status: "draft" },
    { id: "d3", published: "", status: "pending" },
  ]);
  assert.deepEqual(
    publisert.map((a) => a.id),
    ["p1"],
  );
  assert.equal(utenPublisering, 3, "alle tre CMS-skrivemåtene skal fanges");
});

test("splitUnpublished: et EKSPLISITT --status skal ikke overstyres", () => {
  // Regelen gjorde «--status D» til et kall som alltid svarte tomt — altså gjorde
  // fluktveien ut av regelen ubrukelig. Fanget ende-til-ende, ikke av en test.
  const kladder = [
    { id: "d1", published: null, status: "D" },
    { id: "d2", published: null, status: "D" },
  ];
  const r = splitUnpublished(kladder, { status: "D" });
  assert.equal(r.publisert.length, 2, "spurte man om kladder, skal man få kladder");
  assert.equal(r.utenPublisering, 0);
  assert.equal(r.respektertStatus, true);

  // Uten status gjelder regelen.
  assert.equal(splitUnpublished(kladder).publisert.length, 0);
});

test("articleWindowCaveat: med --status påstår forbeholdet IKKE at regelen gjelder", () => {
  const c = articleWindowCaveat({ vindu: 5, filter: { status: "D" } });
  assert.match(c, /gjelder IKKE her/);
  assert.doesNotMatch(c, /holdt utenfor vinduet/);
});

test("articleWindowCaveat: kladder er UTENFOR, og det sies uansett", () => {
  // «Ingen treff» leses som «ingen jobber med dette», og en kollega som alt har
  // begynt på saken er nettopp det man ville vite om.
  for (const filter of [{}, { hours: 24 }]) {
    const c = articleWindowCaveat({ vindu: 5, filter });
    assert.match(c, /[Kk]ladder er utenfor|KLADDER/);
    assert.match(c, /--status D/);
  }
});

test("articleWindowCaveat: antallet kladder står der når det finnes noen", () => {
  // Regelen alene og «3 kladder holdt utenfor» er to helt ulike opplysninger.
  const c = articleWindowCaveat({ vindu: 5, filter: {}, utenPublisering: 3 });
  assert.match(c, /3 upubliserte artikler ble holdt utenfor/);
  assert.match(c, /en kollega alt skriver saken/);
});

test("articleWindowCaveat: vinduet sier PUBLISERTE, ikke bare «artikler»", () => {
  // Uten ordet leses «de 200 nyeste» som alt redaksjonen har, kladder inkludert.
  assert.match(articleWindowCaveat({ vindu: 200, filter: {} }), /200 nyeste PUBLISERTE/);
  assert.match(articleWindowCaveat({ vindu: 6, filter: { hours: 24 } }), /publiserte/);
});

test("renderArticleWindow: hver artikkel bærer id og url, ellers kan svaret ikke ettergås", () => {
  const vindu = EGNE_ARTIKLER.map(compactArticle);
  const out = renderArticleWindow(vindu, {
    vindu: vindu.length,
    sider: 1,
    taketNådd: false,
    felter: ARTICLE_WINDOW_FIELDS,
    forbehold: articleWindowCaveat({ vindu: vindu.length, filter: {} }),
  });
  assert.match(out, /id: a1/);
  assert.match(out, /id: a2/);
  assert.match(out, /https:\/\/eksempel\.no\/bodo/);
  // Upublisert SIES framfor å bli en manglende linje: en tom linje leses som
  // «ingen informasjon», og da er det ingenting som sier at datoen mangler.
  assert.match(out, /UPUBLISERT/);
});

test("renderArticleWindow: forbeholdet står ØVERST, ikke som en fotnote", () => {
  const forbehold = articleWindowCaveat({ vindu: 2, filter: {} });
  const out = renderArticleWindow(EGNE_ARTIKLER.map(compactArticle), {
    vindu: 2,
    sider: 1,
    taketNådd: false,
    felter: ARTICLE_WINDOW_FIELDS,
    forbehold,
  });
  // Konklusjonen «ikke dekket» trekkes i det øyeblikket lista ser tom ut. Etter
  // det leser ingen en fotnote.
  assert.ok(out.indexOf("FORBEHOLD") < out.indexOf("▸"), "forbeholdet må stå før artiklene");
});

test("renderArticleWindow: tomt vindu er ikke «ikke dekket»", () => {
  const out = renderArticleWindow([], {
    vindu: 0,
    sider: 1,
    taketNådd: false,
    felter: ARTICLE_WINDOW_FIELDS,
    forbehold: articleWindowCaveat({ vindu: 0, filter: {} }),
  });
  // Ingen artikler synkronisert betyr at spørsmålet ikke KAN besvares. Det er et
  // annet svar enn «temaet er udekket», og forveksles lett.
  assert.match(out, /ingen egne artikler/i);
  assert.match(out, /kan spørsmålet ikke besvares/i);
});

// ---------------------------------------------------------------------------
// Lenka er det journalisten klikker på FØR han velger sak
// ---------------------------------------------------------------------------

/** Minimal digest, slik runNytt bygger den. */
function digestMed(signals) {
  return {
    stateSource: "KASUS_STATE_FILE",
    lagHours: 2,
    checkpoint: null,
    window: { basis: "første saksløp", hours: 24, from: 0 },
    skipped: { seen: 0, window: 0, dismissed: 0 },
    signals,
    fetched: signals.length,
    truncated: false,
    fordeling: [],
    gamleSaker: [],
    ack: { at: "2026-08-31T10:00:00.000Z", ids: signals.map((s) => s.id) },
  };
}

test("renderDigest: hvert signal bærer LENKE-linja si", () => {
  const out = renderDigest(
    digestMed([
      {
        id: "s1",
        status: "new",
        type: "market_signal",
        origin: "own_followup",
        title: "SSB: prisene falt",
        url: "https://ssb.no/tall",
        detectedAt: new Date().toISOString(),
        summary: "Kort.",
        details: {},
      },
    ]),
  );
  assert.match(out, /LENKE: https:\/\/ssb\.no\/tall/);
});

test("renderDigest: et signal UTEN url sier det framfor å utelate linja", () => {
  // En manglende linje leses som «ingen informasjon», og da er det ingenting som
  // sier at saken må vurderes på tittelen alene.
  const out = renderDigest(
    digestMed([
      {
        id: "s2",
        status: "new",
        type: "market_signal",
        origin: null,
        title: "Uten lenke",
        url: null,
        detectedAt: new Date().toISOString(),
        details: {},
      },
    ]),
  );
  assert.match(out, /LENKE: \(ingen — signalet har ingen url å åpne\)/);
});

test("renderDigest: flere kilder bak et signal SIES, ellers åpnes de aldri", () => {
  const out = renderDigest(
    digestMed([
      {
        id: "s3",
        status: "new",
        type: "market_signal",
        origin: "competitor_followup",
        title: "Tre kilder",
        url: "https://a.no",
        detectedAt: new Date().toISOString(),
        details: {},
        sources: [{ url: "https://a.no" }, { url: "https://b.no" }, { url: "https://c.no" }],
      },
    ]),
  );
  assert.match(out, /\+2 kilder til \(se «signal s3»\)/);
});

// ---------------------------------------------------------------------------
// Signalvinduet: det `kasus-lookout` leser
// ---------------------------------------------------------------------------

const RÅ_SIGNAL = {
  id: "s1",
  title: "SSB: kvadratmeterprisen falt 4,2 prosent",
  status: "new",
  type: "market_signal",
  origin: "own_followup",
  url: "https://ssb.no/tall",
  sourceLabel: "SSB",
  detectedAt: "2026-08-30T06:00:00Z",
  summary: "Tallene for andre kvartal.",
  sources: [{ url: "https://a.no" }, { url: "https://b.no" }],
  details: {
    matchedPattern: "Boligmarkedet i nord",
    publishedDate: "2026-08-29T06:00:00Z",
    // Researchkonteksten — den tunge halvparten, som IKKE skal med.
    description: "x".repeat(3000),
    snippet: "y".repeat(3000),
    actors: [{ name: "SSB" }],
    keyFigures: ["4,2 %"],
  },
};

test("compactSignal: researchkonteksten er den tunge halvparten, og skal IKKE med", () => {
  // 100 signaler med description + snippet er titusener av tokens for et
  // spørsmål som avgjøres på tittel, kategori og to datoer.
  const kort = compactSignal(RÅ_SIGNAL);
  const serialisert = JSON.stringify(kort);
  assert.equal(kort.details, undefined);
  assert.ok(!serialisert.includes("xxx"), "description skal ikke være med");
  assert.ok(!serialisert.includes("yyy"), "snippet skal ikke være med");
  assert.ok(serialisert.length < 600, `for tungt: ${serialisert.length} tegn`);
});

test("compactSignal: kategorien er FERDIG utregnet, ikke noe leseren skal utlede", () => {
  // Kategorien krever at origin og type leses SAMTIDIG. En leser som utleder den
  // selv kan utlede den annerledes enn pluginen gjør ellers.
  assert.equal(compactSignal(RÅ_SIGNAL).kategori, "egen_oppfolging");
  assert.equal(
    compactSignal({ ...RÅ_SIGNAL, origin: null, type: "competitor_article" }).kategori,
    "konkurrentsak",
  );
  assert.equal(
    compactSignal({ ...RÅ_SIGNAL, origin: null, type: "market_signal" }).kategori,
    "temasok",
  );
  // Kategorien i vinduet må være DEN SAMME som resten av pluginen bruker.
  assert.equal(compactSignal(RÅ_SIGNAL).kategori, bucketOf(RÅ_SIGNAL));
});

test("compactSignal: de to datoene er skilt, og flatet ut av details", () => {
  const kort = compactSignal(RÅ_SIGNAL);
  assert.equal(kort.oppdaget, "2026-08-30T06:00:00Z");
  assert.equal(kort.publisert, "2026-08-29T06:00:00Z");
  assert.equal(kort.mønster, "Boligmarkedet i nord");
  assert.equal(kort.kilder, 2);
});

test("compactSignal: tomme felt BEHOLDES som null — de betyr noe her", () => {
  // Motsatt av artikkelvinduet: «mønster: null» er «radaren fant dette uten at
  // profilen forklarer hvorfor», og utelatt ville det blitt lest som at
  // spørsmålet ikke ble stilt.
  const kort = compactSignal({ id: "s2", title: "Uten noe", details: {} });
  assert.equal(kort.mønster, null);
  assert.equal(kort.publisert, null);
  assert.equal(kort.url, null);
  assert.equal(kort.kilder, 0);
  assert.deepEqual(Object.keys(kort).sort(), [...SIGNAL_WINDOW_FIELDS].sort());
});

test("signalWindowCaveat: sier ALLTID at kvitteringen ikke er rørt", () => {
  // Det er den ene opplysningen som skiller et oppslag fra et saksløp. Uten den
  // kan en leser tro at signalene nå er «sett».
  for (const filter of [{}, { hours: 24 }, { origin: "own_followup" }]) {
    assert.match(signalWindowCaveat({ vindu: 3, filter }), /Kvitteringen .* IKKE rørt/);
  }
});

test("signalWindowCaveat: et lokalt filter sier at det er lokalt, og hva som falt bort", () => {
  // API-et kan bare status/type/hours. Et lokalt filter på et avkortet vindu er
  // ikke et søk, og forveksles med et tomt datasett.
  const c = signalWindowCaveat({
    vindu: 3,
    hentet: 100,
    lokale: [{ flagg: "--origin own_followup", beskrivelse: "opphav" }],
  });
  assert.match(c, /LOKALT/);
  assert.match(c, /3 av 100/);
  assert.match(c, /hev --limit/);
});

test("signalWindowCaveat: manglende publiseringsdato er UKJENT, ikke gammelt", () => {
  // «3 ferske» ser ut som hele bildet hvis tolv falt ut på en tom dato.
  const c = signalWindowCaveat({
    vindu: 3,
    hentet: 15,
    lokale: [{ flagg: "--ferske", beskrivelse: "kjent publiseringsdato" }],
    utenDato: 12,
  });
  assert.match(c, /12 av de hentede har INGEN publiseringsdato/);
  assert.match(c, /ukjente, ikke gamle/);
});

test("signalWindowCaveat: taket nådd slår gjennom en tidsgrense", () => {
  const c = signalWindowCaveat({ vindu: 100, hentet: 100, taketNådd: true, filter: { hours: 24 } });
  assert.match(c, /TAKET ER NÅDD/);
  assert.doesNotMatch(c, /FULLSTENDIG/);
});

test("signalWindowCaveat: med tidsgrense og uten tak er svaret fullstendig", () => {
  const c = signalWindowCaveat({ vindu: 6, hentet: 6, filter: { hours: 24 } });
  assert.match(c, /FULLSTENDIG/);
});

test("renderSignalWindow: kategorien står på HVERT signal, ikke som overskrift", () => {
  // En leser som plukker signaler ut av rekkefølgen tar ikke med seg en kategori
  // som bare sto i en gruppeoverskrift lenger opp.
  const vindu = [RÅ_SIGNAL, { id: "s2", title: "Uten lenke", details: {} }].map(compactSignal);
  const out = renderSignalWindow(vindu, {
    vindu: vindu.length,
    hentet: vindu.length,
    sider: 1,
    taketNådd: false,
    felter: SIGNAL_WINDOW_FIELDS,
    kvittering: "ikke rørt",
    forbehold: signalWindowCaveat({ vindu: vindu.length, filter: {} }),
  });
  assert.match(out, /\[egen_oppfolging\]/);
  assert.match(out, /\[temasok\]/);
  assert.match(out, /id: s1/);
  // Manglende lenke og manglende dato SIES, framfor å bli tomme linjer.
  assert.match(out, /\(ingen — må vurderes på tittelen alene\)/);
  assert.match(out, /ukjent dato — IKKE «fersk»/);
  assert.match(out, /uten mønstertreff/);
});

test("renderSignalWindow: tomt etter lokalt filter er ikke «ingenting skjer»", () => {
  const out = renderSignalWindow([], {
    vindu: 0,
    hentet: 40,
    sider: 1,
    taketNådd: false,
    felter: SIGNAL_WINDOW_FIELDS,
    kvittering: "ikke rørt",
    lokaleFiltre: [{ flagg: "--origin x", beskrivelse: "opphav" }],
    forbehold: signalWindowCaveat({
      vindu: 0,
      hentet: 40,
      lokale: [{ flagg: "--origin x", beskrivelse: "opphav" }],
    }),
  });
  assert.match(out, /40 signaler ble hentet, men ingen passerte/);
  // Hvilke filtre som var i bruk må STÅ der — ellers er «ingen passerte» uten
  // informasjon om hva som stengte dem ute.
  assert.match(out, /--origin x/);
  assert.match(out, /tomt for DENNE/);
});

// ---------------------------------------------------------------------------
// Lokale filtre: det API-et ikke kan gjøre
// ---------------------------------------------------------------------------

const TIME = 3600_000;
const nå = () => new Date().toISOString();
const forDager = (d) => new Date(Date.now() - d * 24 * TIME).toISOString();

/** Fire signaler som dekker de fire kategoriene og de tre datotilstandene. */
const UTVALG = [
  {
    id: "egen",
    origin: "own_followup",
    type: "market_signal",
    url: "https://a.no",
    detectedAt: nå(),
    details: { matchedPattern: "Boligmarkedet", publishedDate: nå() },
  },
  {
    id: "konkurrentsak",
    origin: null,
    type: "competitor_article",
    url: "https://b.no",
    detectedAt: nå(),
    details: { matchedPattern: "Boligmarkedet", publishedDate: forDager(3) },
  },
  {
    // Fritt temasøk, uten mønster, GAMMEL SAK: publisert lenge før den ble funnet.
    id: "gammel",
    origin: null,
    type: "market_signal",
    url: null,
    detectedAt: nå(),
    details: { publishedDate: forDager(400) },
  },
  {
    // Uten publiseringsdato i det hele tatt.
    id: "udatert",
    origin: null,
    type: "market_signal",
    url: "https://d.no",
    detectedAt: nå(),
    details: {},
  },
];

const ider = (r) => r.kept.map((s) => s.id);

test("--kategori: konkurrentsak er ikke uttrykkbar med --origin alene", () => {
  // `--origin null` gir BÅDE konkurrentsak og temasok, fordi origin er null for
  // begge. Kategorien krever at type leses samtidig — og da skal den komme fra
  // pluginens ENE definisjon, ikke fra en leser som kombinerer to flagg riktig.
  assert.deepEqual(ider(applyLocalFilters(UTVALG, { origin: "null" })).sort(), [
    "gammel",
    "konkurrentsak",
    "udatert",
  ]);
  assert.deepEqual(ider(applyLocalFilters(UTVALG, { kategori: "konkurrentsak" })), ["konkurrentsak"]);
  assert.deepEqual(ider(applyLocalFilters(UTVALG, { kategori: "egen_oppfolging" })), ["egen"]);
  assert.ok(SIGNAL_CATEGORIES.includes("temasok"), "kategoriene er de samme som i meta.grupper");
});

test("--uten-monster: FRAVÆRET av et mønster kan ikke uttrykkes med --pattern", () => {
  // «Radaren finner noe profilen ikke forklarer» er en opplysning pluginen selv
  // fremhever, og --pattern krever en streng.
  const r = applyLocalFilters(UTVALG, { utenMønster: true });
  assert.deepEqual(ider(r).sort(), ["gammel", "udatert"]);
  assert.deepEqual(r.lokale[0].flagg, "--uten-monster");
});

test("--gamle og --ferske: ukjent dato er INGEN av dem", () => {
  assert.deepEqual(ider(applyLocalFilters(UTVALG, { gamle: true })), ["gammel"]);
  // «udatert» er ikke fersk — mangler datoen, er svaret «ukjent dato», og et
  // løfte om ferskhet ingen kan innfri er verre enn å utelate signalet.
  assert.deepEqual(ider(applyLocalFilters(UTVALG, { ferske: true })).sort(), [
    "egen",
    "konkurrentsak",
  ]);
  // Og antallet som falt ut på manglende dato SIES.
  assert.equal(applyLocalFilters(UTVALG, { ferske: true }).utenDato, 1);
});

test("--publisert måler sakens egen alder, ikke når radaren fant den", () => {
  // Alle fire er oppdaget NÅ. Skilnaden ligger bare i publiseringsdatoen, og det
  // er nettopp forskjellen --hours ikke kan uttrykke: et fritt temasøk kan levere
  // en sak fra 2023 som ble oppdaget i dag.
  assert.deepEqual(ider(applyLocalFilters(UTVALG, { publisert: 24 })), ["egen"]);
  assert.deepEqual(ider(applyLocalFilters(UTVALG, { publisert: 24 * 7 })).sort(), [
    "egen",
    "konkurrentsak",
  ]);
  assert.equal(applyLocalFilters(UTVALG, { publisert: 24 }).utenDato, 1);
});

test("--uten-lenke: et signal ingen kan åpne", () => {
  assert.deepEqual(ider(applyLocalFilters(UTVALG, { utenLenke: true })), ["gammel"]);
});

test("applyLocalFilters: flere filtre ANDes, og hvert av dem beskrives", () => {
  const r = applyLocalFilters(UTVALG, { kategori: "temasok", utenMønster: true, utenLenke: true });
  assert.deepEqual(ider(r), ["gammel"]);
  assert.equal(r.lokale.length, 3, "alle tre skal beskrives i forbeholdet");
  for (const l of r.lokale) {
    assert.ok(l.flagg.startsWith("--"), "flagget skal være gjenkjennelig");
    assert.ok(l.beskrivelse.length > 3, "og forklart, ellers sier «3 av 100» ingenting");
  }
});

test("applyLocalFilters: uten filtre passerer alt, og utenDato telles ikke", () => {
  const r = applyLocalFilters(UTVALG, {});
  assert.equal(r.kept.length, UTVALG.length);
  assert.deepEqual(r.lokale, []);
  // Tallet ville vært misvisende uten et datofilter: ingen falt ut på datoen.
  assert.equal(r.utenDato, 0);
});
