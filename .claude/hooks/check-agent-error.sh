#!/bin/bash
# PostToolUse hook: after running an agent script, check exit code and show last error
# Fires on Bash commands matching "node scripts/" or "node --env-file=.env scripts/"

# Only check if the tool was a Bash command that ran an agent script
if ! echo "$TOOL_INPUT" | grep -qE 'node.*scripts/.*\.mjs'; then
  exit 0
fi

# Only alert on non-zero exit codes
if [ "$TOOL_EXIT_CODE" = "0" ] || [ -z "$TOOL_EXIT_CODE" ]; then
  exit 0
fi

# Query last failed agent run
RESULT=$(cd /Users/benknight/Code/grantscope && node --env-file=.env scripts/gsql.mjs "SELECT agent_name, status, errors, started_at FROM agent_runs WHERE status != 'completed' ORDER BY started_at DESC LIMIT 1" 2>/dev/null)

if [ -n "$RESULT" ]; then
  echo "🔴 Agent script exited with error. Last failed run:"
  echo "$RESULT"
fi
