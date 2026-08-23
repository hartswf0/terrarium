#!/usr/bin/env bash
# Rebuild HLIDARENDI.html (single self-contained file) from src/ + sources/.
# Needs: npm i three@0.180.0 esbuild  (in this directory or above)
set -euo pipefail
cd "$(dirname "$0")"
TMP="$(mktemp -d)"
# the ARGOS game contract travels verbatim from the vendored source of record
sed -n '/==PURE-BEGIN==/,/==PURE-END==/p' sources/argos-half-dog.html > "$TMP/ar.js"
npx esbuild src/main.js --bundle --format=iife --minify --target=es2020 --outfile="$TMP/bundle.min.js"
{ cat src/shell.html
  printf '\n<script>\n'; cat "$TMP/ar.js"
  printf '\n</script>\n<script>\n'; cat "$TMP/bundle.min.js"
  printf '\n</script>\n</body>\n</html>\n'
} > HLIDARENDI.html
rm -rf "$TMP"
echo "built HLIDARENDI.html ($(wc -c < HLIDARENDI.html) bytes)"
