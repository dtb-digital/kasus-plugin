---
description: Sjekk at kasus-pluginen er koblet til Kasus — hvilken installasjon, hvilken organisasjon, og om tilkoblingen kan kvittere og lagre saksforslag
argument-hint: ""
allowed-tools: ["mcp__plugin_kasus_kasus__get_organization"]
---

Pluginen har ingen egen kode og ingen API-nøkkel. Alt går gjennom Kasus'
MCP-server, som pluginen registrerer selv under navnet `kasus` (se
[`references/kasus-mcp.md`](../references/kasus-mcp.md)). Sjekk tilkoblingen:

```
get_organization {}
```

Presenter svaret slik:

1. **Verktøyet finnes ikke, eller kallet feiler på tilgang.** Tilkoblingen er ikke
   logget inn. Be brukeren skrive `/mcp`, velge `kasus` og *Authenticate*: Kasus
   åpnes i nettleseren, brukeren logger inn, velger organisasjon (har hen flere)
   og godkjenner. Ingen nøkkel skal limes inn noe sted. Står `kasus` ikke i
   `/mcp`-lista i det hele tatt, er pluginen ikke aktivert — se pluginens README.
2. **Svaret kommer.** Si hvilken **organisasjon** tilkoblingen er bundet til
   (`organization.name`) — den avgjør hva alle andre kall svarer på, ikke noe som
   sendes med. Si hvordan den er logget inn (`auth.via`).
3. **`auth.canWrite` er usann.** Tilkoblingen kan lese, men ikke kvittere for
   saksløpet eller lagre saksforslag. Det skjer når den er satt opp med en
   API-nøkkel (alltid read-only), eller ble godkjent før skrivetilgangen fantes.
   Tiltaket er å logge inn på nytt med OAuth: `/mcp` → `kasus` → *Clear
   authentication*, deretter *Authenticate*.

**Hvilken installasjon.** Adressen er `KASUS_MCP_URL` hvis variabelen er satt
(f.eks. for et test- eller staging-miljø), ellers `https://app.kasus.io/api/mcp`.
Variabelen settes i `settings.json` → `env` og krever omstart av sesjonen.
`.env`-filer leses ikke av Claude Code. Bytte av installasjon krever ny innlogging,
og organisasjonen kan da være en annen.
