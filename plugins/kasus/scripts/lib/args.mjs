/**
 * Feil i BRUKEN av et flagg — en skrivefeil, en manglende verdi, en verdi som
 * ikke er et tall. Egen klasse framfor en tekstsjekk i inngangen: en `catch`
 * som kjenner igjen feilen på ordlyden slutter å kjenne den igjen første gang
 * noen omformulerer en melding, og da får brukeren en stack trace i stedet for
 * beskjeden om hva som må rettes.
 */
export class UsageError extends Error {}

/**
 * Minimal argument-parser for verktøyene i denne pluginen. Ingen avhengigheter —
 * pluginen kjører fra en cache-mappe i konsumentens repo og kan ikke anta at noe
 * er installert.
 *
 * Støtter `--flagg`, `--nøkkel verdi`, `--nøkkel=verdi` og posisjonelle
 * argumenter. Ukjente flagg AVVISES av `requireKnownFlags()` framfor å ignoreres
 * stille: `--limt 5` som blir borte gir et svar med feil størrelse, uten at noe
 * sier fra.
 *
 * @param {string[]} argv
 * @returns {{ flags: Record<string, string|true>, positional: string[] }}
 */
export function parseArgs(argv) {
  const flags = {};
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const body = arg.slice(2);
    const eq = body.indexOf("=");
    if (eq !== -1) {
      flags[body.slice(0, eq)] = body.slice(eq + 1);
      continue;
    }

    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags[body] = next;
      i++;
    } else {
      flags[body] = true;
    }
  }

  return { flags, positional };
}

/**
 * Kaster hvis et flagg ikke står i allowlisten.
 *
 * @param {Record<string, string|true>} flags
 * @param {string[]} known
 */
export function requireKnownFlags(flags, known) {
  const allowed = new Set(known);
  const unknown = Object.keys(flags).filter((f) => !allowed.has(f));
  if (unknown.length) {
    throw new UsageError(
      `Ukjent flagg: ${unknown.map((f) => `--${f}`).join(", ")}. Kjente flagg: ${known
        .map((f) => `--${f}`)
        .join(", ")}`,
    );
  }
}

/**
 * Leser et flagg som positivt heltall. Et flagg som er satt men ugyldig er en
 * feil, ikke en grunn til å bruke defaulten — jf. `--limit abc`.
 *
 * @param {Record<string, string|true>} flags
 * @param {string} name
 * @param {number|null} fallback
 * @returns {number|null}
 */
export function intFlag(flags, name, fallback = null) {
  const raw = flags[name];
  if (raw === undefined) return fallback;
  if (raw === true) throw new UsageError(`--${name} krever en verdi`);
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new UsageError(`--${name} må være et positivt tall, fikk «${raw}»`);
  }
  return n;
}

/**
 * Leser et flagg som av/på.
 *
 * `--flagg` uten verdi er på. En eksplisitt verdi må være entydig — `--all
 * kanskje` er en feil, ikke «av». Det gjør at et av/på-flagg som ved et uhell
 * spiser det neste ordet (`--all proposal`) SIER fra framfor å bli tolket som
 * «av» og gi et svar med feil innhold.
 *
 * @param {Record<string, string|true>} flags
 * @param {string} name
 * @returns {boolean}
 */
export function boolFlag(flags, name) {
  const raw = flags[name];
  if (raw === undefined) return false;
  if (raw === true) return true;
  const value = String(raw).toLowerCase();
  if (["true", "1", "ja", "on"].includes(value)) return true;
  if (["false", "0", "nei", "off"].includes(value)) return false;
  throw new UsageError(
    `--${name} er et av/på-flagg og tar ingen verdi, fikk «${raw}». Skriv --${name} alene.`,
  );
}

/**
 * Leser et flagg som streng.
 *
 * @param {Record<string, string|true>} flags
 * @param {string} name
 * @returns {string|null}
 */
export function stringFlag(flags, name) {
  const raw = flags[name];
  if (raw === undefined) return null;
  if (raw === true) throw new UsageError(`--${name} krever en verdi`);
  return raw;
}
