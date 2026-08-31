/**
 * Mål-oppløsning: hvilken Kasus-installasjon treffer et kall, og hvor kom
 * nøkkelen fra?
 *
 * ÉN definisjon av presedensen for hele JS-siden. `/kasus:env --resolve` leser
 * den samme funksjonen, så svaret der er det samme som verktøyet faktisk gjør —
 * en kjede som finnes to steder har driftet før.
 *
 * Presedens (per variabel, uavhengig av hverandre):
 *   1. `<BASE>_<ENV>`   — f.eks. KASUS_API_KEY_STAGING
 *   2. `<BASE>`         — f.eks. KASUS_API_KEY
 *
 * Uten `--env` leses kun den delte varianten.
 */

import { readEnvValue, envVar } from "../lib/env.mjs";

/**
 * Base-URL-en som brukes når ingen variabel er satt.
 *
 * Dette er den ENESTE defaultede verdien i pluginen, og unntaket følger av
 * regelen mot gjettede mål framfor å bryte den: `https://app.kasus.io` er ikke
 * gjettet, det er den dokumenterte produksjonsadressen til produktet
 * (`docs/signals-api-README.md`). En egen installasjon eller staging må settes
 * eksplisitt. Kilden rapporteres alltid som `default (app.kasus.io)` framfor et
 * variabelnavn, så det er synlig at ingen konfigurasjon lå bak.
 */
export const DEFAULT_BASE_URL = "https://app.kasus.io";

/** Feil som skal skrives ut som `MANGLER: …` uten stack trace. */
export class ConfigError extends Error {}

/**
 * Løser opp målet for et kall.
 *
 * @param {{ env?: string|null, source?: Record<string,string|undefined> }} opts
 * @returns {{
 *   env: string|null,
 *   baseUrl: string,
 *   baseUrlSource: string,
 *   apiKey: string,
 *   apiKeySource: string,
 *   timeoutMs: number,
 * }}
 */
export function resolveTarget({ env = null, source = process.env } = {}) {
  const key = readEnvValue("KASUS_API_KEY", env, source);
  if (!key.value) {
    throw new ConfigError(
      `MANGLER: API-nøkkel. Sett ${key.tried.join(" eller ")} til en nøkkel fra ` +
        `Kasus → Innstillinger → API-nøkler (formatet er kasus_sk_…).`,
    );
  }

  const base = readEnvValue("KASUS_BASE_URL", env, source);
  const baseUrl = base.value ?? DEFAULT_BASE_URL;
  const baseUrlSource = base.source ?? `default (${hostOf(DEFAULT_BASE_URL)})`;

  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new ConfigError(
      `MANGLER: gyldig base-URL. ${base.source} er «${baseUrl}» — den må starte med http:// eller https://.`,
    );
  }

  const timeout = readEnvValue("KASUS_TIMEOUT_MS", env, source);
  const timeoutMs = timeout.value ? Number(timeout.value) : 30000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new ConfigError(
      `MANGLER: gyldig timeout. ${timeout.source} er «${timeout.value}» — må være et positivt tall (millisekunder).`,
    );
  }

  return {
    env,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    baseUrlSource,
    apiKey: key.value,
    apiKeySource: key.source,
    timeoutMs,
  };
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
 * Header-linja som står øverst i HVER kjøring.
 *
 * Nøkkelen ekkoes aldri — kun `(satt)` og variabelnavnet den kom fra. Et svar
 * som ikke sier hvilken installasjon og hvilken nøkkel det gjelder er ikke
 * etterprøvbart: API-et er org-scopet av nøkkelen, så «0 signaler» betyr «tomt
 * for DENNE organisasjonen», ikke «tomt i Kasus».
 *
 * @param {ReturnType<typeof resolveTarget>} target
 */
export function headerLine(target) {
  const parts = [
    `Kasus: ${hostOf(target.baseUrl)} (${target.baseUrlSource})`,
    `nøkkel: (satt) fra ${target.apiKeySource}`,
  ];
  if (target.env) parts.push(`miljø: ${target.env}`);
  parts.push("read-only");
  return parts.join(" · ");
}

/** Variabelnavnene for et miljø — brukes av `/kasus:env`. */
export function variableNames(env) {
  const names = (base) => (env ? [envVar(base, env), base] : [base]);
  return {
    apiKey: names("KASUS_API_KEY"),
    baseUrl: names("KASUS_BASE_URL"),
    timeout: names("KASUS_TIMEOUT_MS"),
  };
}
