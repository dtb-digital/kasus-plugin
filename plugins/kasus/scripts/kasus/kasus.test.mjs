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
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

import { envSuffix, envVar, readEnvValue } from "../lib/env.mjs";
import { intFlag, parseArgs, requireKnownFlags } from "../lib/args.mjs";
import { clip, fmtAge } from "../lib/table.mjs";
import { isSecretKey, redact } from "./redact.mjs";
import { ConfigError, DEFAULT_BASE_URL, headerLine, resolveTarget, variableNames } from "./targets.mjs";
import { apiGet, apiList, ApiError } from "./api.mjs";
import { describeOrigin } from "./render.mjs";

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
