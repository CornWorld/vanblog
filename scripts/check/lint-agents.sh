#!/usr/bin/env bash
# Validate AGENTS.md references — mimic .github/workflows/lint-agents.yml locally.
set -e

# Fall back to PWD if not a git repo (CI uses actions/checkout which is a git repo).
if git rev-parse --show-toplevel >/dev/null 2>&1; then
  cd "$(git rev-parse --show-toplevel)"
else
  echo "⚠ not a git repo, running from $PWD"
fi

echo "=== AGENTS.md size ==="
wc -l AGENTS.md
echo ""

missing=0
# Check references that look like real repo paths:
#   - start with a known top-level dir AND contain a slash
#   - filters out env vars ($X), API symbols (cronAdd), and bare filenames
# Regex matches anything in backticks (including spaces / non-ASCII), then
# known_prefixes + slash check decides whether to validate it as a path.
known_prefixes='^(docs|app|sdk|vault|themes|packs|hooks|scripts|docker|models\.config)'
while IFS= read -r ref; do
  case "$ref" in
    \$*|http*|*=*|*\**|*\$*) continue ;;
  esac
  # Skip documentation placeholders like <rel>, <active>, <domain>.
  case "$ref" in
    *\<*\>*) continue ;;
  esac
  # Must contain a slash to look like a path.
  case "$ref" in
    */*) ;;
    *) continue ;;
  esac
  # Must start with a known repo directory.
  [[ "$ref" =~ $known_prefixes ]] || continue
  if [ ! -e "$ref" ]; then
    echo "❌ AGENTS.md references missing path: $ref"
    missing=$((missing + 1))
  fi
done < <(grep -oE '`[^`]+`' AGENTS.md | tr -d '`' | sort -u)

echo ""
if [ "$missing" -gt 0 ]; then
  echo "FAILED: $missing dangling reference(s)"
  exit 1
fi
echo "✓ All paths referenced in AGENTS.md exist."

echo ""
echo "=== docs/ references ==="
while IFS= read -r f; do
  [ -e "$f" ] || { echo "❌ Missing docs file: $f"; missing=$((missing + 1)); }
done < <(grep -oE 'docs/[a-zA-Z0-9_./-]+\.md' AGENTS.md | sort -u)
[ "$missing" -eq 0 ] || exit 1
echo "✓ All docs/ references resolve."
