#!/bin/bash
# PreToolUse hook: remind Claude to check schema-cache.md before querying tables
# Reads $TOOL_INPUT from environment (set by Claude Code hooks)

KNOWN_TABLES="gs_entities|gs_relationships|austender_contracts|justice_funding|foundations|grant_opportunities|postcode_geo|org_profiles|acnc_charities|political_donations|seifa_2021|entity_identifiers|ato_tax_transparency|agent_runs|agent_schedules|mv_funding_by_postcode"

# Check if the command contains a SELECT against a known table
if echo "$TOOL_INPUT" | grep -qiE "SELECT.*FROM.*(${KNOWN_TABLES})"; then
  # Check if it's a SELECT * (wasteful on wide tables)
  if echo "$TOOL_INPUT" | grep -qiE "SELECT\s+\*\s+FROM"; then
    echo "⚠️ Avoid SELECT * on wide tables. Specify columns. Schema reference: data/schema-cache.md"
  fi
fi
