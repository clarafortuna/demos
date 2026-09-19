#!/bin/sh
# Run the permanent security regression set. Exits non-zero if anything is red.
# No arguments, no environment required: every suite resolves the repository
# root by walking up from its own directory.
set -e
DIR="$(cd "$(dirname "$0")/../tickets/security-evidence" && pwd)"
fail=0
for f in "$DIR"/suite_*.js "$DIR"/mut_security.js; do
  name=$(basename "$f")
  out=$(node "$f" 2>&1) || true
  line=$(printf '%s' "$out" | grep -o '[0-9]* passed, [0-9]* failed' | tail -1)
  printf '  %-32s %s\n' "$name" "$line"
  case "$line" in *" 0 failed") ;; *) fail=1 ;; esac
done
[ "$fail" = 0 ] && echo "  SECURITY SET GREEN" || echo "  SECURITY SET RED"
exit $fail
