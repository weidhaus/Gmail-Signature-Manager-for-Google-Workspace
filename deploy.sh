#!/usr/bin/env bash
set -euo pipefail

# ─── Helpers ──────────────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

step() { echo -e "\n${BLUE}${BOLD}▶ $*${NC}"; }
ok()   { echo -e "  ${GREEN}✓${NC} $*"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $*"; }
fail() { echo -e "\n${RED}✗ $*${NC}" >&2; exit 1; }

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KEY_FILE="$REPO_DIR/.service-account-key.json"
CLASP_JSON="$REPO_DIR/.clasp.json"

# ─── Banner ───────────────────────────────────────────────────────────────────

echo -e "${BOLD}"
echo "╔══════════════════════════════════════════════╗"
echo "║   Gmail Signature Manager — Deploy Script    ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# ─── Prerequisites ────────────────────────────────────────────────────────────

step "Checking prerequisites"

command -v gcloud >/dev/null 2>&1 \
  || fail "gcloud CLI not found.\n  Install: https://cloud.google.com/sdk/docs/install"
ok "gcloud  ($(gcloud --version 2>&1 | head -1))"

command -v node >/dev/null 2>&1 \
  || fail "Node.js not found.\n  Install: https://nodejs.org"
NODE_VERSION=$(node --version)
ok "node    $NODE_VERSION"

# Warn if Node.js major version is above 20 (clasp has known incompatibilities)
NODE_MAJOR=$(echo "$NODE_VERSION" | tr -d 'v' | cut -d'.' -f1)
if [[ "$NODE_MAJOR" -gt 20 ]]; then
  warn "Node.js $NODE_VERSION may be incompatible with clasp (v20 LTS recommended)"
  warn "  To install Node 20: nvm install 20 && nvm use 20"
  warn "  Or: brew install node@20 && brew link node@20 --force"
fi

if ! command -v clasp >/dev/null 2>&1; then
  warn "clasp not found — installing globally..."
  npm install -g @google/clasp \
    || fail "Failed to install clasp. Make sure npm is available."
fi

# Verify clasp is actually functional (not just installed)
if ! clasp --version >/dev/null 2>&1; then
  fail "clasp is installed but not working (likely a Node.js version conflict).\n  Try: npm install -g @google/clasp@latest\n  Or switch to Node 20 LTS: nvm install 20 && nvm use 20"
fi
ok "clasp   $(clasp --version 2>/dev/null | tr -d '\n')"

command -v python3 >/dev/null 2>&1 \
  || fail "python3 not found (required for JSON parsing)"
ok "python3 $(python3 --version)"

# ─── Authentication ───────────────────────────────────────────────────────────

step "Authentication"

# Build list of known gcloud accounts
mapfile -t GCLOUD_ACCOUNTS < <(gcloud auth list --format='value(account)' 2>/dev/null)

if [[ ${#GCLOUD_ACCOUNTS[@]} -eq 0 ]]; then
  warn "No gcloud accounts found — opening browser..."
  gcloud auth login
  mapfile -t GCLOUD_ACCOUNTS < <(gcloud auth list --format='value(account)' 2>/dev/null)
fi

# Let the user pick or add another account
echo "  Available gcloud accounts:"
for i in "${!GCLOUD_ACCOUNTS[@]}"; do
  echo "    $((i+1))) ${GCLOUD_ACCOUNTS[$i]}"
done
echo "    $((${#GCLOUD_ACCOUNTS[@]}+1))) Add a different account"
echo ""
read -rp "  Choose account [1]: " ACCT_CHOICE
ACCT_CHOICE="${ACCT_CHOICE:-1}"

if [[ "$ACCT_CHOICE" -eq $((${#GCLOUD_ACCOUNTS[@]}+1)) ]]; then
  gcloud auth login
  mapfile -t GCLOUD_ACCOUNTS < <(gcloud auth list --format='value(account)' 2>/dev/null)
  GCLOUD_ACCOUNT="${GCLOUD_ACCOUNTS[-1]}"
elif [[ "$ACCT_CHOICE" -ge 1 && "$ACCT_CHOICE" -le ${#GCLOUD_ACCOUNTS[@]} ]]; then
  GCLOUD_ACCOUNT="${GCLOUD_ACCOUNTS[$((ACCT_CHOICE-1))]}"
else
  fail "Invalid choice: $ACCT_CHOICE"
fi

gcloud config set account "$GCLOUD_ACCOUNT" --quiet
ok "gcloud: $GCLOUD_ACCOUNT"

if ! clasp whoami >/dev/null 2>&1; then
  warn "Not logged in to clasp — opening browser..."
  clasp login
fi
ok "clasp:  $(clasp whoami 2>/dev/null | tail -1)"

# ─── Configuration ────────────────────────────────────────────────────────────

step "Configuration"
echo ""

# List existing projects and let the user pick one or create new
mapfile -t EXISTING_PROJECTS < <(gcloud projects list --format='value(projectId)' 2>/dev/null)

if [[ ${#EXISTING_PROJECTS[@]} -gt 0 ]]; then
  echo "  Existing GCP projects:"
  for i in "${!EXISTING_PROJECTS[@]}"; do
    echo "    $((i+1))) ${EXISTING_PROJECTS[$i]}"
  done
  echo "    $((${#EXISTING_PROJECTS[@]}+1))) Create a new project"
  echo ""
  read -rp "  Choose project [1]: " PROJ_CHOICE
  PROJ_CHOICE="${PROJ_CHOICE:-1}"

  if [[ "$PROJ_CHOICE" -eq $((${#EXISTING_PROJECTS[@]}+1)) ]]; then
    read -rp "  New project ID (e.g. myorg-gmail-signatures): " PROJECT_ID
    [[ -z "$PROJECT_ID" ]] && fail "Project ID cannot be empty"
    read -rp "  Display name [Gmail Signature Manager]: " PROJECT_NAME
    PROJECT_NAME="${PROJECT_NAME:-Gmail Signature Manager}"
    NEW_PROJECT=true
  elif [[ "$PROJ_CHOICE" -ge 1 && "$PROJ_CHOICE" -le ${#EXISTING_PROJECTS[@]} ]]; then
    PROJECT_ID="${EXISTING_PROJECTS[$((PROJ_CHOICE-1))]}"
    PROJECT_NAME="$PROJECT_ID"
    NEW_PROJECT=false
  else
    fail "Invalid choice: $PROJ_CHOICE"
  fi
else
  read -rp "  New project ID (e.g. myorg-gmail-signatures): " PROJECT_ID
  [[ -z "$PROJECT_ID" ]] && fail "Project ID cannot be empty"
  read -rp "  Display name [Gmail Signature Manager]: " PROJECT_NAME
  PROJECT_NAME="${PROJECT_NAME:-Gmail Signature Manager}"
  NEW_PROJECT=true
fi

SA_NAME="gmail-sig-manager"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo ""
echo "  Organisation settings (written into config.js before pushing):"
read -rp "  Workspace domain (e.g. yourcompany.com): " ORG_DOMAIN
[[ -z "$ORG_DOMAIN" ]] && fail "Domain cannot be empty"

read -rp "  Admin email (must have super-admin rights): " ORG_ADMIN_EMAIL
[[ -z "$ORG_ADMIN_EMAIL" ]] && fail "Admin email cannot be empty"

read -rp "  Test user email (any real user in the domain): " ORG_TEST_USER
[[ -z "$ORG_TEST_USER" ]] && fail "Test user email cannot be empty"

echo ""
echo "  Will configure:"
echo "    Project:          $PROJECT_ID  ($PROJECT_NAME)"
echo "    Service account:  $SA_EMAIL"
echo "    Key file:         $KEY_FILE"
echo "    Domain:           $ORG_DOMAIN"
echo "    Admin:            $ORG_ADMIN_EMAIL"
echo "    Test user:        $ORG_TEST_USER"
echo ""
read -rp "  Proceed? [y/N] " CONFIRM
[[ "${CONFIRM:-n}" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }

# ─── GCP: Project ─────────────────────────────────────────────────────────────

step "GCP project"

if [[ "$NEW_PROJECT" == true ]]; then
  gcloud projects create "$PROJECT_ID" --name="$PROJECT_NAME" \
    || fail "Project creation failed.\n  If this is a quota issue, try a different project ID or use an existing one."
  ok "Created project: $PROJECT_ID"
else
  ok "Using existing project: $PROJECT_ID"
fi

gcloud config set project "$PROJECT_ID" --quiet

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
ok "Project number: $PROJECT_NUMBER"

# ─── GCP: APIs ────────────────────────────────────────────────────────────────

step "Enabling APIs"

gcloud services enable \
  admin.googleapis.com \
  gmail.googleapis.com \
  script.googleapis.com \
  drive.googleapis.com \
  --quiet

ok "admin.googleapis.com"
ok "gmail.googleapis.com"
ok "script.googleapis.com"
ok "drive.googleapis.com"

# ─── GCP: Service account ─────────────────────────────────────────────────────

step "Service account"

if gcloud iam service-accounts describe "$SA_EMAIL" >/dev/null 2>&1; then
  warn "Service account already exists — skipping creation"
else
  gcloud iam service-accounts create "$SA_NAME" \
    --display-name="Gmail Signature Manager"
  ok "Created: $SA_EMAIL"

  # Wait for the service account to propagate before creating a key
  echo -n "  Waiting for service account to propagate"
  for _ in {1..12}; do
    sleep 5
    echo -n "."
    if gcloud iam service-accounts describe "$SA_EMAIL" >/dev/null 2>&1; then
      echo ""
      break
    fi
  done
fi

# ─── GCP: Service account key ─────────────────────────────────────────────────

step "Service account key"

if [[ -f "$KEY_FILE" ]] && python3 -c "import json; json.load(open('$KEY_FILE'))" 2>/dev/null; then
  warn "Key file already exists — skipping (delete it to regenerate)"
else
  # Remove any empty/corrupt file left by a previous failed run
  rm -f "$KEY_FILE"
  # Retry key creation in case of propagation delay
  for attempt in 1 2 3; do
    if gcloud iam service-accounts keys create "$KEY_FILE" \
        --iam-account="$SA_EMAIL" 2>/dev/null; then
      ok "Saved: $KEY_FILE"
      break
    fi
    [[ "$attempt" -eq 3 ]] && fail "Failed to create service account key after 3 attempts"
    warn "Key creation failed (attempt $attempt/3) — retrying in 10s..."
    sleep 10
  done
fi

python3 - "$KEY_FILE" <<'PYEOF' || fail "Service account key file is invalid — delete it and re-run to regenerate"
import json, sys
path = sys.argv[1]
try:
    key = json.load(open(path))
except Exception as e:
    print(f"ERROR: Cannot parse key file: {e}", file=sys.stderr); sys.exit(1)
required = ["type", "project_id", "private_key_id", "private_key", "client_email", "client_id"]
missing = [f for f in required if not key.get(f)]
if missing:
    size = len(open(path).read())
    print(f"ERROR: Key file missing fields: {', '.join(missing)} ({size} bytes, expected ~2300+)", file=sys.stderr)
    sys.exit(1)
PYEOF

CLIENT_ID=$(python3 -c "import json; print(json.load(open('$KEY_FILE'))['client_id'])")
CLIENT_EMAIL=$(python3 -c "import json; print(json.load(open('$KEY_FILE'))['client_email'])")
KEY_SIZE=$(wc -c < "$KEY_FILE" | tr -d ' ')
ok "Service account client ID: $CLIENT_ID"
ok "Key file size: ${KEY_SIZE} bytes"

# ─── GCP: OAuth consent screen + client ID ────────────────────────────────────

step "OAuth consent screen + client ID"

CONSENT_URL="https://console.cloud.google.com/apis/credentials/consent?project=$PROJECT_ID"
OAUTH_CLIENT_URL="https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID"

echo "  This step cannot be automated — opening the GCP Console now."
echo ""
echo "  Step A — Configure OAuth consent screen:"
echo "    $CONSENT_URL"
echo "    → Get started → User type: Internal → Create"
echo "    → Fill in App name + support email → Save and continue (through all screens)"
echo ""
open "$CONSENT_URL" 2>/dev/null || xdg-open "$CONSENT_URL" 2>/dev/null || true
read -rp "  Press Enter once the consent screen is saved..."

echo ""
echo "  Step B — Create OAuth client ID:"
echo "    $OAUTH_CLIENT_URL"
echo "    → Application type: Web application → Name: Gmail Signature Manager → Create"
echo "    → Copy the numeric Client ID shown in the confirmation dialog"
echo ""
open "$OAUTH_CLIENT_URL" 2>/dev/null || xdg-open "$OAUTH_CLIENT_URL" 2>/dev/null || true
read -rp "  Paste the numeric OAuth Client ID here: " OAUTH_CLIENT_NUMERIC_ID
[[ -z "$OAUTH_CLIENT_NUMERIC_ID" ]] && warn "No client ID entered — domain-wide delegation URL will be incomplete"

# ─── Apps Script: push ────────────────────────────────────────────────────────

step "Apps Script"

cd "$REPO_DIR"

if [[ -f "$CLASP_JSON" ]]; then
  SCRIPT_ID=$(python3 -c "import json; print(json.load(open('$CLASP_JSON'))['scriptId'])")
  warn ".clasp.json found — pushing to existing project ($SCRIPT_ID)"
else
  clasp create --title "Gmail Signature Manager" --type standalone \
    || fail "clasp create failed. Make sure the Apps Script API is enabled for your Google account:\n  https://script.google.com/home/usersettings"
  SCRIPT_ID=$(python3 -c "import json; print(json.load(open('$CLASP_JSON'))['scriptId'])")
  # clasp create overwrites appsscript.json with a minimal remote version — restore ours
  git checkout appsscript.json 2>/dev/null || true
  ok "Created Apps Script project: $SCRIPT_ID"
fi

# Patch config.js with real org values before pushing
python3 - "$REPO_DIR/config.js" "$ORG_DOMAIN" "$ORG_ADMIN_EMAIL" "$ORG_TEST_USER" <<'PYEOF'
import sys, re
path, domain, admin, testuser = sys.argv[1:]
text = open(path).read()
text = re.sub(r'(searchDomain:\s*")[^"]*(")', rf'\g<1>{domain}\2', text)
text = re.sub(r'(adminEmail:\s*")[^"]*(")', rf'\g<1>{admin}\2', text)
text = re.sub(r'(testUserEmail:\s*")[^"]*(")', rf'\g<1>{testuser}\2', text)
open(path, 'w').write(text)
PYEOF
ok "config.js updated with domain=$ORG_DOMAIN, admin=$ORG_ADMIN_EMAIL"

clasp push --force
ok "Files pushed to Apps Script"

# ─── Done ─────────────────────────────────────────────────────────────────────

DWD_SCOPES="https://www.googleapis.com/auth/gmail.settings.basic,https://www.googleapis.com/auth/admin.directory.user.readonly,https://www.googleapis.com/auth/script.external_request"
DWD_SCOPES_ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$DWD_SCOPES'))")

echo ""
echo -e "${BOLD}${GREEN}━━━ Automated setup complete ✓ ━━━${NC}"
echo ""

MANUAL_STEP=0

# Only show OAuth step if automation didn't handle it
if [[ -z "$OAUTH_CLIENT_NUMERIC_ID" ]]; then
  MANUAL_STEP=$((MANUAL_STEP+1))
  echo -e "${BOLD}  $MANUAL_STEP. Create OAuth consent screen + client ID${NC}"
  echo "     a. Open: https://console.cloud.google.com/apis/credentials/consent?project=$PROJECT_ID"
  echo "        → Get started → User type: Internal → Create"
  echo "        → Fill in App name + support email → Save"
  echo "     b. Open: https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID"
  echo "        → + Create Credentials → OAuth client ID"
  echo "        → Application type: Web application → Create"
  echo "        → Copy the numeric Client ID (you'll need it for step $((MANUAL_STEP+2)))"
  echo ""
fi

MANUAL_STEP=$((MANUAL_STEP+1))
echo -e "${BOLD}  $MANUAL_STEP. Link GCP project to Apps Script${NC}"
echo "     Open:  https://script.google.com/d/$SCRIPT_ID/edit"
echo "     ⚙ Project Settings → Change project → enter: $PROJECT_NUMBER → Set project"
echo ""

MANUAL_STEP=$((MANUAL_STEP+1))
echo -e "${BOLD}  $MANUAL_STEP. Add service account key to Script Properties${NC}"
echo "     In the same editor:"
echo "     ⚙ Project Settings → Script Properties → + Add property"
echo "     Name:  SERVICE_ACCOUNT_KEY"
echo "     Value: (paste the entire contents of .service-account-key.json)"
echo ""

MANUAL_STEP=$((MANUAL_STEP+1))
DWD_URL="https://admin.google.com/ac/owl/domainwidedelegation"
echo -e "${BOLD}  $MANUAL_STEP. Configure domain-wide delegation${NC}"
echo "     Open: $DWD_URL"
echo "     → Add new"
echo ""
echo "     Client ID  →  $CLIENT_ID"
echo "     (This is the service account's client ID, from .service-account-key.json)"
echo ""
echo "     Scopes  →  copy the block below:"
echo ""
echo "       $DWD_SCOPES"
echo ""
echo "     → Authorize"
open "$DWD_URL" 2>/dev/null || xdg-open "$DWD_URL" 2>/dev/null || true
echo ""

echo -e "${BOLD}  Verify:${NC}"
echo "     Apps Script editor → Run → runAllTests()"
echo ""
echo -e "  ${YELLOW}⚠${NC}  $KEY_FILE grants broad org access — keep it out of version control"
echo ""
