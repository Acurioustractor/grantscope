#!/usr/bin/env node

import 'dotenv/config';
import { MINIMAX_BASE_URL, MINIMAX_CHAT_COMPLETIONS_URL } from './lib/minimax.mjs';

const key = process.env.MINIMAX_API_KEY;

if (!key) {
  console.error('MINIMAX_API_KEY is not set');
  process.exit(1);
}

const body = {
  model: 'MiniMax-M2.5',
  messages: [{ role: 'user', content: 'Reply with exactly OK' }],
  temperature: 0,
  max_tokens: 10,
};

const endpoints = [
  MINIMAX_CHAT_COMPLETIONS_URL,
  `${MINIMAX_BASE_URL.includes('minimaxi.com') ? 'https://api.minimax.io/v1' : 'https://api.minimaxi.com/v1'}/chat/completions`,
];

for (const url of endpoints) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    const text = await res.text();
    console.log(`\n${url}`);
    console.log(`status=${res.status}`);
    console.log(text.slice(0, 400));
  } catch (error) {
    console.log(`\n${url}`);
    console.log(`error=${error instanceof Error ? error.message : String(error)}`);
  }
}
