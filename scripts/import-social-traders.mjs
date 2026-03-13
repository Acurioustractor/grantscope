#!/usr/bin/env node

/**
 * Compatibility wrapper.
 *
 * The richer, canonical Social Traders ingestion path is now
 * scripts/ingest-social-traders.mjs. Keep this file so existing scripts,
 * docs, and manual commands do not drift.
 */

import './ingest-social-traders.mjs';
