import fetch from 'node-fetch';

const MAILPIT_BASE = process.env.MAILPIT_API_URL || 'http://localhost:8025';

export async function listMessages() {
  const res = await fetch(`${MAILPIT_BASE}/api/v1/messages`);
  return res.json();
}

export async function getMessage(id) {
  const res = await fetch(`${MAILPIT_BASE}/api/v1/messages/${id}`);
  return res.json();
}

export function extractFirstLinkFromHtml(html) {
  const m = html.match(/https?:\\/\\/[^\"'\s<]+/i);
  return m ? m[0] : null;
}

export async function waitForEmail(recipient, timeout = 15000, pollInterval = 500) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const list = await listMessages();
    const found = list.find(m => (m.to || []).some(t => t.address === recipient));
    if (found) return getMessage(found.id);
    await new Promise(r => setTimeout(r, pollInterval));
  }
  throw new Error(`Timeout waiting for email to ${recipient}`);
}