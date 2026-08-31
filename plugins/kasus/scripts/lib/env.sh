# shellcheck shell=sh
# Miljønavn → suffiks i variabelnavn. ÉN definisjon for hele shell-siden.
#
# Motstykket i JS er `envSuffix()` i lib/env.mjs. To språk kan ikke dele én
# funksjon uten et byggesteg, så `self-test.sh` sammenligner de to i stedet:
# driver de fra hverandre, blir testen rød, og da ber `/kasus:env` om et annet
# variabelnavn enn verktøyet leser.
#
# Sourcees, ikke kjøres: `. "$HERE/lib/env.sh"`.

# env_suffix <miljønavn> — skriver suffikset til stdout.
env_suffix() { printf '%s' "$1" | tr 'a-z-' 'A-Z_'; }

# env_var <base> <miljønavn> — hele variabelnavnet, f.eks. KASUS_API_KEY_PRE_PROD.
env_var() { printf '%s_%s' "$1" "$(env_suffix "$2")"; }
