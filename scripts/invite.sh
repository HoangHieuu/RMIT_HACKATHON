#!/bin/bash
# invite.sh <username> — mint a fresh Tide account-link invite for one persona (link expires in 12h).
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
set -a; . "$PROJECT_DIR/.env"; set +a
TIDECLOAK_URL="${TIDECLOAK_URL:-http://localhost:8080}"; REALM_NAME="${REALM_NAME:-veil}"
U="${1:?usage: invite.sh <username>}"
T=$(curl -s -X POST "$TIDECLOAK_URL/realms/master/protocol/openid-connect/token" -d client_id=admin-cli -d grant_type=password \
  --data-urlencode "username=${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}" --data-urlencode "password=$KC_BOOTSTRAP_ADMIN_PASSWORD" | jq -r .access_token)
UID_=$(curl -s "$TIDECLOAK_URL/admin/realms/$REALM_NAME/users?username=$U&exact=true" -H "Authorization: Bearer $T" | jq -r '.[0].id // empty')
[ -z "$UID_" ] && { echo "no user $U" >&2; exit 1; }
curl -s -X POST "$TIDECLOAK_URL/admin/realms/$REALM_NAME/tideAdminResources/get-required-action-link?userId=$UID_&lifespan=43200" \
  -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d '["link-tide-account-action"]'
echo
