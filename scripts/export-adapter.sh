#!/bin/bash
# export-adapter.sh — re-export data/tidecloak.json from the running TideCloak (e.g. after a realm
# was re-created). The app server picks the new file up without a restart.
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
set -a; . "$PROJECT_DIR/.env"; set +a
TIDECLOAK_URL="${TIDECLOAK_URL:-http://localhost:8080}"; REALM_NAME="${REALM_NAME:-veil}"; CLIENT_NAME="${CLIENT_NAME:-veil-client}"
T=$(curl -s -X POST "$TIDECLOAK_URL/realms/master/protocol/openid-connect/token" -d client_id=admin-cli -d grant_type=password \
  --data-urlencode "username=${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}" --data-urlencode "password=$KC_BOOTSTRAP_ADMIN_PASSWORD" | jq -r .access_token)
CU=$(curl -s "$TIDECLOAK_URL/admin/realms/$REALM_NAME/clients?clientId=$CLIENT_NAME" -H "Authorization: Bearer $T" | jq -r '.[0].id')
OUT="$PROJECT_DIR/data/tidecloak.json"
curl -s "$TIDECLOAK_URL/admin/realms/$REALM_NAME/vendorResources/get-installations-provider?clientId=$CU&providerId=keycloak-oidc-keycloak-json" \
  -H "Authorization: Bearer $T" > "$OUT.tmp"
jq -e 'has("jwk") and has("vendorId")' "$OUT.tmp" > /dev/null || { echo "export missing jwk/vendorId" >&2; rm -f "$OUT.tmp"; exit 1; }
mv "$OUT.tmp" "$OUT"   # atomic swap: the dev server never reads a half-written file
echo "exported $OUT (vendorId $(jq -r .vendorId "$OUT"))"
