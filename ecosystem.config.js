module.exports = {
  apps: [{
    name: 'orchestrator',
    script: 'scripts/agent-orchestrator.mjs',
    node_args: '--env-file=.env',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
  }],
};
