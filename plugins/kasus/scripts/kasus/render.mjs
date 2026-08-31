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

import { block, clip, fmtAge, fmtTime, line, stripHtml } from "../lib/table.mjs";

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

/**
 * De fire kategoriene et radarsignal kan komme fra, i den rekkefølgen de vises.
 *
 * Dette er den viktigste distinksjonen i hele runden, og den er ikke lesbar fra
 * API-feltene alene: `origin` og `type` må holdes i hodet SAMTIDIG, og begge
 * oppfølgingssøkene lagrer funnene som `market_signal`. Uten kategorien er et
 * søketreff på et to år gammelt blogginnlegg ikke til å skille fra konkurrentens
 * forsidesak fra i morges.
 *
 * Rekkefølgen er et redaksjonelt valg, ikke alfabetisk: nærmest redaksjonens
 * eget arbeid først, mest varierende relevans sist. Frie temasøk er nyttige, men
 * de er også der støyen bor — de skal ikke stå øverst og spise oppmerksomheten
 * på en runde som skal gå fort.
 */
export const SIGNAL_BUCKETS = [
  {
    key: "egen_oppfolging",
    title: "OPPFØLGING AV EGNE SAKER",
    explain:
      "nye kilder på en sak redaksjonen ALT har publisert. Egne domener er utelatt fra søket, " +
      "så dette er andre som har noe å tilføye saken deres — ofte den billigste gode saken på lista.",
  },
  {
    key: "konkurrent_oppfolging",
    title: "OPPFØLGING AV KONKURRENTSAK",
    explain:
      "andre kilder på et sakskompleks en konkurrent har tatt. Konkurrentenes egne domener er " +
      "utelatt, så dette er IKKE konkurrentens artikkel — det er kildene den bygger på, eller nye.",
  },
  {
    key: "konkurrentsak",
    title: "KONKURRENTSAK DIREKTE",
    explain:
      "hentet fra en overvåket forside. Ikke et søketreff og ikke research — det er saken deres, " +
      "slik den står. Skal den følges opp, er det den som må researches videre.",
  },
  {
    key: "temasok",
    title: "FRITT TEMASØK",
    explain:
      "søketreff på et tema, hentet UAVHENGIG av publiseringstidspunkt. Kan være gamle saker: " +
      "sjekk publisert-datoen på hver linje før du prioriterer. Her varierer relevansen mest.",
  },
  {
    key: "annet",
    title: "ANNET OPPHAV",
    explain:
      "en origin-verdi denne versjonen av pluginen ikke kjenner. Ikke en feil, og ikke en grunn " +
      "til å utelate signalet — API-et kan legge til nye verdier.",
  },
];

const BUCKET_BY_KEY = new Map(SIGNAL_BUCKETS.map((b) => [b.key, b]));

/**
 * Kategorien et signal hører i. ÉN definisjon, brukt både av rendering og av
 * tellingene i `--json`, så teksten og tallene ikke kan si ulike ting.
 *
 * @param {{ origin?: string|null, type?: string }} signal
 * @returns {string} nøkkelen i SIGNAL_BUCKETS
 */
export function bucketOf(signal) {
  if (signal.origin === "own_followup") return "egen_oppfolging";
  if (signal.origin === "competitor_followup") return "konkurrent_oppfolging";
  if (signal.origin) return "annet";
  if (signal.type === "competitor_article") return "konkurrentsak";
  return "temasok";
}

/** Tittelen som vises for en kategori. Ukjent opphav tar med den rå verdien. */
export function bucketTitle(key, signals = []) {
  const bucket = BUCKET_BY_KEY.get(key) ?? BUCKET_BY_KEY.get("annet");
  if (key !== "annet") return bucket.title;
  const raw = [...new Set(signals.map((s) => s.origin).filter(Boolean))];
  return raw.length ? `${bucket.title} (${raw.join(", ")})` : bucket.title;
}

/**
 * Hvor gammel SAKEN er, ikke hvor gammelt signalet er.
 *
 * De to forveksles, og forvekslingen er dyr: et fritt temasøk hentes uavhengig av
 * publiseringstidspunkt, så «oppdaget for 45 min siden» kan være en artikkel fra
 * 2023. En journalist som prioriterer på oppdaget-tidspunktet alene ringer en
 * kilde om en sak som er ferdig behandlet.
 *
 * Terskelen er en uke: innenfor det er publiseringen og oppdagelsen praktisk
 * talt samme hendelse, og en ekstra dato bare støy på linja.
 */
export const STALE_AFTER_DAYS = 7;

export function publishedNote(signal) {
  const published = signal.details?.publishedDate;
  const detectedMs = Date.parse(signal.detectedAt ?? "");
  if (!published) {
    // At datoen mangler er ikke det samme som at saken er fersk, og det skal
    // ikke leses som fersk. Derfor sies det.
    return "publisert: ukjent dato";
  }
  const publishedMs = Date.parse(published);
  if (Number.isNaN(publishedMs)) return "publisert: ukjent dato";

  const referanse = Number.isNaN(detectedMs) ? Date.now() : detectedMs;
  const dager = (referanse - publishedMs) / 86_400_000;
  if (dager > STALE_AFTER_DAYS) {
    return `GAMMEL SAK: publisert ${fmtAge(published)} (${fmtTime(published)})`;
  }
  return `publisert ${fmtAge(published)}`;
}

/** Ett signal på én til tre linjer — nok til å velge, ikke nok til å lese. */
function renderSignalLine(signal) {
  const kilder = Array.isArray(signal.sources) ? signal.sources.length : 0;
  const meta = [
    // «oppdaget» og «publisert» står side om side, i den rekkefølgen. Uten
    // ordet «oppdaget» leses tallet som sakens alder, og det er det ikke.
    `oppdaget ${fmtAge(signal.detectedAt)}`,
    publishedNote(signal),
    signal.details?.matchedPattern
      ? `mønster: ${signal.details.matchedPattern}`
      : "uten mønstertreff",
    signal.sourceLabel,
    // At det finnes flere lenker bak signalet må SIES her. Ellers ser
    // runden ut som én kilde per signal, og de andre blir aldri åpnet.
    kilder > 1 ? `+${kilder - 1} kilder til (se «signal ${signal.id}»)` : null,
  ].filter(Boolean);

  return block([
    `    ▸ [${signal.status}] ${clip(signal.title, 140)}`,
    `      ${meta.join(" · ")}`,
    line("id", signal.id, "      "),
    // Lenka er ikke metadata — den er det journalisten klikker på FØR han
    // velger sak. Derfor står den alltid på egen linje, og et signal UTEN
    // lenke sier det: da er det ingenting å lese seg opp på, og det er i seg
    // selv en grunn til å prioritere det ned.
    line("LENKE", signal.url ?? "(ingen — signalet har ingen url å åpne)", "      "),
    line("kort", clip(signal.summary, 180), "      "),
  ]);
}

/**
 * Én egen artikkel på tre linjer — nok til å se om den dekker saken.
 */
function renderArticleLine(article, indent = "  ") {
  const meta = [
    article.published ? `publisert ${fmtAge(article.published)}` : "UPUBLISERT",
    article.sectionTag,
    article.paywall ? "betalingsmur" : null,
    article.wordCount ? `${article.wordCount} ord` : null,
    article.bylines?.length ? article.bylines.join(", ") : null,
  ].filter(Boolean);

  return block([
    `${indent}▸ ${clip(article.title, 140)}`,
    `${indent}  ${meta.join(" · ")}`,
    line("id", article.id, `${indent}  `),
    line("url", article.url, `${indent}  `),
    line("ingress", clip(article.excerpt, 200), `${indent}  `),
  ]);
}

/** Liste over egne artikler, uten matching. */
export function renderArticles(articles, { truncated = false } = {}) {
  if (!articles.length) {
    return "Ingen egne artikler for denne organisasjonen med dette filteret.";
  }
  const parts = [`${articles.length} egne artikler (nyest publisert først):`];
  for (const article of articles) parts.push("", renderArticleLine(article));
  if (truncated) parts.push("", "Taket er nådd — det finnes MER enn dette. Øk --limit.");
  return block(parts);
}

/**
 * Vinduet av egne artikler, i den formen `kasus-archivist` leser det.
 *
 * Dette er IKKE en treffliste. Det er alle artiklene i vinduet, og formen er
 * lagd for å bli lest av en agent OG av et menneske som vil ettergå svaret: én
 * blokk per artikkel, med id-en som må oppgis for at en påstand om en egen sak
 * skal kunne slås opp.
 *
 * Forbeholdet står ØVERST, ikke nederst. Grunnlaget leses ovenfra, og
 * konklusjonen «ikke dekket» trekkes i det øyeblikket lista ser tom ut — etter
 * det leser ingen en fotnote.
 */
export function renderArticleWindow(vindu, meta) {
  const parts = [
    "EGNE SAKER — VINDUET ET SPØRSMÅL OM EGEN DEKNING BESVARES MOT",
    `  ${meta.vindu} publiserte artikler, nyest først, hentet over ${meta.sider} side(r)` +
      `${meta.utenPublisering ? `  ·  ${meta.utenPublisering} kladd(er) holdt utenfor` : ""}`,
    `  felter: ${meta.felter.join(", ")}  (ingen brødtekst — bruk «article <id>»)`,
    `  FORBEHOLD: ${meta.forbehold}`,
  ];

  if (!vindu.length) {
    parts.push(
      "",
      "Ingen egne artikler for denne organisasjonen med dette filteret.",
      "",
      "Det er ikke det samme som «temaet er udekket»: har organisasjonen ingen",
      "artikler synkronisert til Kasus, kan spørsmålet ikke besvares her i det hele",
      "tatt — og da må det sies til journalisten framfor å svare «ingen treff».",
    );
    return block(parts);
  }

  parts.push("");
  for (const article of vindu) {
    parts.push(
      `  ▸ ${clip(article.title, 140)}`,
      line("id", article.id, "    "),
      line("publisert", article.published ? fmtAge(article.published) : "UPUBLISERT", "    "),
      line("stikktittel", article.kicker, "    "),
      line("undertittel", clip(article.subtitle, 160), "    "),
      line("seksjon", article.sectionTag, "    "),
      line("emneknagger", article.tags, "    "),
      line("ingress", clip(article.excerpt, 300), "    "),
      line("url", article.url, "    "),
      "",
    );
  }

  if (meta.taketNådd) {
    parts.push("Taket er nådd — det finnes MER enn dette. Øk --limit.");
  }
  return block(parts);
}

/**
 * Vinduet av radarsignaler, i den formen `kasus-lookout` leser det.
 *
 * Kategorien står på hver linje, ikke som en gruppeoverskrift. Det er forskjellen
 * fra `renderDigest`, og den er tilsiktet: en leser som skal svare på et spørsmål
 * plukker signaler ut av rekkefølgen, og en kategori som bare sto i en overskrift
 * lenger opp følger ikke med når signalet siteres.
 */
export function renderSignalWindow(vindu, meta) {
  const parts = [
    "RADARSIGNALER — VINDUET ET SPØRSMÅL LESES MOT",
    `  ${meta.vindu} signaler${meta.hentet !== meta.vindu ? ` (av ${meta.hentet} hentet)` : ""}, sist oppdaget først, over ${meta.sider} side(r)`,
    `  felter: ${meta.felter.join(", ")}  (ingen researchkontekst — bruk «signal <id>»)`,
    meta.lokaleFiltre?.length
      ? `  lokale filtre: ${meta.lokaleFiltre.map((l) => `${l.flagg} (${l.beskrivelse})`).join(" + ")}`
      : null,
    `  KVITTERING: ${meta.kvittering}`,
    `  FORBEHOLD: ${meta.forbehold}`,
  ];

  if (!vindu.length) {
    parts.push(
      "",
      meta.hentet
        ? `${meta.hentet} signaler ble hentet, men ingen passerte det lokale filteret` +
          `${meta.lokaleFiltre?.length ? ` (${meta.lokaleFiltre.map((l) => l.flagg).join(" + ")})` : ""}.`
        : "Ingen radarsignaler for denne organisasjonen med dette filteret.",
      "",
      "Det er ikke det samme som «ingenting skjer»: nøkkelen avgjør organisasjonen,",
      "og et tomt svar betyr tomt for DENNE — aldri tomt i Kasus.",
    );
    return block(parts);
  }

  parts.push("");
  for (const signal of vindu) {
    parts.push(
      `  ▸ [${signal.kategori}] ${clip(signal.title, 140)}`,
      line("id", signal.id, "    "),
      line("status", signal.status, "    "),
      // De to datoene står SAMMEN, med ordene på. «oppdaget» alene leses som
      // sakens alder, og et fritt temasøk kan levere en sak fra 2023 i dag.
      line(
        "oppdaget",
        signal.oppdaget ? `${fmtAge(signal.oppdaget)} (${fmtTime(signal.oppdaget)})` : "ukjent",
        "    ",
      ),
      line(
        "publisert",
        signal.publisert ? `${fmtAge(signal.publisert)} (${fmtTime(signal.publisert)})` : "ukjent dato — IKKE «fersk»",
        "    ",
      ),
      line("mønster", signal.mønster ?? "uten mønstertreff — profilen forklarer ikke hvorfor", "    "),
      line("kilde", signal.sourceLabel, "    "),
      line("url", signal.url ?? "(ingen — må vurderes på tittelen alene)", "    "),
      signal.kilder > 1 ? `    kilder: ${signal.kilder} (se «signal ${signal.id}»)` : null,
      line("sammendrag", signal.summary, "    "),
      "",
    );
  }

  if (meta.taketNådd) {
    parts.push("Taket er nådd — det finnes MER enn dette. Øk --limit.");
  }
  return block(parts);
}

/** Én egen artikkel med hele teksten. */
export function renderArticle(article, { full = false } = {}) {
  const max = full ? 6000 : 400;
  return block([
    `${article.title}`,
    line("id", article.id),
    line("cms", [article.cms, article.status].filter(Boolean).join(" · ")),
    line("stikktittel", article.kicker),
    line("undertittel", article.subtitle),
    line("byline", article.bylines),
    line("seksjon", article.sectionTag),
    line("stikkord", article.tags),
    line("url", article.url),
    line("betalingsmur", article.paywall === undefined ? null : article.paywall ? "ja" : "nei"),
    line(
      "publisert",
      article.published
        ? [fmtTime(article.published), fmtAge(article.published)].filter(Boolean).join(" · ")
        : "(upublisert)",
    ),
    line("sist endret", fmtTime(article.modified)),
    line("omfang", article.wordCount ? `${article.wordCount} ord` : null),
    line("lesetid", article.readTime),
    "",
    // `body` er HTML fra Labrador og ren tekst fra de andre. Den strippes for
    // lesbarhet her; `--json` gir den slik CMS-et leverte den.
    line("tekst", clip(stripHtml(article.body ?? article.excerpt), max)),
  ]);
}

/**
 * Runden: hva som har kommet inn siden forrige kvittering.
 *
 * Signalene er gruppert på opphav, og hver gruppe bærer forklaringen sin. Det er
 * distinksjonen hele runden hviler på: «vi kan utvide vår egen sak i dag» og «her
 * er en to år gammel bloggpost om temaet» ser identiske ut i rå API-felt.
 */
export function renderDigest(digest) {
  const parts = ["NYTT SIDEN SIST"];
  const cp = digest.checkpoint;
  const overstyrt = digest.window.basis === "overstyrt";

  if (cp) {
    parts.push(
      `  kvittert: ${fmtTime(cp)} (${fmtAge(cp)}) · etterslep-vindu: ${digest.lagHours} t · kilde: ${digest.stateSource}`,
    );
    // Med --hours er det IKKE «siden sist» som vises, selv om kvitteringen
    // finnes. Uten denne linja ser et 72-timers vindu ut som en travel natt.
    if (overstyrt) {
      parts.push(
        `  MERK: vinduet er overstyrt til ${digest.window.hours} t — dette er ikke «siden sist», ` +
          `men alt i vinduet som ikke alt er kvittert for.`,
      );
    }
  } else if (overstyrt) {
    parts.push(`  ingen kvittering ennå — vinduet er OVERSTYRT til ${digest.window.hours} t.`);
  } else {
    parts.push(
      `  ingen kvittering ennå for denne organisasjonen — viser siste ` +
        `${digest.window.hours} timer. Kvitterer du nå, blir dette utgangspunktet neste gang.`,
    );
  }

  const nye = (n) => `${n} ${n === 1 ? "nytt signal" : "nye signaler"}`;
  parts.push(`  ${nye(digest.signals.length)} av ${digest.fetched} hentet`);

  // Fordelingen over mønstre er det som gjør en liste til en STATUS: den svarer
  // på «hva har skjedd siden sist» i én linje, uten at man leser sju signaler.
  // Mønsteret er også koblingen til profilen, så en topp som ikke ligner på et
  // mønster er i seg selv en opplysning.
  if (digest.fordeling?.length) {
    parts.push(
      `  fordeling: ${digest.fordeling.map((f) => `${f.monster} ${f.antall}`).join(" · ")}`,
    );
  }

  const skipped = [
    digest.skipped.seen ? `${digest.skipped.seen} alt kvittert for` : null,
    digest.skipped.window ? `${digest.skipped.window} utenfor vinduet` : null,
    digest.skipped.dismissed ? `${digest.skipped.dismissed} forkastet (bruk --all for å se dem)` : null,
  ].filter(Boolean);
  if (skipped.length) parts.push(`  holdt utenfor: ${skipped.join(" · ")}`);

  if (digest.gamleSaker?.length) {
    parts.push(
      `  ${digest.gamleSaker.length} av dem er GAMLE SAKER — publisert lenge før de ble oppdaget.`,
    );
  }

  if (digest.truncated) {
    parts.push("  TAKET ER NÅDD — det finnes mer enn dette. Øk --limit.");
  }

  if (!digest.signals.length) {
    parts.push("", "Ingen nye signaler.");
  } else {
    const buckets = new Map();
    for (const signal of digest.signals) {
      const key = bucketOf(signal);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(signal);
    }

    // Forklaringen står i HVER runde, ikke bare i dokumentasjonen. De fire
    // kategoriene krever ulike tiltak — egen oppfølging kan skrives i dag, en
    // konkurrentsak må researches fra grunnen — og en overskrift alene sier
    // ikke hvilket tiltak det er.
    for (const { key, explain } of SIGNAL_BUCKETS) {
      const items = buckets.get(key);
      if (!items?.length) continue;
      parts.push("", `  ${bucketTitle(key, items)} (${items.length})`, `    → ${explain}`);
      for (const signal of items) parts.push(renderSignalLine(signal));
    }
  }

  parts.push("", "KVITTERING");
  if (!digest.signals.length) {
    parts.push("  Ingenting nytt å kvittere for. Kvitteringen står der den står.");
  } else {
    parts.push(
      `  Denne uthentingen leser IKKE noe som sett — bare «kvitter» skriver.`,
      `  Når runden er gjort:`,
      `    kasus.mjs kvitter --at ${digest.ack.at} --ids ${digest.ack.ids.join(",")}`,
      `  Rakk du bare noen av signalene:`,
      `    kasus.mjs kvitter --ids <de du behandlet> --ids-only`,
    );
  }

  return block(parts);
}

/** Resultatet av en kvittering: hva som flyttet seg, og hvor det står skrevet. */
export function renderAck(ack) {
  const parts = ["KVITTERING SKREVET", line("fil", ack.path), line("kilde", ack.source)];

  for (const [stream, value] of Object.entries(ack.before)) {
    const after = ack.after[stream];
    const from = value ? fmtTime(value) : "(ingen kvittering)";
    parts.push(
      ack.keptTime
        ? `  ${stream}: ${from} — uendret`
        : `  ${stream}: ${from} → ${fmtTime(after)}`,
    );
  }

  parts.push(
    line("id-er husket", `${ack.seenIds} (tak ${ack.maxSeenIds})`),
    ack.addedIds ? line("nye id-er kvittert", ack.addedIds) : null,
    "",
  );

  if (ack.keptTime) {
    parts.push(
      "  Bare de oppgitte id-ene er kvittert for. Tidspunktet står urørt, så alt",
      "  annet som kom inn er fortsatt nytt neste runde — ingenting ble svelget.",
    );
  } else {
    parts.push(
      "  Alt eldre enn kvitteringen regnes nå som sett — også det du ikke fikk se.",
      `  Neste «nytt» ser ${ack.lagHours} t bakover forbi kvitteringen for å fange`,
      "  signaler som ble indeksert i etterkant, og undertrykker det som alt er vist.",
    );
  }

  return block(parts);
}

/** `--reset`: kvitteringen for denne organisasjonen er borte. */
export function renderReset(reset) {
  return block([
    reset.removed ? "KVITTERING NULLSTILT" : "INGEN KVITTERING Å NULLSTILLE",
    line("fil", reset.path),
    reset.corrupt ? line("merk", "fila var ødelagt og ble skrevet på nytt") : null,
    "",
    reset.removed
      ? `  Neste «nytt» viser siste ${reset.firstRunHours} timer, og sier at det ikke finnes en kvittering.`
      : "  Det fantes ingen kvittering for denne organisasjonen. Ingenting ble endret utover fila.",
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
