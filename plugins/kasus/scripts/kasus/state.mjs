/**
 * Kvitteringen — hva er SETT, og hva er nytt siden sist.
 *
 * Uten en kvittering finnes ikke spørsmålet «hva er nytt?». `--hours 24` er ikke
 * det samme: kjører du saksløpet kl. 08 og igjen kl. 11, viser et døgnvindu de
 * samme signalene tre ganger, og et treTIMES-vindu skjuler det som kom kl. 07.
 * Derfor lagres tidspunktet saksløpet ble gjort, per organisasjon, på disk i
 * brukerens eget repo.
 *
 * To ting gjør kvitteringen etterprøvbar framfor magisk:
 *
 * 1. **Bare `kvitter` skriver.** `nytt` leser. En oversikt som stilltiende
 *    flyttet kvitteringen ville betydd at et avbrutt kall — eller en lukket
 *    terminal — mistet en hel dags signaler uten at noe sa fra.
 *
 * 2. **Etterslep-vinduet.** Et signal kan bli indeksert etter at det ble
 *    oppdaget, så en kvittering på klokkeslettet alene mister det som kommer
 *    inn med en `detectedAt` litt bakover i tid. `nytt` ser derfor
 *    `LAG_HOURS` bakover FORBI kvitteringen, og undertrykker det som alt er
 *    vist via `seenIds`. Overlappen er usynlig for brukeren, og gjør at et
 *    sent-ankommet signal fortsatt blir sett.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";

import { readEnvValue } from "../lib/env.mjs";
import { ConfigError, hostOf } from "./targets.mjs";

/** Stien kvitteringen ligger på når ingen variabel er satt. Relativ til cwd. */
export const DEFAULT_STATE_FILE = ".claude/kasus-state.json";

/** Formatversjon. En ukjent versjon stopper framfor å bli tolket på gjett. */
export const STATE_VERSION = 1;

/**
 * Hvor mange id-er som huskes per organisasjon. Nok til flere saksløp tilbake,
 * så etterslep-vinduet aldri viser det samme signalet to ganger, og lite nok
 * til at fila forblir noen kilobyte.
 */
export const MAX_SEEN_IDS = 300;

/**
 * Etterslepet `nytt` ser bakover forbi kvitteringen. To timer er valgt for å
 * dekke indekseringsforsinkelse i pipelinen uten å hente et helt døgn hver gang.
 */
export const LAG_HOURS = 2;

/** Vinduet når det ikke finnes en kvittering ennå. SIES alltid når det brukes. */
export const FIRST_RUN_HOURS = 24;

/**
 * Strømmen som har et kvitteringstidspunkt.
 *
 * Én strøm, fordi pluginen gjør én ting: radarsignaler. Formen er beholdt som en
 * liste framfor et enkelt felt fordi kvitteringsfila på disk er versjonert — et
 * felt som byttet form ville krevd en migrering av noe som ligger i brukerens
 * repo, og den prisen er ikke verdt å betale for én mindre nøkkel i en JSON.
 */
export const STREAMS = ["signals"];

/**
 * Hvor kvitteringen ligger, og hvorfor der.
 *
 * `KASUS_STATE_FILE` kan peke et annet sted — f.eks. utenfor repoet, hvis flere
 * prosjekter deler én saksløp. Relativ sti tolkes fra cwd, ikke fra pluginmappa:
 * pluginen bor i en cache-mappe brukeren ikke ser, og en kvittering der ville
 * vært umulig å finne igjen.
 *
 * @param {{ env?: string|null, source?: Record<string,string|undefined>, cwd?: string }} [opts]
 * @returns {{ path: string, source: string }}
 */
export function resolveStatePath({ env = null, source = process.env, cwd = process.cwd() } = {}) {
  const found = readEnvValue("KASUS_STATE_FILE", env, source);
  const raw = found.value ?? DEFAULT_STATE_FILE;
  return {
    path: isAbsolute(raw) ? raw : join(cwd, raw),
    source: found.source ?? `default (${DEFAULT_STATE_FILE})`,
  };
}

/**
 * Nøkkelen én organisasjons kvittering ligger under.
 *
 * Fingeravtrykket av API-nøkkelen er med fordi NØKKELEN avgjør organisasjonen:
 * to redaksjoner i samme repo, eller en byttet nøkkel, skal ikke arve hverandres
 * «siden sist». Verten og miljøet alene holder ikke.
 *
 * @param {{ baseUrl: string, env: string|null, apiKey: string }} target
 */
export function targetKey(target) {
  return [hostOf(target.baseUrl), target.env ?? "-", fingerprint(target.apiKey)].join("|");
}

/**
 * SHA-256 av nøkkelen, forkortet.
 *
 * Dette er ikke en credential og kan ikke brukes til å autentisere — det er en
 * enveis-sjekksum som bare skiller to nøkler fra hverandre. Nøkkelen selv havner
 * aldri i fila, og fingeravtrykket skrives aldri ut i output.
 *
 * @param {string} apiKey
 */
export function fingerprint(apiKey) {
  return createHash("sha256").update(String(apiKey)).digest("hex").slice(0, 12);
}

/** Tom kvitteringsfil. */
const emptyState = () => ({ version: STATE_VERSION, targets: {} });

/**
 * Leser kvitteringsfila.
 *
 * En fil som ikke finnes er ikke en feil — det er første saksløp. En fil som
 * finnes men er ØDELAGT er en feil: en stille nullstilling ville svart
 * «ingenting nytt siden sist» om en hel dags signaler. `kvitter --reset` er veien
 * videre, og den tolererer en ødelagt fil (`onCorrupt: "empty"`).
 *
 * @param {string} path
 * @param {{ onCorrupt?: "throw"|"empty" }} [opts]
 * @returns {{ state: object, existed: boolean, corrupt: boolean }}
 */
export function readState(path, { onCorrupt = "throw" } = {}) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    if (err?.code === "ENOENT") return { state: emptyState(), existed: false, corrupt: false };
    throw new ConfigError(
      `MANGLER: kunne ikke lese kvitteringsfila ${path}: ${err.message}. ` +
        `Sett KASUS_STATE_FILE til en sti du kan skrive til.`,
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    if (onCorrupt === "empty") return { state: emptyState(), existed: true, corrupt: true };
    throw new ConfigError(
      `MANGLER: kvitteringsfila ${path} er ikke gyldig JSON. Den nullstilles IKKE ` +
        `automatisk — en stille nullstilling ville svart «ingenting nytt» om en hel ` +
        `dags signaler. Kjør «kvitter --reset», eller slett fila.`,
    );
  }

  if (parsed?.version !== STATE_VERSION) {
    if (onCorrupt === "empty") return { state: emptyState(), existed: true, corrupt: true };
    throw new ConfigError(
      `MANGLER: kvitteringsfila ${path} har versjon «${parsed?.version}», og denne ` +
        `pluginen leser versjon ${STATE_VERSION}. Den er skrevet av en annen versjon — ` +
        `kjør «kvitter --reset» for å begynne på nytt.`,
    );
  }

  return {
    state: { version: STATE_VERSION, targets: parsed.targets ?? {} },
    existed: true,
    corrupt: false,
  };
}

/**
 * Kvitteringen for én organisasjon. Tomme verdier når det ikke finnes noen.
 *
 * @param {object} state
 * @param {string} key
 * @returns {{ checkpoints: Record<string, string|null>, seenIds: string[], updatedAt: string|null }}
 */
export function entryFor(state, key) {
  const entry = state?.targets?.[key] ?? {};
  const checkpoints = {};
  for (const stream of STREAMS) {
    const value = entry.checkpoints?.[stream];
    checkpoints[stream] = typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
  }
  return {
    checkpoints,
    seenIds: Array.isArray(entry.seenIds) ? entry.seenIds.filter((id) => typeof id === "string") : [],
    updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : null,
  };
}

/**
 * Vinduet en strøm skal hentes for.
 *
 * `hours` er det API-et får (det filtrerer serverside), `from` er det verktøyet
 * filtrerer eksakt på lokalt. De er ikke like: `hours` rundes OPP, fordi et
 * vindu som rundes ned mister signaler i kanten.
 *
 * @param {{ checkpoint: string|null, now?: number, override?: number|null }} opts
 * @returns {{ from: number, hours: number, basis: "kvittering"|"første saksløp"|"overstyrt" }}
 */
export function windowFor({ checkpoint, now = Date.now(), override = null }) {
  if (override) {
    return { from: now - override * 3600_000, hours: override, basis: "overstyrt" };
  }
  if (!checkpoint) {
    return { from: now - FIRST_RUN_HOURS * 3600_000, hours: FIRST_RUN_HOURS, basis: "første saksløp" };
  }
  const from = Date.parse(checkpoint) - LAG_HOURS * 3600_000;
  const hours = Math.max(1, Math.ceil((now - from) / 3600_000));
  return { from, hours, basis: "kvittering" };
}

/**
 * Er dette elementet nytt for brukeren?
 *
 * To grunner til at noe IKKE er nytt, og de må skilles i rapporten: det er for
 * gammelt for vinduet, eller det er alt kvittert for. Det andre er hele grunnen
 * til at etterslep-vinduet kan overlappe uten å bli støy.
 *
 * @param {{ id?: string }} item
 * @param {string|null|undefined} timestamp
 * @param {{ from: number, seenIds: Set<string> }} ctx
 * @returns {"ny"|"alt sett"|"utenfor vinduet"|"uten tidspunkt"}
 */
export function classify(item, timestamp, { from, seenIds }) {
  if (item?.id && seenIds.has(item.id)) return "alt sett";
  const ts = timestamp ? Date.parse(timestamp) : NaN;
  // Et element uten brukbart tidspunkt VISES framfor å forsvinne: en utelatelse
  // her er et signal ingen får se, og det er den dyre feilen av de to.
  if (Number.isNaN(ts)) return "uten tidspunkt";
  return ts >= from ? "ny" : "utenfor vinduet";
}

/**
 * Setter kvitteringen for begge strømmer, og legger id-ene til de sette.
 *
 * Id-ene lagres i ÉN liste per organisasjon, ikke per strøm: id-ene er unike på
 * tvers, så en oppdeling ville bare gjort taket vanskeligere å regne på.
 *
 * `at: null` betyr «behold tidspunktet». Det er ikke det samme som å kvittere
 * for nå: da regnes bare de oppgitte id-ene som sett, og alt annet som kom inn i
 * mellomtiden er fortsatt nytt neste saksløp. Det er den trygge kvitteringen når
 * saksløpet bare rakk noen av sakene.
 *
 * @param {object} state
 * @param {{ key: string, host: string, env: string|null, at: string|null, ids?: string[] }} opts
 * @returns {object} ny state (input mutéres ikke)
 */
export function ack(state, { key, host, env, at, ids = [] }) {
  const previous = entryFor(state, key);
  const seen = [...previous.seenIds, ...ids.filter((id) => typeof id === "string" && id.trim())];
  const unique = [...new Set(seen)];

  const checkpoints = {};
  for (const stream of STREAMS) checkpoints[stream] = at ?? previous.checkpoints[stream];

  return {
    version: STATE_VERSION,
    targets: {
      ...state.targets,
      [key]: {
        host,
        env,
        updatedAt: new Date().toISOString(),
        checkpoints,
        // Nyeste sist, og taket kutter de eldste — de er de som er lengst
        // utenfor etterslep-vinduet og dermed ikke kan komme tilbake som støy.
        seenIds: unique.slice(-MAX_SEEN_IDS),
      },
    },
  };
}

/**
 * Fjerner én organisasjons kvittering. Returnerer også om det var noe å fjerne,
 * så `--reset` kan si «det fantes ingen» framfor «nullstilt».
 *
 * @param {object} state
 * @param {string} key
 * @returns {{ state: object, removed: boolean }}
 */
export function clearTarget(state, key) {
  const targets = { ...state.targets };
  const removed = Object.hasOwn(targets, key);
  delete targets[key];
  return { state: { version: STATE_VERSION, targets }, removed };
}

/**
 * Skriver kvitteringen atomisk: til en temp-fil i samme mappe, og deretter
 * `rename`. Et avbrutt skriv skal ikke etterlate en halv JSON-fil — den ville
 * stoppet neste saksløp med «ikke gyldig JSON».
 *
 * @param {string} path
 * @param {object} state
 * @returns {string} stien som ble skrevet
 */
export function writeState(path, state) {
  const dir = dirname(path);
  try {
    mkdirSync(dir, { recursive: true });
  } catch (err) {
    throw new ConfigError(`MANGLER: kunne ikke opprette mappa ${dir}: ${err.message}`);
  }

  const tmp = `${path}.tmp-${process.pid}`;
  try {
    writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    renameSync(tmp, path);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw new ConfigError(
      `MANGLER: kunne ikke skrive kvitteringen til ${path}: ${err.message}. ` +
        `Sett KASUS_STATE_FILE til en sti du kan skrive til.`,
    );
  }
  return path;
}

/**
 * Normaliserer et tidspunkt fra `--at` til ISO.
 *
 * En kvittering fram i tid er avvist framfor godtatt: den ville gjort at ALT er
 * «sett» til klokka tar den igjen, og en tastefeil i årstallet ville dermed
 * slått av saksløpet i stillhet.
 *
 * @param {string} raw
 * @param {number} [now]
 * @returns {string} ISO-tid
 */
export function normalizeAt(raw, now = Date.now()) {
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) {
    throw new ConfigError(
      `MANGLER: «${raw}» er ikke et tidspunkt jeg kan lese. Bruk ISO-format, ` +
        `f.eks. 2026-08-31T09:00:00Z.`,
    );
  }
  if (ms > now + 60_000) {
    throw new ConfigError(
      `MANGLER: kvitteringstidspunktet ${new Date(ms).toISOString()} ligger fram i tid. ` +
        `Da ville alt vært «sett» til klokka tar det igjen — sjekk årstallet.`,
    );
  }
  return new Date(ms).toISOString();
}
