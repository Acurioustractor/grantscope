#!/usr/bin/env bash
# reap-stale-dev-servers.sh
#
# Kills forgotten Next.js / Vite dev servers that accumulate across editor and
# Claude sessions and saturate the shared Supabase pooler (project
# tednluwflfhxyucgwigh). Nothing reaps a `next dev` when you close a terminal,
# so they pile up for days/weeks — each one a tenant on a 90-connection box.
#
# SAFE BY DESIGN:
#   - Skips pm2-supervised processes (and their children) — those are intentional
#     and pm2 respawns them anyway.
#   - Never kills grantscope's own dev server (self-protection).
#   - Dry-run by default; only kills with --apply.
#   - Conservative default age threshold (96h) so active/recent work is spared.
#
# Usage:
#   scripts/reap-stale-dev-servers.sh                      # dry-run, 96h threshold
#   scripts/reap-stale-dev-servers.sh --apply              # actually kill
#   scripts/reap-stale-dev-servers.sh --apply --max-age-hours 48
set -uo pipefail

APPLY=0
MAX_AGE_HOURS=96
LOG="/tmp/reap-dev-servers.log"

while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1; shift ;;
    --max-age-hours) MAX_AGE_HOURS="${2:-96}"; shift 2 ;;
    -h|--help) sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

ts() { date '+%Y-%m-%d %H:%M:%S'; }
threshold=$(( MAX_AGE_HOURS * 3600 ))

# PIDs supervised by pm2 (exclude these and their direct children)
PM2_PIDS=" $(pm2 jlist 2>/dev/null | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d).map(p=>p.pid).filter(Boolean).join(" "))}catch(e){}})' 2>/dev/null) "

# Candidate dev-server processes older than the threshold. A process is spared if
# IT OR ANY ANCESTOR is grantscope (self-protection) or pm2-managed — walking the
# parent chain so wrapper/child processes (npm exec, next-server) inherit the guard.
# Output: pid|etime|age_seconds|cmd
candidates="$(
  ps -ax -o pid=,ppid=,etime=,command= | awk -v pm2="$PM2_PIDS" -v thr="$threshold" '
    function age(e,   a,t,n,dd,hh,mm,ss){
      dd=0
      if (index(e,"-")) { split(e,a,"-"); dd=a[1]; e=a[2] }
      n=split(e,t,":")
      if (n==3) { hh=t[1]; mm=t[2]; ss=t[3] }
      else if (n==2) { hh=0; mm=t[1]; ss=t[2] }
      else { hh=0; mm=0; ss=t[1] }
      return ((dd*24+hh)*60+mm)*60+ss
    }
    {
      pid=$1; ppid=$2
      CMD[pid]=""; for (i=4;i<=NF;i++) CMD[pid]=CMD[pid] (i>4?" ":"") $i
      PPID[pid]=ppid; ET[pid]=$3; order[NR]=pid
    }
    END {
      n=split(pm2,pa," "); for (i=1;i<=n;i++) if (pa[i] != "") PM2[pa[i]]=1
      for (j=1;j<=NR;j++) {
        pid=order[j]; cmd=CMD[pid]
        if (cmd !~ /next dev|next-server|vite preview|vite dev/) continue
        if (cmd ~ /awk|grep|reap-stale/) continue
        # walk ancestry (cap depth) — protect whole tree if grantscope or pm2 appears
        p=pid; protected=0; depth=0
        while (p != "" && p != "0" && p != "1" && depth < 12) {
          if (CMD[p] ~ /grantscope/) { protected=1; break }
          if (p in PM2) { protected=1; break }
          p=PPID[p]; depth++
        }
        if (protected) continue
        if (age(ET[pid]) < thr) continue
        printf "%s|%s|%d|%s\n", pid, ET[pid], age(ET[pid]), substr(cmd,1,90)
      }
    }'
)"

if [ -z "$candidates" ]; then
  echo "[$(ts)] no stale dev servers older than ${MAX_AGE_HOURS}h (pm2 + grantscope excluded)"
  exit 0
fi

echo "[$(ts)] stale dev servers older than ${MAX_AGE_HOURS}h (pm2 + grantscope excluded):"
echo "$candidates" | awk -F'|' '{ printf "  pid %-8s age %-13s %s\n", $1, $2, $4 }'

if [ "$APPLY" = 1 ]; then
  pids="$(echo "$candidates" | cut -d'|' -f1 | tr '\n' ' ')"
  # shellcheck disable=SC2086
  kill $pids 2>/dev/null
  echo "[$(ts)] SIGTERM sent to: $pids" | tee -a "$LOG"
else
  echo "  (dry-run — re-run with --apply to kill)"
fi
