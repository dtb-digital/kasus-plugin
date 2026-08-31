/**
 * Miljønavn → suffiks i variabelnavn. ÉN definisjon for hele JS-siden.
 *
 * Motstykket i shell er `env_suffix()` i `lib/env.sh`. To språk kan ikke dele én
 * funksjon uten et byggesteg, så `self-test.sh` sammenligner dem i stedet — de
 * kan ikke drifte fra hverandre uten at den testen blir rød. Regelen er
 * `a-z-` → `A-Z_`, fordi shell-varianten er den eneste som kan settes fra et
 * skall: `export KASUS_API_KEY_PRE-PROD=…` er en syntaksfeil.
 *
 * @param {string} env  Miljønavn, f.eks. "staging" eller "pre-prod".
 * @returns {string}    Suffiks, f.eks. "STAGING" eller "PRE_PROD".
 */
export const envSuffix = (env) => env.trim().toUpperCase().replace(/-/g, "_");

/**
 * Variabelnavn for et miljø: `envVar("KASUS_API_KEY", "pre-prod")` →
 * `KASUS_API_KEY_PRE_PROD`. Brukes der navnet også skal VISES i en feilmelding,
 * så meldingen alltid nevner navnet verktøyet faktisk leste.
 *
 * @param {string} base
 * @param {string} env
 * @returns {string}
 */
export const envVar = (base, env) => `${base}_${envSuffix(env)}`;

/**
 * Leser en verdi med per-miljø-presedens: `<BASE>_<ENV>` vinner over `<BASE>`.
 * Returnerer også HVOR verdien kom fra, fordi et svar som ikke sier hvilken
 * variabel som ble lest ikke er etterprøvbart — og fordi et tomt per-miljø-navn
 * ellers ikke er til å skille fra et som ikke ble forsøkt.
 *
 * @param {string} base           Variabelnavn uten suffiks.
 * @param {string|null} env       Miljønavn, eller null for kun den delte varianten.
 * @param {Record<string,string|undefined>} [source]  Env-kilden (default process.env).
 * @returns {{ value: string|null, source: string|null, tried: string[] }}
 */
export function readEnvValue(base, env, source = process.env) {
  const tried = [];
  if (env) tried.push(envVar(base, env));
  tried.push(base);

  for (const name of tried) {
    const raw = source[name];
    if (typeof raw === "string" && raw.trim() !== "") {
      return { value: raw.trim(), source: name, tried };
    }
  }

  return { value: null, source: null, tried };
}
