/**
 * HTTP-laget mot Kasus' offentlige API.
 *
 * Read-only i to lag: API-et HAR ingen skrivende ruter (`/api/v1` er
 * dokumentert read-only), og dette verktøyet har ingen kodesti for annet enn
 * GET — metoden er ikke en parameter noe sted. Det er også hele sannheten om
 * garden: nøkkelen din kan ikke skrive gjennom dette API-et i det hele tatt, så
 * her trengs ingen transaksjonsmodus eller SQL-inspeksjon som på et databaselag.
 *
 * Feil er SYNLIGE og oversatt til hva du skal gjøre. En 401 fra en org-scopet
 * nøkkel og en 404 på en id som tilhører en annen organisasjon ser like «tomme»
 * ut i rå JSON, men krever helt ulike tiltak.
 */

import { redact } from "./redact.mjs";
import { ConfigError, hostOf } from "./targets.mjs";

/** Feil som skal skrives ut uten stack trace. */
export class ApiError extends Error {}

/**
 * Ett GET-kall mot API-et.
 *
 * @param {ReturnType<import("./targets.mjs").resolveTarget>} target
 * @param {string} path            f.eks. "/api/v1/signals"
 * @param {Record<string, string|number|undefined|null>} [query]
 * @returns {Promise<unknown>}     Maskert JSON-body.
 */
export async function apiGet(target, path, query = {}) {
  const url = new URL(path, `${target.baseUrl}/`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  let res;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${target.apiKey}`,
        Accept: "application/json",
        "User-Agent": "kasus-claude-plugin",
      },
      signal: AbortSignal.timeout(target.timeoutMs),
    });
  } catch (err) {
    const reason = err?.name === "TimeoutError" ? `tidsavbrudd etter ${target.timeoutMs} ms` : err?.message;
    throw new ApiError(
      `Fikk ikke kontakt med ${hostOf(target.baseUrl)}: ${reason}. ` +
        `Sjekk base-URL-en (${target.baseUrlSource}) og at du er på nett.`,
    );
  }

  if (!res.ok) throw await describeHttpError(res, target, url);

  let body;
  try {
    body = await res.json();
  } catch {
    throw new ApiError(
      `${hostOf(target.baseUrl)} svarte 200, men ikke med JSON. Peker base-URL-en ` +
        `(${target.baseUrlSource}) på en Kasus-installasjon?`,
    );
  }

  return redact(body);
}

/**
 * Oversetter en HTTP-feil til et tiltak. Nøkkelen nevnes ved VARIABELNAVN, aldri
 * ved verdi.
 */
async function describeHttpError(res, target, url) {
  const detail = await readErrorMessage(res);
  const where = `${res.status} fra ${hostOf(target.baseUrl)}${url.pathname}`;

  if (res.status === 401) {
    return new ApiError(
      `${where}: nøkkelen ble avvist. Den kan være tilbakekalt, utløpt eller ` +
        `høre til en annen installasjon. Sjekk verdien i ${target.apiKeySource} mot ` +
        `Kasus → Innstillinger → API-nøkler.${detail}`,
    );
  }
  if (res.status === 404) {
    return new ApiError(
      `${where}: finnes ikke — ELLER tilhører en annen organisasjon. API-et er ` +
        `org-scopet av nøkkelen (${target.apiKeySource}), så en id fra en annen ` +
        `organisasjon er ikke til å skille fra en slettet id.${detail}`,
    );
  }
  if (res.status === 400) {
    return new ApiError(`${where}: ugyldig forespørsel.${detail}`);
  }
  if (res.status === 429) {
    return new ApiError(`${where}: for mange forespørsler. Vent litt og prøv igjen.${detail}`);
  }
  return new ApiError(`${where}: ${res.statusText || "ukjent feil"}.${detail}`);
}

async function readErrorMessage(res) {
  try {
    const body = await res.json();
    const msg = body?.error ?? body?.message;
    return msg ? ` Svar: «${msg}».` : "";
  } catch {
    return "";
  }
}

/**
 * Paginerer et listeendepunkt til `max` elementer er hentet, eller til
 * `nextCursor` er null.
 *
 * Taket SIES i returverdien framfor å bli stille: en liste som stopper på 100
 * uten å nevne det leses som «det finnes bare 100».
 *
 * @param {ReturnType<import("./targets.mjs").resolveTarget>} target
 * @param {string} path
 * @param {Record<string, string|number|undefined|null>} query
 * @param {number} max
 * @returns {Promise<{ items: unknown[], truncated: boolean, pages: number }>}
 */
export async function apiList(target, path, query, max) {
  const items = [];
  let cursor = null;
  let pages = 0;

  do {
    const perPage = Math.min(100, Math.max(1, max - items.length));
    const body = await apiGet(target, path, { ...query, limit: perPage, cursor });
    pages++;

    const data = Array.isArray(body?.data) ? body.data : [];
    items.push(...data);
    cursor = body?.nextCursor ?? null;

    if (!data.length) break;
  } while (cursor && items.length < max);

  return { items, truncated: Boolean(cursor) && items.length >= max, pages };
}

export { ConfigError };
