/**
 * Tekst-formatering for lesbar output. Ingen avhengigheter.
 */

/**
 * Fjerner HTML og normaliserer whitespace.
 *
 * `body` fra Labrador ER HTML, mens Sanity, WordPress og HubSpot leverer ren
 * tekst. Alt som skal LESES av et menneske eller en agent må derfor gjennom
 * denne — og den er en tekst-hjelper, ikke en del av noen vurdering.
 */
export function stripHtml(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|amp|quot|#39|laquo|raquo);/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Klipper en streng til `max` tegn og sier at den er klippet. */
export function clip(value, max = 240) {
  if (typeof value !== "string") return value;
  const flat = value.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1)}… [klippet, ${flat.length} tegn totalt]`;
}

/** `key: value`-linje, hoppet over når verdien er tom. */
export function line(label, value, indent = "  ") {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) {
    if (!value.length) return null;
    return `${indent}${label}: ${value.join(", ")}`;
  }
  return `${indent}${label}: ${value}`;
}

/** Slår sammen linjer og dropper de tomme. */
export function block(lines) {
  return lines.filter((l) => l !== null && l !== undefined).join("\n");
}

/** ISO-tid → `2026-06-24 06:00 UTC`, som er lesbart uten å skjule at det er UTC. */
export function fmtTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/**
 * «for 3 timer siden» — relativ alder, som er det man faktisk vurderer et
 * signal på.
 *
 * Grovere enheter for det gamle er ikke pynt: et fritt temasøk kan levere en
 * artikkel fra 2023, og «for 912 d siden» må regnes om i hodet før det betyr
 * noe. «for 2 år siden» avgjør prioriteringen med én gang.
 */
export function fmtAge(iso) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 0) return "i framtiden";
  if (mins < 60) return `for ${mins} min siden`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `for ${hours} t siden`;
  const days = Math.round(hours / 24);
  if (days < 60) return `for ${days} d siden`;
  if (days < 365) return `for ${Math.round(days / 30)} mnd siden`;
  const years = days / 365;
  return years < 2 ? "for over ett år siden" : `for ${Math.round(years)} år siden`;
}
