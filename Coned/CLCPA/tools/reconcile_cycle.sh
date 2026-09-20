#!/bin/sh
# CLCPA reconciliation cycle -- DETECTION ONLY.
#
# Steps 1-3 of the standing cycle are mechanical and belong in a script, so they
# run the same way every time and cannot drift. Steps 4-14 are judgement --
# reviewing a diff, deciding what is legitimate, deploying -- and are
# deliberately NOT automated here. A script that merges and deploys unattended
# is how an unreviewed change reaches a client environment.
#
#   sh tools/reconcile_cycle.sh          fetch + detect; exit 0 = no delta, 10 = delta
#   sh tools/reconcile_cycle.sh --no-fetch   detect against refs already local
#
# Exit codes are the contract: 0 means "do nothing to the application", which is
# the instruction when there is no engineer delta.
set -e
# Git Bash maps the Windows temp directory to /tmp, and Node on Windows then
# resolves that back to a literal C:\tmp that does not exist. `pwd -W` gives the
# real Windows path; plain `pwd` is kept as the fallback for real POSIX hosts.
winpwd() { pwd -W 2>/dev/null || pwd; }
DIR="$(cd "$(dirname "$0")" && winpwd)"
REPO="$(cd "$(dirname "$0")/../../.." && winpwd)"
cd "$REPO"

if [ "$1" != "--no-fetch" ]; then
  # 1. fetch clarafortuna/demos
  git fetch --all --prune >/dev/null 2>&1 || { echo "FETCH FAILED -- check auth"; exit 2; }
fi

URL=$(git config --get remote.origin.url)
case "$URL" in
  *clarafortuna/demos*) ;;
  *) echo "WRONG REMOTE: $URL -- expected clarafortuna/demos"; exit 2 ;;
esac

BASE=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$DIR/reconciled.json','utf8')).engineerTip||'')")
[ -n "$BASE" ] || { echo "no reconciled baseline recorded"; exit 2; }

echo "RECONCILIATION CYCLE  $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "  remote            : $URL"
echo "  reconciled baseline: $BASE"
echo "  origin/main       : $(git rev-parse --short origin/main)"
echo "  integration tip   : $(git rev-parse --short HEAD)"

# 2 + 3. detect changes since the baseline, including commits merged straight to
# main, with our own branch excluded from engineer-tip detection (reconcile.js
# does both).
echo ""
node "$DIR/reconcile.js" status 2>&1 | sed -n '/LIVE engineer/,$p' | sed 's/^/  /'

N=$(git rev-list --count "$BASE"..origin/main 2>/dev/null || echo 0)

# a live branch may also carry work that has not reached main yet
for b in $(git branch -r --format='%(refname:short)' | grep -v HEAD | grep -v clcpa-integration-candidate); do
  BEHIND=$(git rev-list --count "$b"..origin/main 2>/dev/null || echo 1)
  AHEAD=$(git rev-list --count origin/main.."$b" 2>/dev/null || echo 0)
  if [ "$BEHIND" = "0" ] && [ "$AHEAD" != "0" ]; then
    M=$(git rev-list --count "$BASE".."$b" 2>/dev/null || echo 0)
    [ "$M" -gt "$N" ] && N="$M"
  fi
done

echo ""
if [ "$N" = "0" ]; then
  echo "  NO ENGINEER DELTA -- do nothing to the application."
  exit 0
fi
echo "  ENGINEER DELTA: $N commit(s) since $BASE"
echo "  -> proceed to steps 4-14 (review, integrate, test, migrate, build, deploy, smoke, push, advance)"
exit 10
