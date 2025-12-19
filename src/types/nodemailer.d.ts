/* eslint-disable */
/**
 * Minimal local type stubs for `nodemailer`.
 *
 * These are intentionally permissive to silence TypeScript errors in environments
 * where `@types/nodemailer` isn't installed. For full typing, prefer installing:
 *
 *   npm i -D @types/nodemailer
 *
 * The project only needs a small subset of the API (createTransport + sendMail),
 * so we provide lightweight types sufficient for the usages here.
 */

declare module "nodemailer" {
  export interface SentMessageInfo {
    accepted?: string[];
    rejected?: string[];
    envelope?: any;
    messageId?: string;
    response?: string;
    // allow other fields as necessary
    [key: string]: any;
  }

  export interface SendMailOptions {
    from?: string;
    to?: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject?: string;
    text?: string;
    html?: string;
    replyTo?: string;
    attachments?: any[];
    // catch-all for additional provider-specific options
    [key: string]: any;
  }

  export interface SMTPTransportOptions {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: { user?: string; pass?: string } | { type?: string; [k: string]: any };
    // catch-all for provider-specific transport options
    [key: string]: any;
  }

  export interface Transporter {
    /**
     * Send an email. If a callback is omitted, a Promise is returned.
     */
    sendMail(mail: SendMailOptions): Promise<SentMessageInfo>;
    sendMail(mail: SendMailOptions, callback: (err: Error | null, info: SentMessageInfo) => void): void;

    /**
     * Optional helpers commonly available on transporters.
     */
    verify?(): Promise<boolean>;
    verify?(callback: (err?: Error | null, success?: boolean) => void): void;
    close?(): void;

    [key: string]: any;
  }

  /**
   * Create a transporter instance.
   */
  export function createTransport(options?: SMTPTransportOptions): Transporter;

  const nodemailer: {
    createTransport(options?: SMTPTransportOptions): Transporter;
    [key: string]: any;
  };

  export default nodemailer;
}
