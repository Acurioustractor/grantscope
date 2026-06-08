module.exports = {
  apps: [{
    name: 'orchestrator',
    script: 'scripts/agent-orchestrator.mjs',
    node_args: '--env-file=.env',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    // pm2's spawn PATH is minimal and omits Homebrew, so agents that shell out
    // to `psql` (and other CLI tools) failed with spawn ENOENT (e.g. Trust
    // Remediation Loop, Refresh Materialized Views, Youth Justice source chain).
    // Prepend Homebrew + a sane base PATH so child agents can find psql.
    env: {
      PATH: '/opt/homebrew/bin:/opt/homebrew/opt/postgresql@16/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
    },
  }],
};
