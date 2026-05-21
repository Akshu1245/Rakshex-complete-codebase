#!/bin/sh
set -e

echo "🔍 Rakshex Security Scan starting..."
echo "API URL: $RAKSHEX_API_URL"

# Extract PR info from GitHub event
PR_NUMBER=$(jq -r '.pull_request.number' "$GITHUB_EVENT_PATH")
REPO=$(echo "$GITHUB_REPOSITORY" | cut -d'/' -f2)
OWNER=$(echo "$GITHUB_REPOSITORY" | cut -d'/' -f1)
HEAD_SHA=$(jq -r '.pull_request.head.sha' "$GITHUB_EVENT_PATH")
BASE_SHA=$(jq -r '.pull_request.base.sha' "$GITHUB_EVENT_PATH")

echo "Repository: $OWNER/$REPO"
echo "PR: #$PR_NUMBER"
echo "Head: $HEAD_SHA"
echo "Base: $BASE_SHA"

# Build scan payload
PAYLOAD='{
  "repository": "'"$GITHUB_REPOSITORY"'",
  "prNumber": '"$PR_NUMBER"',
  "headSha": "'"$HEAD_SHA"'",
  "baseSha": "'"$BASE_SHA"'",
  "filesChanged": []
}'

# Get changed files
if [ -n "$PR_NUMBER" ] && [ "$PR_NUMBER" != "null" ]; then
  echo "📁 Fetching changed files..."
  CHANGED_FILES=$(curl -s -H "Authorization: token $GITHUB_TOKEN"     "https://api.github.com/repos/$GITHUB_REPOSITORY/pulls/$PR_NUMBER/files" |     jq -r '.[].filename' | tr '\n' ',' | sed 's/,$//')
  echo "Changed: $CHANGED_FILES"
fi

# Detect framework and routes
FRAMEWORK="unknown"
if [ -f "package.json" ]; then
  if grep -q "express" package.json 2>/dev/null; then FRAMEWORK="express"; fi
  if grep -q "fastify" package.json 2>/dev/null; then FRAMEWORK="fastify"; fi
  if grep -q "@nestjs" package.json 2>/dev/null; then FRAMEWORK="nestjs"; fi
fi
if [ -f "requirements.txt" ]; then
  if grep -q "fastapi" requirements.txt 2>/dev/null; then FRAMEWORK="fastapi"; fi
  if grep -q "flask" requirements.txt 2>/dev/null; then FRAMEWORK="flask"; fi
  if grep -q "django" requirements.txt 2>/dev/null; then FRAMEWORK="django"; fi
fi
if [ -f "go.mod" ]; then FRAMEWORK="go"; fi
if [ -f "Cargo.toml" ]; then FRAMEWORK="rust"; fi

echo "🔧 Detected framework: $FRAMEWORK"

# Run scan via Rakshex API
echo "🚀 Sending scan request to Rakshex..."

SCAN_PAYLOAD=$(cat <<EOF
{
  "repository": "$GITHUB_REPOSITORY",
  "prNumber": $PR_NUMBER,
  "headSha": "$HEAD_SHA",
  "baseSha": "$BASE_SHA",
  "framework": "$FRAMEWORK",
  "changedFiles": $(echo "$CHANGED_FILES" | jq -R 'split(",")' 2>/dev/null || echo '[]'),
  "openapiPath": "${SCAN_OPENAPI:-}",
  "postmanPath": "${SCAN_POSTMAN:-}"
}
EOF
)

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$RAKSHEX_API_URL/api/github/scan"   -H "Authorization: Bearer $RAKSHEX_API_KEY"   -H "Content-Type: application/json"   -d "$SCAN_PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ Scan failed (HTTP $HTTP_CODE)"
  echo "$BODY"
  exit 1
fi

echo "✅ Scan complete"

# Parse findings
FINDINGS=$(echo "$BODY" | jq '.findings // []')
TOTAL=$(echo "$FINDINGS" | jq 'length')
CRITICAL=$(echo "$FINDINGS" | jq '[.[] | select(.severity=="Critical")] | length')
HIGH=$(echo "$FINDINGS" | jq '[.[] | select(.severity=="High")] | length')
MEDIUM=$(echo "$FINDINGS" | jq '[.[] | select(.severity=="Medium")] | length')
LOW=$(echo "$FINDINGS" | jq '[.[] | select(.severity=="Low")] | length')
COST_ANOMALIES=$(echo "$BODY" | jq '.costAnomalies // []')
SHADOW_APIS=$(echo "$BODY" | jq '.shadowApis // []')

echo ""
echo "📊 Results:"
echo "  Total findings: $TOTAL"
echo "  Critical: $CRITICAL"
echo "  High: $HIGH"
echo "  Medium: $MEDIUM"
echo "  Low: $LOW"
echo "  Cost anomalies: $(echo "$COST_ANOMALIES" | jq 'length')"
echo "  Shadow APIs: $(echo "$SHADOW_APIS" | jq 'length')"

# Generate PR comment
if [ "$POST_COMMENT" = "true" ] && [ -n "$PR_NUMBER" ] && [ "$PR_NUMBER" != "null" ]; then
  echo "💬 Posting PR comment..."

  COMMENT=$(node /action/pr-comment.js "$BODY" "$FRAMEWORK")

  curl -s -X POST     -H "Authorization: token $GITHUB_TOKEN"     -H "Content-Type: application/json"     "https://api.github.com/repos/$GITHUB_REPOSITORY/issues/$PR_NUMBER/comments"     -d "{"body": $(echo "$COMMENT" | jq -s -R .)}" > /dev/null

  echo "✅ PR comment posted"
fi

# Determine exit code
if [ "$FAIL_ON_CRITICAL" = "true" ] && [ "$CRITICAL" -gt 0 ]; then
  echo "❌ Critical findings found. Failing workflow."
  exit 1
fi

if [ "$FAIL_ON_HIGH" = "true" ] && [ "$HIGH" -gt 0 ]; then
  echo "❌ High findings found. Failing workflow."
  exit 1
fi

echo "✅ Rakshex scan complete."
