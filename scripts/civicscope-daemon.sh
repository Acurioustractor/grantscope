#!/bin/bash
#
# civicscope-daemon.sh — Always-on CivicScope intelligence daemon
#
# Runs Claude Code in Remote Control mode with Telegram channels,
# allowing you to control the civic intelligence engine from your phone.
#
# Prerequisites:
#   1. Claude Code v2.1.80+ installed
#   2. Logged into claude.ai (Pro/Max/Team)
#   3. Telegram bot token (from BotFather) — optional
#   4. tmux installed (brew install tmux)
#
# Usage:
#   # Start the daemon in a tmux session
#   ./scripts/civicscope-daemon.sh start
#
#   # Stop the daemon
#   ./scripts/civicscope-daemon.sh stop
#
#   # Check status
#   ./scripts/civicscope-daemon.sh status
#
#   # View logs
#   ./scripts/civicscope-daemon.sh logs
#

SESSION_NAME="civicscope"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="$PROJECT_DIR/logs/civicscope-daemon.log"

mkdir -p "$PROJECT_DIR/logs"

case "${1:-start}" in
  start)
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
      echo "CivicScope daemon already running. Use 'attach' to connect."
      exit 0
    fi

    echo "Starting CivicScope daemon..."
    echo "  Project: $PROJECT_DIR"
    echo "  Session: $SESSION_NAME"
    echo "  Log: $LOG_FILE"

    # Create tmux session with Remote Control
    tmux new-session -d -s "$SESSION_NAME" -c "$PROJECT_DIR"

    # Window 1: Claude Code Remote Control (main intelligence agent)
    tmux send-keys -t "$SESSION_NAME" "claude remote-control --name 'CivicScope Ops' --spawn worktree --capacity 4 2>&1 | tee -a $LOG_FILE" C-m

    # Window 2: Scheduled scraper runs
    tmux new-window -t "$SESSION_NAME" -n "scrapers" -c "$PROJECT_DIR"
    tmux send-keys -t "$SESSION_NAME:scrapers" "cat <<'EOF'
CivicScope Scraper Schedule (run manually or via cron):

  # Ministerial statements (daily)
  node --env-file=.env scripts/scrape-ministerial-statements.mjs --pages=5

  # Hansard transcripts (weekly)
  node --env-file=.env scripts/scrape-qld-hansard.mjs --days=7

  # Consultancy spending (monthly)
  node --env-file=.env scripts/scrape-qld-consultancy-spending.mjs

  # Cross-linker (daily, after scrapers)
  node --env-file=.env scripts/civic-cross-linker.mjs

  # Backfill statements (one-time deep scrape)
  node --env-file=.env scripts/scrape-ministerial-statements.mjs --pages=50 --backfill

EOF" C-m

    # Window 3: Monitoring
    tmux new-window -t "$SESSION_NAME" -n "monitor" -c "$PROJECT_DIR"
    tmux send-keys -t "$SESSION_NAME:monitor" "echo 'CivicScope Monitor — run queries:' && echo '' && echo '  # Check agent runs:' && echo '  node --env-file=.env scripts/gsql.mjs \"SELECT agent_name, status, items_new, started_at FROM agent_runs WHERE agent_id LIKE '\\''civic%'\\'' OR agent_id LIKE '\\''scrape-ministerial%'\\'' OR agent_id LIKE '\\''scrape-qld%'\\'' ORDER BY started_at DESC LIMIT 10\"' && echo '' && echo '  # Check table counts:' && echo '  node --env-file=.env scripts/gsql.mjs \"SELECT '\\''statements'\\'' as t, COUNT(*) FROM civic_ministerial_statements UNION ALL SELECT '\\''hansard'\\'', COUNT(*) FROM civic_hansard UNION ALL SELECT '\\''alerts'\\'', COUNT(*) FROM civic_alerts UNION ALL SELECT '\\''spending'\\'', COUNT(*) FROM civic_consultancy_spending\"'" C-m

    echo ""
    echo "CivicScope daemon started!"
    echo ""
    echo "  Connect from browser/phone: Visit claude.ai → Remote Sessions"
    echo "  Attach locally:             tmux attach -t $SESSION_NAME"
    echo "  View logs:                  $0 logs"
    echo ""
    ;;

  stop)
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
      tmux kill-session -t "$SESSION_NAME"
      echo "CivicScope daemon stopped."
    else
      echo "CivicScope daemon not running."
    fi
    ;;

  status)
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
      echo "CivicScope daemon: RUNNING"
      tmux list-windows -t "$SESSION_NAME"
    else
      echo "CivicScope daemon: STOPPED"
    fi
    ;;

  logs)
    if [ -f "$LOG_FILE" ]; then
      tail -50 "$LOG_FILE"
    else
      echo "No logs yet."
    fi
    ;;

  attach)
    tmux attach -t "$SESSION_NAME"
    ;;

  *)
    echo "Usage: $0 {start|stop|status|logs|attach}"
    exit 1
    ;;
esac
