#!/bin/bash
# setup.sh — Create a new knowledge base vault from template
set -e

BOLD="\033[1m"
GREEN="\033[32m"
BLUE="\033[34m"
YELLOW="\033[33m"
RED="\033[31m"
CYAN="\033[36m"
RESET="\033[0m"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE_DIR="$SCRIPT_DIR/vault-template"

echo -e "\n${BOLD}${CYAN}kb — Knowledge Base Setup${RESET}\n"

# Get vault path
if [ -z "$1" ]; then
    echo -e "Usage: ${CYAN}./setup.sh /path/to/my-vault${RESET}"
    echo ""
    echo "  Creates a new knowledge base vault at the specified path."
    echo "  Example: ./setup.sh ~/Documents/social-impact-kb"
    exit 1
fi

VAULT_PATH="$1"

# Check template exists
if [ ! -d "$TEMPLATE_DIR" ]; then
    echo -e "${RED}✗${RESET} Template directory not found at $TEMPLATE_DIR"
    exit 1
fi

# Create vault
if [ -d "$VAULT_PATH" ]; then
    echo -e "${YELLOW}⚠${RESET} Directory already exists: $VAULT_PATH"
    read -p "  Overwrite? [y/N] " confirm
    if [ "$confirm" != "y" ]; then
        echo "Aborted."
        exit 0
    fi
fi

echo -e "${BLUE}ℹ${RESET} Creating vault at $VAULT_PATH ..."
cp -r "$TEMPLATE_DIR" "$VAULT_PATH"

# Make kb executable
chmod +x "$VAULT_PATH/tools/kb"
echo -e "${GREEN}✓${RESET} Made tools/kb executable"

# Check Python
if command -v python3 &> /dev/null; then
    echo -e "${GREEN}✓${RESET} Python 3 found: $(python3 --version)"
else
    echo -e "${RED}✗${RESET} Python 3 not found — install it first"
    exit 1
fi

# Check llama-server
echo -e "${BLUE}ℹ${RESET} Testing connection to llama-server..."
if curl -s --max-time 3 http://127.0.0.1:8080/v1/models > /dev/null 2>&1; then
    echo -e "${GREEN}✓${RESET} llama-server is running at http://127.0.0.1:8080"
else
    echo -e "${YELLOW}⚠${RESET} llama-server not detected at http://127.0.0.1:8080"
    echo "  Start it with:"
    echo -e "  ${CYAN}llama-server -m <path-to-gemma4.gguf> --jinja -fa -c 131072${RESET}"
fi

# Add to PATH suggestion
KB_BIN="$VAULT_PATH/tools"
echo ""
echo -e "${BOLD}Add to your PATH (optional):${RESET}"
echo -e "  ${CYAN}export PATH=\"$KB_BIN:\$PATH\"${RESET}"
echo ""
echo "  Or add to ~/.zshrc (or ~/.bashrc):"
echo -e "  ${CYAN}echo 'export PATH=\"$KB_BIN:\$PATH\"' >> ~/.zshrc${RESET}"

# Print getting started
echo ""
echo -e "${BOLD}${CYAN}Getting Started${RESET}"
echo -e "─────────────────────────────────"
echo ""
echo -e "  1. ${BOLD}cd $VAULT_PATH${RESET}"
echo ""
echo -e "  2. Open this folder in ${BOLD}Obsidian${RESET} as a vault"
echo ""
echo -e "  3. Ingest your first document:"
echo -e "     ${CYAN}./tools/kb ingest raw/sample-community-power.md${RESET}"
echo ""
echo -e "  4. Compile the wiki:"
echo -e "     ${CYAN}./tools/kb compile${RESET}"
echo ""
echo -e "  5. Query it:"
echo -e "     ${CYAN}./tools/kb query \"What community funding models exist in Australia?\"${RESET}"
echo ""
echo -e "  6. Check health:"
echo -e "     ${CYAN}./tools/kb lint${RESET}"
echo ""
echo -e "  ${BOLD}Recommended Obsidian plugins:${RESET}"
echo "    - Marp Slides (render slide decks from markdown)"
echo "    - Dataview (query frontmatter as structured data)"
echo "    - Graph View (built-in — visualise [[wikilinks]])"
echo ""
echo -e "${GREEN}✓${RESET} Vault created. Happy knowledge-building."
echo ""
