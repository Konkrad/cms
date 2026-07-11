import nodemailer, { type Transporter } from "nodemailer";
import { env } from "~/env";

type MailResult = any;

const SMTP_HOST = env.SMTP_HOST;
const SMTP_PORT = env.SMTP_PORT;
const SMTP_USER = env.SMTP_USER;
const SMTP_PASS = env.SMTP_PASS;
const SMTP_FROM = env.SMTP_FROM;

let transporterInstance: Transporter | null = null;

/**
 * Lazily construct and cache a nodemailer transporter.
 * Will throw if required environment variables (host/port) are missing.
 */
function getTransporter(): Transporter {
  if (transporterInstance) return transporterInstance;
  transporterInstance = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // true for 465, false for other ports
    auth:
      SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });

  return transporterInstance;
}

/**
 * Generic helper for sending arbitrary HTML emails.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<MailResult> {
  const transporter = getTransporter();

  const info = await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    html,
    text,
  });
  return info;
}
