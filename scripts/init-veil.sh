#!/bin/bash
# init-veil.sh — Bootstrap a local TideCloak for VEIL.
#
# Adapted from the Tide pack's scripts/init-tidecloak.sh (same governance sequence), with:
#   - Windows/Git-Bash friendly docker usage (no sudo, named volume, no MSYS path mangling)
#   - the VEIL demo cast for a FOUR-person team, created while the realm is still FirstAdmin:
#       hr-lead     VEIL organisation admin (veil-org-admin)  + security committee member A
#       officer     future disclosure officer                 + security committee member B
#                   (veil-disclosure-officer is NOT granted here: granting it is the live
#                    2-of-3 quorum demo)
#       reviewer    VEIL evaluator (veil-evaluator)          + security committee member C
#       applicant   candidate (default role veil-applicant); the only outsider, no admin rights
#   - The three staff accounts become tide-realm-admin => threshold max(1, floor(3*0.7)) = 2.
#     hr-lead's grant flips the realm to multiAdmin. The script then tries to commit the other two
#     grants it pre-authorised while still FirstAdmin; any that TideCloak keeps PENDING are approved
#     by hr-lead in VEIL > Governance (threshold is still 1 at that point).
#
# Run via: npm run init      Prerequisites: docker, curl, jq

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

TIDECLOAK_URL="${TIDECLOAK_URL:-http://localhost:8080}"
REALM_NAME="${REALM_NAME:-veil}"
CLIENT_NAME="${CLIENT_NAME:-veil-client}"
CLIENT_APP_URL="${CLIENT_APP_URL:-http://localhost:3000}"
ADAPTER_OUTPUT="${ADAPTER_OUTPUT:-$PROJECT_DIR/data/tidecloak.json}"
INVITES_OUTPUT="${INVITES_OUTPUT:-$PROJECT_DIR/data/invite-links.txt}"
TIDECLOAK_IMAGE="${TIDECLOAK_IMAGE:-tideorg/tidecloak-dev:latest}"
CONTAINER_NAME="${CONTAINER_NAME:-veil-tidecloak}"
VOLUME_NAME="${VOLUME_NAME:-veil-tidecloak-data}"

# Demo cast: "username:realm-role-or-empty"
CAST=(
  "hr-lead:veil-org-admin"
  "officer:"
  "reviewer:veil-evaluator"
  "applicant:"
)
FIRST_ADMIN="hr-lead"
COMMITTEE=("hr-lead" "officer" "reviewer")

# --- Master-admin credentials: from .env, never hardcoded (AP-41) ---
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a; . "$PROJECT_DIR/.env"; set +a
fi
KC_BOOTSTRAP_ADMIN_USERNAME="${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}"
if [ -z "${KC_BOOTSTRAP_ADMIN_PASSWORD:-}" ]; then
  echo "ERROR: KC_BOOTSTRAP_ADMIN_PASSWORD is not set. cp .env.example .env and set it." >&2
  exit 1
fi

# --- Licence email + Terms & Conditions: answered by a PERSON (AP-90) ---
TIDE_TERMS_URL="https://tide.org/legal"
LICENSE_EMAIL="${TIDE_LICENSE_EMAIL:-}"
valid_license_email() {
  [[ "${1:-}" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || return 1
  case "${1##*@}" in
    example.com|example.org|example.net|yourorg.com|yourdomain.com|yourcompany.com|company.com|\
    domain.com|test.com|placeholder.com|email.com|*.example|*.test|*.invalid|*.local|localhost)
      return 1 ;;
  esac
  return 0
}
if ! valid_license_email "$LICENSE_EMAIL" || [ "${TIDE_TERMS_ACCEPTED:-}" != "yes" ]; then
  cat >&2 <<MSG
STOP: the Tide realm was NOT set up. Nothing was created.
  Set TIDE_LICENSE_EMAIL (a real address you control) and TIDE_TERMS_ACCEPTED=yes in .env,
  only after the deployment owner has read and agreed to $TIDE_TERMS_URL
MSG
  exit 2
fi
echo "==> Licence email: $LICENSE_EMAIL"
echo "==> Terms & Conditions ($TIDE_TERMS_URL): accepted by the operator"

# --- Helpers ---
get_token() {
  curl -s -X POST "$TIDECLOAK_URL/realms/master/protocol/openid-connect/token" \
    -d "client_id=admin-cli" -d "grant_type=password" \
    --data-urlencode "username=$KC_BOOTSTRAP_ADMIN_USERNAME" \
    --data-urlencode "password=$KC_BOOTSTRAP_ADMIN_PASSWORD" \
    | jq -r '.access_token'
}

# Approve + commit all pending change requests (FirstAdmin mode signs server-side).
# Uses /approve, the one lane for every mode: in FirstAdmin it records AND auto-commits.
# Loops until the inbox is empty, because approving one CR unblocks its dependents and freshly
# filed CRs can take a moment to appear.
approve_all_pending() {
  local TOKEN ids id round
  for round in $(seq 1 12); do
    sleep 2
    TOKEN="$(get_token)"
    ids=$(curl -s "$TIDECLOAK_URL/admin/realms/$REALM_NAME/iga/change-requests?status=PENDING" \
      -H "Authorization: Bearer $TOKEN" -H "Cache-Control: no-store" 2>/dev/null \
      | jq -r 'if type=="array" then (.[] | select(.actionType | IN("DISABLE_IGA","DELETE_REALM","OFFBOARD_REALM") | not) | .id) else empty end' 2>/dev/null || true)
    [ -z "$ids" ] && return 0
    for id in $ids; do
      TOKEN="$(get_token)"
      curl -s -o /dev/null -X POST "$TIDECLOAK_URL/admin/realms/$REALM_NAME/iga/change-requests/$id/approve" \
        -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}' || true
    done
  done
  echo "    WARN: change-request inbox not empty after 12 rounds"
}

user_id() {
  local TOKEN; TOKEN="$(get_token)"
  curl -s "$TIDECLOAK_URL/admin/realms/$REALM_NAME/users?username=$1&exact=true" \
    -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id // empty'
}

for cmd in docker curl jq; do
  command -v "$cmd" &>/dev/null || { echo "ERROR: $cmd is required but not found."; exit 1; }
done

# RESUME=1 npm run init  — continue an interrupted bootstrap from the "wait for personas" step,
# reusing the existing container, realm and invite links (nothing is recreated).
if [ "${RESUME:-0}" = "1" ]; then
  echo "==> RESUME: restarting existing container $CONTAINER_NAME..."
  docker start "$CONTAINER_NAME" > /dev/null
  for i in $(seq 1 48); do curl -sf "$TIDECLOAK_URL" > /dev/null 2>&1 && break; sleep 5; done
  curl -sf "$TIDECLOAK_URL" > /dev/null 2>&1 || { echo "ERROR: TideCloak did not come back. docker logs $CONTAINER_NAME"; exit 1; }
  echo "    TideCloak is ready."
  # Still FirstAdmin while personas are not linked: drain whatever is pending (e.g. role grants or
  # boot-time claim backfills), then mint fresh invite links for every persona not yet linked.
  approve_all_pending
  echo "==> Regenerating invite links for personas not yet linked..."
  : > "$INVITES_OUTPUT"
  TOKEN="$(get_token)"
  ALL=$(curl -s "$TIDECLOAK_URL/admin/realms/$REALM_NAME/users?max=100&briefRepresentation=false" -H "Authorization: Bearer $TOKEN")
  for entry in "${CAST[@]}"; do
    u="${entry%%:*}"
    k=$(echo "$ALL" | jq -r --arg u "$u" '.[] | select(.username==$u) | .attributes.tideUserKey[0] // empty')
    [ -n "$k" ] && { printf '%-10s %s
' "$u" "(already linked)" | tee -a "$INVITES_OUTPUT"; continue; }
    uid="$(user_id "$u")"
    [ -z "$uid" ] && { echo "ERROR: persona $u does not exist in realm $REALM_NAME" >&2; exit 1; }
    TOKEN="$(get_token)"
    link=$(curl -s -X POST "$TIDECLOAK_URL/admin/realms/$REALM_NAME/tideAdminResources/get-required-action-link?userId=$uid&lifespan=43200"       -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '["link-tide-account-action"]')
    printf '%-10s %s
' "$u" "$link" | tee -a "$INVITES_OUTPUT"
  done
elif [ "${KEEP_CONTAINER:-0}" = "1" ] && curl -sf "$TIDECLOAK_URL" > /dev/null 2>&1; then
  # KEEP_CONTAINER=1: reuse the running TideCloak, drop only the realm (used to retry licensing).
  echo "==> KEEP_CONTAINER: deleting realm '$REALM_NAME' (if any) on the running TideCloak..."
  TOKEN="$(get_token)"
  curl -s -o /dev/null -X DELETE "$TIDECLOAK_URL/admin/realms/$REALM_NAME" -H "Authorization: Bearer $TOKEN" || true
  sleep 2
fi
if [ "${RESUME:-0}" != "1" ]; then
if [ "${KEEP_CONTAINER:-0}" != "1" ]; then

# --- Step 1: Clean previous state ---
echo "==> Cleaning previous state..."
docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker volume rm "$VOLUME_NAME" >/dev/null 2>&1 || true
mkdir -p "$PROJECT_DIR/data"
if curl -s -o /dev/null "$TIDECLOAK_URL" 2>/dev/null; then
  echo "ERROR: something is already listening on $TIDECLOAK_URL." >&2
  exit 1
fi

# --- Step 2: Start container (production Tide network; do not pass ORK/threshold vars) ---
echo "==> Starting TideCloak ($TIDECLOAK_IMAGE)..."
# No volume: the H2 database lives in the container layer, which survives `docker stop/start`
# (a root-owned named volume is not writable by the keycloak user). `docker rm` wipes the realm.
MSYS_NO_PATHCONV=1 docker run -d --name "$CONTAINER_NAME" \
  -p 8080:8080 \
  -e KC_BOOTSTRAP_ADMIN_USERNAME="$KC_BOOTSTRAP_ADMIN_USERNAME" \
  -e KC_BOOTSTRAP_ADMIN_PASSWORD="$KC_BOOTSTRAP_ADMIN_PASSWORD" \
  "$TIDECLOAK_IMAGE" > /dev/null

echo "==> Waiting for TideCloak to start..."
for i in $(seq 1 48); do
  curl -sf "$TIDECLOAK_URL" > /dev/null 2>&1 && break
  sleep 5
done
curl -sf "$TIDECLOAK_URL" > /dev/null 2>&1 || { echo "ERROR: TideCloak did not start. docker logs $CONTAINER_NAME"; exit 1; }
echo "    TideCloak is ready."
fi  # end of container (re)creation (skipped with KEEP_CONTAINER=1)

# --- Step 3: Create realm from template ---
echo "==> Creating realm '$REALM_NAME'..."
TMP_REALM="$(mktemp)"
sed -e "s|REALM_NAME|$REALM_NAME|g" -e "s|CLIENT_NAME|$CLIENT_NAME|g" -e "s|CLIENT_APP_URL|$CLIENT_APP_URL|g" \
  "$SCRIPT_DIR/realm.json.template" > "$TMP_REALM"
TOKEN="$(get_token)"
REALM_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$TIDECLOAK_URL/admin/realms" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @"$TMP_REALM")
rm -f "$TMP_REALM"
[[ "$REALM_STATUS" =~ ^2 ]] || { echo "ERROR: Realm import failed (HTTP $REALM_STATUS)."; exit 1; }

# --- Step 3b: no Keycloak "Update Account Information" page (before IGA) ---
echo "==> Disabling the first-broker-login profile page..."
TOKEN="$(get_token)"
RP_EXEC="$(curl -s "$TIDECLOAK_URL/admin/realms/$REALM_NAME/authentication/flows/first%20broker%20login/executions" -H "Authorization: Bearer $TOKEN")"
RP_CFG="$(printf '%s' "$RP_EXEC" | jq -r '.[]? | select(.providerId=="idp-review-profile") | .authenticationConfig // empty' | head -1)"
RP_ID="$(printf '%s' "$RP_EXEC" | jq -r '.[]? | select(.providerId=="idp-review-profile") | .id' | head -1)"
RP_BODY='{"alias":"review profile config","config":{"update.profile.on.first.login":"off"}}'
if [ -n "$RP_CFG" ]; then
  curl -s -o /dev/null -X PUT "$TIDECLOAK_URL/admin/realms/$REALM_NAME/authentication/config/$RP_CFG" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$RP_BODY"
elif [ -n "$RP_ID" ]; then
  curl -s -o /dev/null -X POST "$TIDECLOAK_URL/admin/realms/$REALM_NAME/authentication/executions/$RP_ID/config" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$RP_BODY"
fi

# --- Step 4: License realm (VRK on the Tide network) ---
echo "==> Initializing Tide realm (license + VRK)..."
TOKEN="$(get_token)"
SETUP_BODY="$(mktemp)"
SETUP_CODE="$(curl -s -o "$SETUP_BODY" -w '%{http_code}' -X POST "$TIDECLOAK_URL/admin/realms/$REALM_NAME/vendorResources/setUpTideRealm" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "email=$LICENSE_EMAIL" --data-urlencode "isRagnarokEnabled=true")" || SETUP_CODE="000"
SETUP_OUT="$(head -c 600 "$SETUP_BODY" 2>/dev/null || true)"; rm -f "$SETUP_BODY"
case "$SETUP_CODE" in
  2??) : ;;
  *) echo "ERROR: setUpTideRealm failed (HTTP $SETUP_CODE): $SETUP_OUT" >&2; exit 1 ;;
esac
case "$SETUP_OUT" in *NEED_PAYMENT*) echo "ERROR: realm NOT licensed (NEED_PAYMENT)." >&2; exit 1 ;; esac
echo "    licensed: $(echo "$SETUP_OUT" | head -c 80)"

echo "==> Stamping iga.attestor=tide..."
TOKEN="$(get_token)"
REALM_REP=$(curl -s "$TIDECLOAK_URL/admin/realms/$REALM_NAME" -H "Authorization: Bearer $TOKEN")
echo "$REALM_REP" | jq '.attributes = ((.attributes // {}) + {"iga.attestor":"tide"})' > "$PROJECT_DIR/data/.realm-rep.json"
curl -s -X PUT "$TIDECLOAK_URL/admin/realms/$REALM_NAME" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" --data-binary @"$PROJECT_DIR/data/.realm-rep.json" > /dev/null
rm -f "$PROJECT_DIR/data/.realm-rep.json"

echo "==> Enabling IGA..."
TOKEN="$(get_token)"
IGA_NOW="$(curl -s "$TIDECLOAK_URL/admin/realms/$REALM_NAME" -H "Authorization: Bearer $TOKEN" | jq -r '.attributes.isIGAEnabled // "false"' | tr '[:upper:]' '[:lower:]')"
if [ "$IGA_NOW" != "true" ]; then
  IGA_OUT="$(curl -s -X POST "$TIDECLOAK_URL/admin/realms/$REALM_NAME/tide-admin/toggle-iga" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/x-www-form-urlencoded" --data-urlencode "isIGAEnabled=true")"
  case "$IGA_OUT" in *'"enabled":true'*) : ;; *) echo "ERROR: toggle-iga: $IGA_OUT" >&2; exit 1 ;; esac
  case "$IGA_OUT" in *'"warnings"'*|*commitFailures*) echo "WARNING: toggle-iga reported: $IGA_OUT" >&2 ;; esac
fi
sleep 2
approve_all_pending

# --- Step 5: Create the demo cast (FirstAdmin: auto-committed) ---
echo "==> Creating demo users..."
for entry in "${CAST[@]}"; do
  u="${entry%%:*}"
  if [ "$u" = "$FIRST_ADMIN" ]; then
    body="{\"username\":\"$u\",\"email\":\"$LICENSE_EMAIL\",\"enabled\":true,\"emailVerified\":false,\"attributes\":{\"tideInvitable\":[\"true\"]}}"
  else
    # The realm's user profile requires an email. These are SYNTHETIC demo personas, so they get
    # an address on the reserved .invalid TLD (RFC 2606): it can never belong to a real person.
    body="{\"username\":\"$u\",\"email\":\"$u@veil-demo.invalid\",\"enabled\":true,\"emailVerified\":false,\"attributes\":{\"tideInvitable\":[\"true\"]}}"
  fi
  TOKEN="$(get_token)"
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$TIDECLOAK_URL/admin/realms/$REALM_NAME/users" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$body")
  echo "    create $u -> $code"
done
sleep 2
approve_all_pending

echo "==> Assigning VEIL app roles (non-privileged)..."
for entry in "${CAST[@]}"; do
  u="${entry%%:*}"; role="${entry#*:}"
  [ -z "$role" ] && continue
  uid="$(user_id "$u")"
  [ -z "$uid" ] && { echo "ERROR: user $u not found after create"; exit 1; }
  TOKEN="$(get_token)"
  ROLE_REP=$(curl -s "$TIDECLOAK_URL/admin/realms/$REALM_NAME/roles/$role" -H "Authorization: Bearer $TOKEN")
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$TIDECLOAK_URL/admin/realms/$REALM_NAME/users/$uid/role-mappings/realm" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "[$ROLE_REP]")
  echo "    $u += $role -> $code"
done
sleep 2
approve_all_pending

# --- Step 6: Invite links (each person links a Tide account) ---
echo "==> Generating invite links..."
: > "$INVITES_OUTPUT"
for entry in "${CAST[@]}"; do
  u="${entry%%:*}"
  uid="$(user_id "$u")"
  TOKEN="$(get_token)"
  link=$(curl -s -X POST "$TIDECLOAK_URL/admin/realms/$REALM_NAME/tideAdminResources/get-required-action-link?userId=$uid&lifespan=43200" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '["link-tide-account-action"]')
  printf '%-10s %s\n' "$u" "$link" | tee -a "$INVITES_OUTPUT"
done
echo ""
echo "============================================================================"
echo " Open each link (ideally a fresh private window each) and create/link a Tide"
echo " account for that persona. Links saved to: $INVITES_OUTPUT"
echo "============================================================================"
fi  # end of fresh-bootstrap block (skipped with RESUME=1)

echo "Waiting for every persona to link a Tide account (polling every 5s)..."
while true; do
  missing=""
  TOKEN="$(get_token)"
  ALL=$(curl -s "$TIDECLOAK_URL/admin/realms/$REALM_NAME/users?max=100&briefRepresentation=false" -H "Authorization: Bearer $TOKEN")
  for entry in "${CAST[@]}"; do
    u="${entry%%:*}"
    k=$(echo "$ALL" | jq -r --arg u "$u" '.[] | select(.username==$u) | .attributes.tideUserKey[0] // empty')
    [ -z "$k" ] && missing="$missing $u"
  done
  [ -z "$missing" ] && { echo "  All personas linked."; break; }
  printf '  still waiting for:%s            \r' "$missing"
  sleep 5
done

sleep 2
approve_all_pending

# --- Step 7: CustomAdminUIDomain + sign IdP settings (still FirstAdmin) ---
echo "==> Signing IdP settings..."
TIDE_CONSOLE_ORIGIN="$TIDECLOAK_URL/realms/$REALM_NAME/tide-console/"
TOKEN="$(get_token)"
INST=$(curl -s "$TIDECLOAK_URL/admin/realms/$REALM_NAME/identity-provider/instances/tide" -H "Authorization: Bearer $TOKEN")
echo "$INST" | jq --arg d "$TIDE_CONSOLE_ORIGIN" '.config.CustomAdminUIDomain=$d' > "$PROJECT_DIR/data/.idp.json"
curl -s -X PUT "$TIDECLOAK_URL/admin/realms/$REALM_NAME/identity-provider/instances/tide" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @"$PROJECT_DIR/data/.idp.json" > /dev/null
rm -f "$PROJECT_DIR/data/.idp.json"
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$TIDECLOAK_URL/admin/realms/$REALM_NAME/vendorResources/sign-idp-settings" -H "Authorization: Bearer $TOKEN")
echo "    sign-idp-settings -> $code"

# --- Step 8: security committee = tide-realm-admin for the three staff accounts ---
# The first committed grant flips FirstAdmin -> multiAdmin. To avoid enclave approvals for the
# other two, all three grants are filed and AUTHORISED (server-signed, FirstAdmin) before any is
# committed; then each is committed. Whatever TideCloak keeps PENDING after the flip is reported.
echo "==> Granting tide-realm-admin to the security committee: ${COMMITTEE[*]}..."
TOKEN="$(get_token)"
RM_UUID=$(curl -s "$TIDECLOAK_URL/admin/realms/$REALM_NAME/clients?clientId=realm-management" -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')
ROLE_JSON=$(curl -s "$TIDECLOAK_URL/admin/realms/$REALM_NAME/clients/$RM_UUID/roles/tide-realm-admin" -H "Authorization: Bearer $TOKEN")
for u in "${COMMITTEE[@]}"; do
  uid="$(user_id "$u")"
  TOKEN="$(get_token)"
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$TIDECLOAK_URL/admin/realms/$REALM_NAME/users/$uid/role-mappings/clients/$RM_UUID"     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "[$ROLE_JSON]")
  echo "    file grant for $u -> $code"
done
sleep 3
TOKEN="$(get_token)"
GRANT_IDS=$(curl -s "$TIDECLOAK_URL/admin/realms/$REALM_NAME/iga/change-requests?status=PENDING" -H "Authorization: Bearer $TOKEN" -H "Cache-Control: no-store"   | jq -r '.[] | select(.actionType=="GRANT_ROLES") | .id')
for id in $GRANT_IDS; do
  TOKEN="$(get_token)"
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$TIDECLOAK_URL/admin/realms/$REALM_NAME/iga/change-requests/$id/authorize"     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}')
  echo "    authorise $id -> $code"
done
for id in $GRANT_IDS; do
  TOKEN="$(get_token)"
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$TIDECLOAK_URL/admin/realms/$REALM_NAME/iga/change-requests/$id/commit" -H "Authorization: Bearer $TOKEN")
  echo "    commit $id -> $code"
done
echo "==> Final drain (anything else pending while it is still allowed)..."
approve_all_pending || true
TOKEN="$(get_token)"
ADMINS_NOW=$(curl -s "$TIDECLOAK_URL/admin/realms/$REALM_NAME/clients/$RM_UUID/roles/tide-realm-admin/users" -H "Authorization: Bearer $TOKEN" | jq -r '[.[].username] | join(", ")')
echo "    tide-realm-admin now: ${ADMINS_NOW:-<none>}"

# --- Step 9: Export adapter JSON ---
echo "==> Exporting adapter config..."
TOKEN="$(get_token)"
CLIENT_UUID=$(curl -s "$TIDECLOAK_URL/admin/realms/$REALM_NAME/clients?clientId=$CLIENT_NAME" -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')
curl -s "$TIDECLOAK_URL/admin/realms/$REALM_NAME/vendorResources/get-installations-provider?clientId=$CLIENT_UUID&providerId=keycloak-oidc-keycloak-json" \
  -H "Authorization: Bearer $TOKEN" > "$ADAPTER_OUTPUT"

if jq -e 'has("jwk") and has("vendorId") and has("homeOrkUrl")' "$ADAPTER_OUTPUT" > /dev/null 2>&1; then
  echo ""
  echo "Init complete. Adapter: $ADAPTER_OUTPUT   Realm: $REALM_NAME   Client: $CLIENT_NAME"
  echo "Committee (tide-realm-admin): ${ADMINS_NOW:-<none>}. Anyone missing: approve their pending grant as hr-lead in VEIL > Governance."
else
  echo "WARNING: adapter config may be missing Tide extensions (jwk/vendorId/homeOrkUrl)."
fi
