/**
 * Lesbar rendering av API-svarene.
 *
 * Rå JSON er riktig for en maskin og upraktisk for et menneske og for en agent
 * som skal VELGE noe: 40 signaler i JSON er 3000 linjer der tittel, opphav og
 * alder — de tre feltene man faktisk sorterer på — ligger spredt. Derfor er
 * default lesbart, og `--json` finnes for når hele teksten skal videre.
 *
 * Menneskelig output KLIPPER lange tekstfelt; `--json` gjør det ikke. Det er
 * bevisst: et artikkelutkast trenger hele `plot` og `angle`, mens en liste
 * trenger å være mulig å skumme.
 */

import { block, clip, fmtAge, fmtTime, line } from "../lib/table.mjs";

/** Menneskelesbar forklaring av `origin` på et signal. */
const ORIGIN_LABELS = {
  competitor_followup: "oppfølging av konkurrentsak (konkurrentenes egne domener utelatt)",
  own_followup: "oppfølging av EGEN fersk sak (egne domener utelatt)",
};

/**
 * `origin` er `null` for både frie temasøk og konkurrent-forsider. Teksten må
 * derfor si HVILKEN av dem det er, ellers leses de som samme sak.
 */
export function describeOrigin(signal) {
  if (signal.origin) {
    return ORIGIN_LABELS[signal.origin] ?? `${signal.origin} (ukjent opphav for denne versjonen)`;
  }
  if (signal.type === "competitor_article") return "overvåket konkurrent-forside";
  return "fritt temasøk (varierer mest i relevans)";
}

export function renderSignal(signal, { full = false } = {}) {
  const max = full ? 1200 : 200;
  const details = signal.details ?? {};

  return block([
    `[${signal.status}] ${signal.title}`,
    line("id", signal.id),
    line("type", signal.type),
    line("opphav", describeOrigin(signal)),
    line("kilde", signal.sourceLabel),
    line("url", signal.url),
    line("oppdaget", [fmtTime(signal.detectedAt), fmtAge(signal.detectedAt)].filter(Boolean).join(" · ")),
    line("mønster", details.matchedPattern),
    line("publisert", fmtTime(details.publishedDate)),
    line("forfatter", details.author),
    line("seksjon", details.section),
    line("stikkord", details.tags),
    line("betalingsmur", details.paywall === undefined ? null : details.paywall ? "ja" : "nei"),
    line("sammendrag", clip(signal.summary, max)),
    full ? line("beskrivelse", clip(details.description, max)) : null,
    full ? line("utdrag", clip(details.snippet, max)) : null,
    full ? line("aktører", renderActors(details.actors)) : null,
    full ? line("nøkkeltall", details.keyFigures) : null,
    full ? renderSources(signal.sources) : renderSourceCount(signal.sources),
  ]);
}

export function renderBrief(brief, { full = false } = {}) {
  const max = full ? 2000 : 240;
  const eng = brief.engagement ?? {};

  return block([
    `[${brief.status}] ${brief.title ?? "(uten tittel)"}`,
    line("id", brief.id),
    line("opphav", brief.origin),
    line("opprettet", [fmtTime(brief.createdAt), fmtAge(brief.createdAt)].filter(Boolean).join(" · ")),
    line("mønster", brief.matchedPattern),
    line(
      "konvertering",
      brief.conversionPotential
        ? [brief.conversionPotential, full ? clip(brief.conversionReason, max) : null]
            .filter(Boolean)
            .join(" — ")
        : null,
    ),
    line("plot", clip(brief.plot, max)),
    line("vinkling", clip(brief.angle, max)),
    full ? line("begrunnelse", clip(brief.reason, max)) : null,
    full ? line("innsikt", brief.insightTitle) : null,
    full ? line("innsikt-beskrivelse", clip(brief.insightDescription, max)) : null,
    full ? line("sentrale aktører", eng.keyActors) : null,
    full ? line("aktører", renderActors(eng.actors)) : null,
    full ? line("nøkkeltall", eng.keyFigures) : null,
    full ? line("åpne spørsmål", eng.openQuestions) : null,
    line("kilde-url", brief.sourceUrl),
    full ? renderSources(brief.sources) : renderSourceCount(brief.sources),
  ]);
}

export function renderProfile(profile) {
  const org = profile.organization ?? {};
  const ed = profile.editorial ?? {};
  const criteria = profile.criteria;
  const searches = profile.radarSearches ?? [];

  const parts = [
    `${org.name ?? "(ukjent organisasjon)"}${org.slug ? ` (${org.slug})` : ""}`,
    line("nettsted", org.siteUrl),
    line("profil sist endret", fmtTime(ed.updatedAt)),
    "",
    "REDAKSJONSPROFIL",
    line("Redaksjonelle mål", ed.goals ?? "(ikke fylt ut)"),
    line("Målgruppe", ed.targetAudience ?? "(ikke fylt ut)"),
    line("Profil", ed.editorialProfile ?? "(ikke fylt ut)"),
    line("Nøkkelord", ed.keywords?.length ? ed.keywords : "(ingen)"),
  ];

  parts.push("", "REDAKSJONELLE MØNSTRE");
  if (!criteria) {
    parts.push(
      "  (ingen — innholdspipelinen har ikke kjørt for denne organisasjonen ennå)",
    );
  } else {
    parts.push(
      `  versjon ${criteria.version}, laget ${fmtTime(criteria.createdAt)}`,
    );
    if (!criteria.patterns?.length) {
      parts.push("  (versjonen har ingen mønstre)");
    }
    for (const p of criteria.patterns ?? []) {
      parts.push(
        "",
        `  ▸ ${p.name ?? p.id ?? "(uten navn)"}`,
        line("segment", p.audience, "    "),
        line("nøkkeltall", (p.keyStats ?? []).map((s) => `${s.label}: ${s.value}`), "    "),
        line("fungerer", p.whatWorks, "    "),
        line("unngå", p.whatToAvoid, "    "),
        line("oppfølging", p.followUpPotential, "    "),
      );
    }
    const ins = criteria.insights;
    if (ins) {
      parts.push(
        "",
        "  INNSIKTER",
        line("segmenter", clip(ins.segmentInsights, 600), "    "),
        line("forfattere", clip(ins.authorPatterns, 600), "    "),
        line("muligheter", clip(ins.editorialOpportunities, 600), "    "),
        line("hull", clip(ins.contentGaps, 600), "    "),
        line("koblinger", clip(ins.crossConnections, 600), "    "),
      );
    }
  }

  parts.push("", `RADAR-SØK (${searches.length})`);
  if (!searches.length) parts.push("  (ingen radar-søk satt opp)");
  for (const s of searches) {
    parts.push(
      `  ▸ ${s.label}${s.isActive ? "" : "  [DEAKTIVERT]"}`,
      line("tema", s.topic, "    "),
      line("oppdrag", clip(s.query, 600), "    "),
    );
  }

  return block(parts);
}

function renderActors(actors) {
  if (!Array.isArray(actors) || !actors.length) return null;
  return actors.map((a) => `${a.name}${a.role ? ` (${a.role})` : ""}`).join(", ");
}

function renderSourceCount(sources) {
  if (!Array.isArray(sources) || !sources.length) return null;
  return `  kilder: ${sources.length} (bruk detaljmodus for hele lista)`;
}

function renderSources(sources) {
  if (!Array.isArray(sources) || !sources.length) return null;
  const lines = ["  kilder:"];
  for (const s of sources) {
    if (!s || typeof s !== "object") {
      lines.push(`    - ${String(s)}`);
      continue;
    }
    const label = s.name ?? s.title ?? s.siteName ?? "(uten navn)";
    const meta = [s.isPrimary ? "primærkilde" : null, fmtTime(s.publishedDate)]
      .filter(Boolean)
      .join(" · ");
    lines.push(`    - ${label}${meta ? ` [${meta}]` : ""}`);
    if (s.url) lines.push(`      ${s.url}`);
    if (s.snippet) lines.push(`      ${clip(s.snippet, 200)}`);
  }
  return lines.join("\n");
}
