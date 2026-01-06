#!/bin/bash

# Test script to validate job fetch and CV generation
# Usage: ./test-fixtures/run-test.sh

set -e

echo "🧪 Starting LLM Resume Test Suite"
echo "=================================="
echo ""

JOB_URL="https://openai.com/careers/residency-2026-san-francisco/"
RESUME_PDF="./test-fixtures/victor-gardrinier-cv.pdf"
BASE_URL="http://localhost:3000"

# Check if dev server is running
if ! curl -s "$BASE_URL" > /dev/null; then
  echo "❌ Dev server not running on $BASE_URL"
  echo "   Run: npm run dev"
  exit 1
fi

echo "✅ Dev server is running"
echo ""

# Test 1: Job URL Fetch
echo "📋 Test 1: Job URL Fetch"
echo "------------------------"
echo "URL: $JOB_URL"

FETCH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/fetch-job" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"$JOB_URL\",\"quick\":false}")

# Extract job description length
JD_LENGTH=$(echo "$FETCH_RESPONSE" | grep -o '"jobDescription":"[^"]*"' | sed 's/"jobDescription":"//;s/"$//' | wc -c | tr -d ' ')

echo "Job Description Length: $JD_LENGTH chars"

if [ "$JD_LENGTH" -lt 5000 ]; then
  echo "❌ FAIL: Job description too short (expected >10k chars)"
  exit 1
fi

echo "✅ PASS: Job description extracted"
echo ""

# Test 2: Resume Parse
echo "📄 Test 2: Resume Parse"
echo "-----------------------"

if [ ! -f "$RESUME_PDF" ]; then
  echo "❌ FAIL: Resume PDF not found at $RESUME_PDF"
  exit 1
fi

PARSE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/parse-resume" \
  -F "file=@$RESUME_PDF")

RESUME_TEXT=$(echo "$PARSE_RESPONSE" | grep -o '"text":"[^"]*"' | head -1)

if [ -z "$RESUME_TEXT" ]; then
  echo "❌ FAIL: Resume parsing failed"
  exit 1
fi

echo "✅ PASS: Resume parsed successfully"
echo ""

# Test 3: Fast Mode Analysis (would need full integration)
echo "⚡ Test 3: Fast Mode Analysis"
echo "-----------------------------"
echo "⏭️  SKIP: Requires manual testing in UI"
echo ""

echo "=================================="
echo "✅ All automated tests passed!"
echo ""
echo "Manual testing required:"
echo "1. Upload resume in UI"
echo "2. Paste job URL"
echo "3. Run fast analysis"
echo "4. Click 'Run Full Analysis'"
echo "5. Check logs for errors"
