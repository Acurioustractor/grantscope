/**
 * Gmail send helper using Google service account with domain-wide delegation.
 * Requires env vars: GOOGLE_SERVICE_ACCOUNT_KEY (JSON), GOOGLE_DELEGATED_USER (sender email)
 */

import crypto from 'crypto';

async function getGoogleAccessToken(
  credentials: { client_email: string; private_key: string },
  subject: string,
  scopes: string[]
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: credentials.client_email,
      sub: subject,
      scope: scopes.join(' '),
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  ).toString('base64url');

  const signInput = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signInput);
  const signature = sign.sign(credentials.private_key, 'base64url');
  const jwt = `${signInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) throw new Error(`Google auth error: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

interface GrantEmailData {
  name: string;
  amount: string;
  closes: string;
  description: string;
  url: string;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  body: string;
  html?: string;
  senderName?: string;
}): Promise<void> {
  const serviceKeyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const delegatedUser = process.env.GOOGLE_DELEGATED_USER;
  if (!serviceKeyJson || !delegatedUser) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY and GOOGLE_DELEGATED_USER must be set');
  }

  const credentials = JSON.parse(serviceKeyJson);
  const accessToken = await getGoogleAccessToken(credentials, delegatedUser, [
    'https://www.googleapis.com/auth/gmail.send',
  ]);

  const sender = opts.senderName || 'GrantScope';
  const boundary = `boundary_${Date.now()}`;

  let message: string;
  if (opts.html) {
    message = [
      `From: ${sender} <${delegatedUser}>`,
      `To: ${opts.to}`,
      `Subject: ${opts.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      `Content-Type: text/plain; charset=utf-8`,
      '',
      opts.body,
      `--${boundary}`,
      `Content-Type: text/html; charset=utf-8`,
      '',
      opts.html,
      `--${boundary}--`,
    ].join('\r\n');
  } else {
    message = [
      `From: ${sender} <${delegatedUser}>`,
      `To: ${opts.to}`,
      `Subject: ${opts.subject}`,
      `Content-Type: text/plain; charset=utf-8`,
      '',
      opts.body,
    ].join('\r\n');
  }

  const encodedMessage = Buffer.from(message).toString('base64url');

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedMessage }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail send failed (${res.status}): ${text}`);
  }
}

export async function sendGrantEmail(
  to: string,
  grant: GrantEmailData,
  senderName: string = 'GrantScope'
): Promise<void> {
  const serviceKeyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const delegatedUser = process.env.GOOGLE_DELEGATED_USER;
  if (!serviceKeyJson || !delegatedUser) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY and GOOGLE_DELEGATED_USER must be set');
  }

  const credentials = JSON.parse(serviceKeyJson);
  const accessToken = await getGoogleAccessToken(credentials, delegatedUser, [
    'https://www.googleapis.com/auth/gmail.send',
  ]);

  const subject = `Grant Opportunity: ${grant.name}`;
  const body =
    `Hi,\n\n` +
    `I wanted to share this grant opportunity with you:\n\n` +
    `${grant.name}\n` +
    `Amount: ${grant.amount}\n` +
    `Closes: ${grant.closes}\n` +
    (grant.description
      ? `\n${grant.description.slice(0, 500)}${grant.description.length > 500 ? '...' : ''}\n`
      : '') +
    (grant.url ? `\nMore info: ${grant.url}\n` : '') +
    `\nBest regards,\n${senderName}`;

  // Build RFC 2822 message
  const message = [
    `From: ${senderName} <${delegatedUser}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    '',
    body,
  ].join('\r\n');

  const encodedMessage = Buffer.from(message).toString('base64url');

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedMessage }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail send failed (${res.status}): ${text}`);
  }
}
