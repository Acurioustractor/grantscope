#!/bin/bash
# create-social-impact-kb.sh
# Run this once from ~/Code/grantscope to create your Obsidian vault.
# Then open ~/social-impact-kb in Obsidian as a folder vault.

set -e
VAULT=~/social-impact-kb
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "Creating social-impact-kb vault at $VAULT..."
echo ""

# 1. Create directory structure
mkdir -p "$VAULT"/{raw,wiki/{concepts,entities,connections},outputs/{reports,slides},tools}

# 2. Copy vault template files from repo
cp "$REPO_ROOT/vault-template/AGENTS.md"                     "$VAULT/AGENTS.md"
cp "$REPO_ROOT/vault-template/wiki/_index.md"                "$VAULT/wiki/_index.md"
cp "$REPO_ROOT/vault-template/raw/sample-community-power.md" "$VAULT/raw/sample-community-power.md"

# 3. Copy CLI tools
cp "$REPO_ROOT/tools/kb"        "$VAULT/tools/kb"
cp "$REPO_ROOT/tools/kb-search" "$VAULT/tools/kb-search"
chmod +x "$VAULT/tools/kb" "$VAULT/tools/kb-search"

# 4. Copy Obsidian config (hidden dir — handle carefully)
mkdir -p "$VAULT/.obsidian"
cp "$REPO_ROOT/vault-template/.obsidian/app.json"   "$VAULT/.obsidian/app.json"
cp "$REPO_ROOT/vault-template/.obsidian/graph.json" "$VAULT/.obsidian/graph.json"

# 5. Add tools to PATH for this session (and suggest adding to shell)
export PATH="$VAULT/tools:$PATH"

# 6. Initialise git (optional but recommended — version history for free)
if command -v git &>/dev/null && [ ! -d "$VAULT/.git" ]; then
  git -C "$VAULT" init -q
  cat > "$VAULT/.gitignore" << 'GITIGNORE'
.kb-search.db
outputs/
GITIGNORE
  git -C "$VAULT" add -A
  git -C "$VAULT" commit -q -m "Initial vault"
  echo "✓ Git repo initialised"
fi

# 7. Test llama-server connection
echo ""
if curl -s --max-time 2 http://127.0.0.1:8080/v1/models > /dev/null 2>&1; then
  echo "✓ Gemma 4 is running at localhost:8080"
else
  echo "⚠  Gemma 4 not detected — start it before running kb:"
  echo "   llama-server -m <path-to-gemma4.gguf> --jinja --flash-attn on -c 131072 -ngl 99 --embeddings"
fi

# 8. Done — print next steps
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Vault ready: $VAULT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  1. Open Obsidian"
echo "     → Open folder as vault"
echo "     → Select: $VAULT"
echo ""
echo "  2. In a terminal, cd into the vault and try:"
echo ""
echo "     cd $VAULT"
echo "     ./tools/kb ingest raw/sample-community-power.md"
echo "     ./tools/kb compile"
echo "     ./tools/kb query \"What funding alternatives exist for community orgs?\""
echo "     ./tools/kb log"
echo ""
echo "  3. Add to your PATH permanently (add to ~/.zshrc):"
echo "     export PATH=\"$VAULT/tools:\$PATH\""
echo ""
echo "  Recommended Obsidian plugins:"
echo "    - Marp Slides     → render outputs/slides/*.md"
echo "    - Dataview        → query wiki frontmatter"
echo "    - Graph view is built-in → shows [[wikilinks]] network"
echo ""
