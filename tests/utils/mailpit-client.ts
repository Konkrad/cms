import { MailpitClient } from 'mailpit-api';

const MAILPIT_BASE = process.env.MAILPIT_API_URL || 'http://localhost:8025';
const APP_URL = process.env.BASE_URL || process.env.APP_URL;
const mailpit = new MailpitClient(MAILPIT_BASE);

/**
 * Polls Mailpit for a specific recipient and returns the processed HTML content.
 * @param recipient - The email address to look for.
 * @param timeout - Max time to wait in milliseconds (default 30s).
 * @param since - If provided, only consider emails received after this timestamp.
 */
export async function waitForEmailHtml(recipient: string, timeout = 30000, since?: Date): Promise<string> {
  const endTime = Date.now() + timeout;

  while (Date.now() < endTime) {
    // 1. Fetch recent messages
    const res = await mailpit.listMessages(0, 50)
    const messages = res?.messages || [];

    // 2. Find the message for our user (optionally filtered by receive time)
    const found = messages.find(m => {
      if (!m.To?.some(r => r.Address.toLowerCase() === recipient.toLowerCase())) return false;
      if (since && m.Date && new Date(m.Date) < since) return false;
      return true;
    });

    if (found) {
      // 3. Get the full summary for the HTML body
      const summary = await mailpit.getMessageSummary(found.ID)
      let html = summary.HTML || '';

      // 4. Attempt a full render if the summary is potentially truncated
      try {
        const rendered = await mailpit.renderMessageHTML(found.ID);
        if (typeof rendered === 'string') html = rendered;
      } catch {
        /* Fallback to summary.HTML */
      }
      return html;
    }

    // Wait 1s before next poll
    await new Promise(r => setTimeout(r, 1000));
  }

  throw new Error(`Timeout: No email found for ${recipient} after ${timeout}ms`);
}

/**
 * Extracts all unique HTTP/S links from an HTML string.
 */
export function extractAllLinks(html: string): string[] {
  if (!html) return [];
  // Matches href="http..." and captures the URL group
  const regex = /href="((?:https?):\/\/[^"]+)"/gi;
  const matches = [...html.matchAll(regex)];
  
  // Return unique URLs only
  return Array.from(new Set(matches.map(m => m[1])));
}