#!/usr/bin/env bash
# Guarded deploy to Cloudflare Pages.
# Aborts unless wrangler is signed in to exactly one account and it is the pinned personal one.
set -euo pipefail

EXPECTED_ACCOUNT_ID="3a459a47f63c6f049c3217b090c824dd"
PROJECT="luistanafranca"
BRANCH="${1:-redesign}"

cd "$(dirname "$0")/.."

abort() {
  echo "DEPLOY ABORTED: $1" >&2
  exit 1
}

# An API token in the environment could belong to a different account than the login.
for var in CLOUDFLARE_API_TOKEN CLOUDFLARE_API_KEY CLOUDFLARE_EMAIL CF_API_TOKEN; do
  [ -z "${!var:-}" ] || abort "$var is set in the environment. Unset it and use 'wrangler login'."
done

grep -q "^account_id = \"$EXPECTED_ACCOUNT_ID\"$" wrangler.toml || abort "wrangler.toml is not pinned to the expected account."
grep -q "^name = \"$PROJECT\"$" wrangler.toml || abort "wrangler.toml does not name the $PROJECT project."

WHOAMI="$(npx wrangler whoami 2>&1)" || abort "wrangler whoami failed (not logged in?)."
IDS="$(printf '%s\n' "$WHOAMI" | grep -oE '[0-9a-f]{32}' | sort -u)"
[ -n "$IDS" ] || abort "no account ID found in wrangler whoami."
[ "$IDS" = "$EXPECTED_ACCOUNT_ID" ] || abort "wrangler sees a different account, or more than one. Expected only $EXPECTED_ACCOUNT_ID."
if printf '%s\n' "$WHOAMI" | grep -qi "unify"; then abort "wrangler whoami mentions Unify."; fi

export CLOUDFLARE_ACCOUNT_ID="$EXPECTED_ACCOUNT_ID"
echo "Account check passed: $EXPECTED_ACCOUNT_ID"

npm run check
npm run lint
npm run build

if ! npx wrangler pages project list 2>&1 | grep -qw "$PROJECT"; then
  npx wrangler pages project create "$PROJECT" --production-branch main
fi

npx wrangler pages deploy dist --project-name "$PROJECT" --branch "$BRANCH" --commit-dirty=true
