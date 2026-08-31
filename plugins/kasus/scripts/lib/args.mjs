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
    throw new Error(
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
  if (raw === true) throw new Error(`--${name} krever en verdi`);
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`--${name} må være et positivt tall, fikk «${raw}»`);
  }
  return n;
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
  if (raw === true) throw new Error(`--${name} krever en verdi`);
  return raw;
}
