#!/usr/bin/env node
/**
 * Bridge GrantScope to the ACT Global Infrastructure Xero sync.
 *
 * The ACT repo owns Xero OAuth credentials and token rotation. This wrapper
 * runs those scripts from that repo's working directory so tokens, env loading,
 * and sync state stay in one place while GrantScope reads the shared Supabase
 * mirror tables.
 */
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const DEFAULT_ACT_DIR = '/Users/benknight/Code/act-global-infrastructure';
const actDir = process.env.ACT_GLOBAL_INFRA_DIR || DEFAULT_ACT_DIR;
const args = process.argv.slice(2);

const help = args.includes('--help') || args.includes('-h');
const skipMain = args.includes('--skip-main');
const skipPayments = args.includes('--skip-payments');
const skipBalances = args.includes('--skip-balances');
const mode = args.find((arg) => ['invoices', 'transactions', 'full'].includes(arg)) || 'full';
const daysArg = args.find((arg) => arg.startsWith('--days='));
const paymentsDaysArg = args.find((arg) => arg.startsWith('--payments-days='));
const paymentsDays = paymentsDaysArg ? paymentsDaysArg.replace('--payments-days=', '--days=') : '--days=365';

function usage() {
  console.log(`GrantScope ACT Xero sync bridge

Usage:
  node scripts/sync-act-xero.mjs [full|invoices|transactions] [--days=N]

Options:
  --payments-days=N   Window for Xero Payments sync. Default: 365
  --skip-main         Do not run invoices/transactions sync
  --skip-payments     Do not run Xero Payments sync
  --skip-balances     Do not run bank balance sync
  --help              Show this help

Environment:
  ACT_GLOBAL_INFRA_DIR  Defaults to ${DEFAULT_ACT_DIR}
`);
}

function assertActRepo() {
  const mainScript = join(actDir, 'scripts/sync-xero-to-supabase.mjs');
  const paymentsScript = join(actDir, 'scripts/sync-xero-payments.mjs');
  const balancesScript = join(actDir, 'scripts/sync-xero-bank-balances.mjs');

  if (!existsSync(mainScript)) {
    throw new Error(`ACT Xero sync script not found: ${mainScript}`);
  }
  if (!skipPayments && !existsSync(paymentsScript)) {
    throw new Error(`ACT Xero payments script not found: ${paymentsScript}`);
  }
  if (!skipBalances && !existsSync(balancesScript)) {
    throw new Error(`ACT Xero bank balances script not found: ${balancesScript}`);
  }
}

function runStep(label, script, scriptArgs = []) {
  return new Promise((resolve, reject) => {
    console.log(`\n=== ${label} ===`);
    const child = spawn(process.execPath, [script, ...scriptArgs], {
      cwd: actDir,
      env: {
        ...process.env,
        ACT_SYNC_CALLER: 'grantscope',
      },
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed with exit code ${code}`));
    });
  });
}

async function main() {
  if (help) {
    usage();
    return;
  }

  assertActRepo();
  console.log(`Using ACT global infrastructure: ${actDir}`);

  if (!skipMain) {
    const mainArgs = [mode];
    if (daysArg) mainArgs.push(daysArg);
    await runStep('Xero invoices and transactions', 'scripts/sync-xero-to-supabase.mjs', mainArgs);
  }

  if (!skipPayments) {
    await runStep('Xero invoice payments', 'scripts/sync-xero-payments.mjs', [paymentsDays]);
  }

  if (!skipBalances) {
    await runStep('Xero bank balances', 'scripts/sync-xero-bank-balances.mjs');
  }

  console.log('\nGrantScope ACT Xero bridge complete.');
}

main().catch((error) => {
  console.error(`Fatal: ${error.message}`);
  process.exit(1);
});
