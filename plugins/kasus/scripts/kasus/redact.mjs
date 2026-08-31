/**
 * Maskering av hemmelig-navngitte nøkler, i DYBDEN.
 *
 * API-et er allerede kuratert på serversiden (`apps/frontend/lib/*-dto.ts`
 * utelater interne felt), så dette laget er en gard, ikke hovedforsvaret. Den
 * finnes fordi `details` og `sources` er ÅPNE JSON-objekter satt sammen av
 * `metadata` + `agentContext`: hva som havner der bestemmes av pipelinen, ikke
 * av en type i denne pluginen. En ny nøkkel som heter `apiKey` på nivå tre skal
 * ikke bli synlig i en artikkelresearch bare fordi ingen tenkte på den.
 *
 * Maskerer på NAVN, ikke på verdi — en verdi-heuristikk («ser ut som et token»)
 * treffer også legitime sitater og ID-er.
 */

/** Nøkkelnavn som maskeres uansett hvor dypt de ligger. */
const SECRET_KEY_PATTERN =
  /(^|[_\-.])(api[_\-.]?key|secret|password|passwd|token|authorization|auth[_\-.]?header|cookie|credential|private[_\-.]?key|access[_\-.]?key|bearer)($|[_\-.])/i;

/** Maks nesting før vi klipper. Dypere enn dette er ikke redaksjonelt innhold. */
const MAX_DEPTH = 8;

/**
 * camelCase-grensen er en ordgrense her. Uten dette normaliseringssteget slipper
 * `clientSecret` og `accessToken` gjennom mens `client_secret` fanges — samme
 * hemmelighet, ulikt skrivesett, og pipelinen bruker begge.
 */
const normalizeKey = (key) => String(key).replace(/([a-z0-9])([A-Z])/g, "$1_$2");

export function isSecretKey(key) {
  return SECRET_KEY_PATTERN.test(normalizeKey(key));
}

/**
 * Returnerer en kopi der hemmelig-navngitte nøkler er erstattet med
 * `"[maskert]"`. Strukturen beholdes, så det er synlig AT noe ble maskert.
 *
 * @param {unknown} value
 * @param {number} [depth]
 * @returns {unknown}
 */
export function redact(value, depth = 0) {
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return "[klippet: for dyp nesting]";

  if (Array.isArray(value)) {
    return value.map((v) => redact(v, depth + 1));
  }

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = isSecretKey(key) ? "[maskert]" : redact(val, depth + 1);
  }
  return out;
}
