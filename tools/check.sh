#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
php_bin="${ZSKI_PHP:-php}"
python3 src/build.py --check
find js -maxdepth 1 -name '*.js' -print0 | xargs -0 -n1 node --check
node --test tests/hours.mjs
find api lib config tests -name '*.php' -print0 | xargs -0 -n1 "$php_bin" -l
"$php_bin" tests/contact.php
ZSKI_PHP="$php_bin" python3 tests/endpoint.py
