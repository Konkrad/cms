/**
 * Minimal Telegram Bot API mock server.
 *
 * The server listens on a local port and captures every `sendMessage` call
 * made by `node-telegram-bot-api` when `TELEGRAM_API_URL` points at it.
 *
 * Usage in tests:
 *
 *   import { startTelegramMock, stopTelegramMock, getTelegramMessages, clearTelegramMessages } from './telegram-mock';
 *
 *   test.beforeAll(async () => { await startTelegramMock(); });
 *   test.afterAll(async () => { await stopTelegramMock(); });
 *
 *   // after the action that triggers a notification:
 *   const msgs = getTelegramMessages();
 *   expect(msgs[0].text).toContain('VIP Ticket');
 */

import http from "http";

export interface TelegramMessage {
  chatId: string;
  text: string;
  timestamp: Date;
}

const DEFAULT_PORT = 8099;

let _server: http.Server | null = null;
let _messages: TelegramMessage[] = [];

/** Start the mock server. Safe to call multiple times (no-op if already running). */
export function startTelegramMock(port = DEFAULT_PORT): Promise<void> {
  if (_server) return Promise.resolve();

  return new Promise((resolve, reject) => {
    _messages = [];
    _server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        // Telegram bot SDK posts to /bot<token>/sendMessage
        if (req.method === "POST" && req.url?.includes("/sendMessage")) {
          try {
            // Content-Type may be application/json or application/x-www-form-urlencoded
            let chatId = "";
            let text = "";
            const ct = req.headers["content-type"] ?? "";
            if (ct.includes("application/json")) {
              const data = JSON.parse(body);
              chatId = String(data.chat_id ?? "");
              text = String(data.text ?? "");
            } else {
              const params = new URLSearchParams(body);
              chatId = params.get("chat_id") ?? "";
              text = params.get("text") ?? "";
            }
            _messages.push({ chatId, text, timestamp: new Date() });
          } catch {
            // ignore parse errors
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({ ok: true, result: { message_id: _messages.length } }),
          );
        } else {
          // Any other endpoint (getMe, etc.) — return an ok stub
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, result: {} }));
        }
      });
    });

    _server.once("error", reject);
    _server.listen(port, () => resolve());
  });
}

/** Stop the mock server and clear recorded messages. */
export function stopTelegramMock(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!_server) {
      resolve();
      return;
    }
    const s = _server;
    _server = null;
    _messages = [];
    s.close((err) => (err ? reject(err) : resolve()));
  });
}

/** Return a snapshot of all messages sent since the server started (or last cleared). */
export function getTelegramMessages(): TelegramMessage[] {
  return [..._messages];
}

/** Discard all recorded messages without stopping the server. */
export function clearTelegramMessages(): void {
  _messages = [];
}
