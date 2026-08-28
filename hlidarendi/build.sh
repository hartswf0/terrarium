#!/usr/bin/env bash
# Rebuild HLIDARENDI.html (single self-contained file) from src/ + sources/.
# Needs: npm i three@0.180.0 esbuild  (in this directory or above)
set -euo pipefail
cd "$(dirname "$0")"
TMP="$(mktemp -d)"
# the ARGOS game contract travels verbatim from the vendored source of record
sed -n '/==PURE-BEGIN==/,/==PURE-END==/p' sources/argos-half-dog.html > "$TMP/ar.js"
# ground-relative traction patch (SPEC 3): the donor pins pads at absolute y=0,
# which kills traction everywhere real terrain is not sea level. Sources stay
# verbatim; the patch is applied here at assembly.
python3 - "$TMP/ar.js" <<'PYPATCH'
import sys
p=sys.argv[1];s=open(p).read()
old="""    var on = padY <= LOCO.groundTol;"""
new="""    /* HLIDARENDI patch: the pad measured against the dog's OWN ground. The
       donor pins pads at absolute y=0, which kills traction anywhere the land
       is not sea level. The root carries the terrain height — but the root is
       not the contact plane: a sitting dog puts his haunches a fifth of a
       metre below it, and the page lifts the root by that much so his lowest
       part meets the land. A pad is therefore planted when it is at or below
       the body, which on a posed hillside body is the honest test available:
       measuring against the lifted contact plane instead stalls him outright,
       because only the single deepest pad ever reaches it. */
    var on = padY - (rig.root.t[1]||0) <= LOCO.groundTol;"""
assert old in s, 'traction patch anchor missing'
open(p,'w').write(s.replace(old,new))
PYPATCH
npx esbuild src/main.js --bundle --format=iife --minify --target=es2020 --outfile="$TMP/bundle.min.js"
{ cat src/shell.html
  printf '\n<script>\n'; cat "$TMP/ar.js"
  printf '\n</script>\n<script>\n'; cat "$TMP/bundle.min.js"
  printf '\n</script>\n</body>\n</html>\n'
} > HLIDARENDI.html
rm -rf "$TMP"
echo "built HLIDARENDI.html ($(wc -c < HLIDARENDI.html) bytes)"
