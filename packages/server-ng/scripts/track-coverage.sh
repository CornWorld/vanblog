#!/bin/bash

# Coverage Tracker Script
# Usage: ./track-coverage.sh [commit-message]

set -e

COVERAGE_DIR="coverage"
TRACKING_FILE="docs/coverage-history.md"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
COMMIT_MSG="${1:-Coverage checkpoint}"

echo "📊 Running test coverage..."
pnpm vitest run --coverage 2>&1 | tail -20

if [ ! -f "$COVERAGE_DIR/coverage-summary.json" ]; then
  echo "❌ Coverage report not found. Tests may have failed."
  exit 1
fi

# Extract coverage metrics
LINES=$(cat $COVERAGE_DIR/coverage-summary.json | grep -o '"lines":{"total":[0-9]*,"covered":[0-9]*' | head -1)
TOTAL_LINES=$(echo $LINES | grep -o 'total":[0-9]*' | grep -o '[0-9]*')
COVERED_LINES=$(echo $LINES | grep -o 'covered":[0-9]*' | grep -o '[0-9]*')
LINE_PCT=$(awk "BEGIN {printf \"%.2f\", ($COVERED_LINES/$TOTAL_LINES)*100}")

FUNCS=$(cat $COVERAGE_DIR/coverage-summary.json | grep -o '"functions":{"total":[0-9]*,"covered":[0-9]*' | head -1)
TOTAL_FUNCS=$(echo $FUNCS | grep -o 'total":[0-9]*' | grep -o '[0-9]*')
COVERED_FUNCS=$(echo $FUNCS | grep -o 'covered":[0-9]*' | grep -o '[0-9]*')
FUNC_PCT=$(awk "BEGIN {printf \"%.2f\", ($COVERED_FUNCS/$TOTAL_FUNCS)*100}")

BRANCHES=$(cat $COVERAGE_DIR/coverage-summary.json | grep -o '"branches":{"total":[0-9]*,"covered":[0-9]*' | head -1)
TOTAL_BRANCHES=$(echo $BRANCHES | grep -o 'total":[0-9]*' | grep -o '[0-9]*')
COVERED_BRANCHES=$(echo $BRANCHES | grep -o 'covered":[0-9]*' | grep -o '[0-9]*')
BRANCH_PCT=$(awk "BEGIN {printf \"%.2f\", ($COVERED_BRANCHES/$TOTAL_BRANCHES)*100}")

echo ""
echo "📈 Coverage Results:"
echo "  Lines:     $LINE_PCT% ($COVERED_LINES/$TOTAL_LINES)"
echo "  Functions: $FUNC_PCT% ($COVERED_FUNCS/$TOTAL_FUNCS)"
echo "  Branches:  $BRANCH_PCT% ($COVERED_BRANCHES/$TOTAL_BRANCHES)"
echo ""

# Create tracking file if it doesn't exist
if [ ! -f "$TRACKING_FILE" ]; then
  cat > "$TRACKING_FILE" << 'EOF'
# Coverage History

This file tracks test coverage improvements over time.

| Date | Lines % | Functions % | Branches % | Commit | Notes |
|------|---------|-------------|------------|--------|-------|
EOF
fi

# Append new entry
echo "| $TIMESTAMP | $LINE_PCT% | $FUNC_PCT% | $BRANCH_PCT% | \`$(git rev-parse --short HEAD)\` | $COMMIT_MSG |" >> "$TRACKING_FILE"

echo "✅ Coverage tracked in $TRACKING_FILE"

# Check if coverage meets threshold
if (( $(echo "$LINE_PCT >= 90.0" | bc -l) )); then
  echo ""
  echo "🎉 Coverage goal achieved! ($LINE_PCT% >= 90%)"
  echo ""
else
  REMAINING=$(awk "BEGIN {printf \"%.2f\", 90.0 - $LINE_PCT}")
  echo ""
  echo "🎯 Coverage goal not yet met. Need $REMAINING% more to reach 90%"
  echo ""
fi
