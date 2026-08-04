#!/usr/bin/env node
/**
 * Apply evidence-backed qualification updates to named Goods buyer contacts.
 * Dry-run is the default; pass --apply for reviewed HighLevel writes.
 */
import 'dotenv/config';

const APPLY = process.argv.includes('--apply');
const BASE = 'https://services.leadconnectorhq.com';
const KEY = process.env.GHL_API_KEY;
if (!KEY) throw new Error('Missing GHL_API_KEY');

const QUALIFICATIONS = [
  {
    contactId: 'FVfAK0x3SjtTkBmPBTxI',
    name: 'Simone Grimmond',
    email: 'simone.grimmond@whsac.com.au',
    evidence: 'Direct Goods email sent 21 May 2025 following Simone outreach; Gmail message 196f091544ce876a.',
    tags: [
      'project:goods-on-country',
      'relationship:buyer-prospect',
      'source:gmail-buyer-evidence',
      'comms:manual-relationship',
    ],
  },
];

async function ghl(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Version: '2021-07-28',
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`GHL ${response.status} ${path}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

const results = [];
for (const qualification of QUALIFICATIONS) {
  const data = await ghl(`/contacts/${qualification.contactId}`);
  const contact = data.contact || data;
  const tags = [...new Set([...(contact.tags || []), ...qualification.tags])];
  const changed = contact.email !== qualification.email
    || tags.length !== (contact.tags || []).length;
  if (changed && APPLY) {
    await ghl(`/contacts/${qualification.contactId}`, {
      method: 'PUT',
      body: JSON.stringify({
        email: qualification.email,
        tags,
      }),
    });
  }
  results.push({
    contactId: qualification.contactId,
    name: qualification.name,
    action: changed ? (APPLY ? 'updated' : 'would-update') : 'already-qualified',
    evidence: qualification.evidence,
  });
}

console.log(JSON.stringify({ apply: APPLY, results }, null, 2));
