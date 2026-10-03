/**
 * Hvilken Kasus-installasjon og hvilken organisasjon kvitteringen gjelder.
 *
 * Pluginen henter ingenting selv: all data kommer fra Kasus' MCP-server, som
 * Claude Code kobler til via `.mcp.json` i pluginroten. Det eneste dette
 * scriptet trenger å vite om serveren er HVOR den er — så kvitteringen for
 * staging ikke blandes med produksjon — og hvilken organisasjon tilkoblingen er
 * bundet til, som modellen leser fra `get_organization` og sender med som
 * `--org`.
 *
 * Adressen leses fra SAMME variabel som `.mcp.json` bruker, med samme default.
 * Står de to steder med ulik default, gjelder kvitteringen en annen installasjon
 * enn den dataene kom fra — `/kasus:test` sjekker at de er like.
 */

/** Default i `.mcp.json`: `${KASUS_MCP_URL:-https://app.kasus.io/api/mcp}`. */
export const DEFAULT_MCP_URL = "https://app.kasus.io/api/mcp";

/** Feil som skal skrives ut som `MANGLER: …` uten stack trace. */
export class ConfigError extends Error {}

/**
 * MCP-adressen, og hvor den kom fra.
 *
 * @param {Record<string, string|undefined>} [source]
 * @returns {{ url: string, source: string }}
 */
export function resolveMcpUrl(source = process.env) {
  const raw = source.KASUS_MCP_URL?.trim();
  const url = raw || DEFAULT_MCP_URL;
  if (!/^https?:\/\//i.test(url)) {
    throw new ConfigError(
      `MANGLER: gyldig MCP-adresse. KASUS_MCP_URL er «${url}» — den må starte med http:// eller https://.`,
    );
  }
  return { url, source: raw ? "KASUS_MCP_URL" : `default (${hostOf(DEFAULT_MCP_URL)})` };
}

/** Verten alene — det er den som sier hvilken installasjon du treffer. */
export function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * Organisasjonens slug, slik `get_organization` oppgir den.
 *
 * Påkrevd framfor gjettet: tilkoblingen er bundet til ÉN organisasjon ved
 * innlogging, og en kvittering uten organisasjon ville blitt delt av to
 * redaksjoner som bruker samme repo — eller arvet av en ny tilkobling til en
 * annen organisasjon.
 *
 * @param {string|null} org
 * @returns {string}
 */
export function requireOrg(org) {
  if (!org) {
    throw new ConfigError(
      "MANGLER: --org <slug>. Hent slugen med MCP-verktøyet get_organization " +
        "(organization.slug) og send den med — kvitteringen gjelder én organisasjon.",
    );
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(org)) {
    throw new ConfigError(`MANGLER: «${org}» ser ikke ut som en organisasjons-slug fra get_organization.`);
  }
  return org;
}
