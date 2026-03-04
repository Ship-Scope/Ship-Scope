#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# ShipScope Production Health Check
# Usage: ./scripts/healthcheck.sh
# Returns: exit 0 if all checks pass, exit 1 otherwise
# ============================================================

API_URL="${API_URL:-http://localhost:4000}"
WEB_URL="${WEB_URL:-http://localhost:3000}"
FAILED=0

check() {
  local name="$1"
  local url="$2"
  local expected="$3"

  response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")

  if [ "$response" = "$expected" ]; then
    echo "PASS  $name ($response)"
  else
    echo "FAIL  $name (expected $expected, got $response)"
    FAILED=1
  fi
}

echo "ShipScope Health Check"
echo "======================"
echo ""

check "API Health"          "$API_URL/api/health"     "200"
check "API Feedback List"   "$API_URL/api/feedback"   "200"
check "API Themes List"     "$API_URL/api/themes"     "200"
check "API Proposals List"  "$API_URL/api/proposals"  "200"
check "API Settings"        "$API_URL/api/settings"   "200"

check "Web Home"            "$WEB_URL/"               "200"
check "Web SPA Route"       "$WEB_URL/feedback"       "200"
check "Web SPA Route"       "$WEB_URL/themes"         "200"

powered_by=$(curl -s -I "$API_URL/api/health" | grep -i "x-powered-by" || true)
if [ -z "$powered_by" ]; then
  echo "PASS  X-Powered-By hidden"
else
  echo "FAIL  X-Powered-By exposed: $powered_by"
  FAILED=1
fi

csp=$(curl -s -I "$API_URL/api/health" | grep -i "content-security-policy" || true)
if [ -n "$csp" ]; then
  echo "PASS  CSP header present"
else
  echo "FAIL  CSP header missing"
  FAILED=1
fi

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "All checks passed."
  exit 0
else
  echo "Some checks failed!"
  exit 1
fi
