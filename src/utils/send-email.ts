import { render } from "@react-email/render";
import nodemailer, { type Transporter } from "nodemailer";
import * as React from "react";
import LoginEmail from "~/emails/LoginEmail";
import { env } from "~/env";

type MailResult = Awaited<ReturnType<Transporter["sendMail"]>>;

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
 * Send a login email that contains both a magic link and the 6-letter code.
 *
 * - `to` - destination email
 * - `link` - fully-qualified magic link (e.g. https://yourapp.com/auth/verify?token=...)
 * - `code` - the 6-letter OTP (raw, human-readable)
 * - `subject` - optional subject line override
 *
 * Returns nodemailer's sendMail result object.
 */
export async function sendLoginEmail({
  to,
  link,
  code,
  subject,
}: {
  to: string;
  link: string;
  code: string;
  subject?: string;
}): Promise<MailResult> {
  const appName = env.APP_NAME;
  const html = render(React.createElement(LoginEmail, { link, code, appName }));

  const text = [
    `Sign in to ${appName}`,
    "",
    `Sign-in link: ${link}`,
    "",
    `Your code: ${code}`,
    "",
    `This link & code expire soon.`,
  ].join("\n");

  const mailOptions = {
    from: SMTP_FROM,
    to,
    subject: subject ?? `Sign in to ${appName}`,
    html,
    text,
  };

  const transporter = getTransporter();

  try {
    const info = await transporter.sendMail(mailOptions);
    // optionally: transporter.verify() on first send if you want to check connectivity
    return info;
  } catch (err) {
    // surface useful error to caller
    console.error("Failed to send login email:", err);
    throw err;
  }
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

  try {
    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html,
      text,
    });
    return info;
  } catch (err) {
    console.error("Failed to send email:", err);
    throw err;
  }
}

export default sendLoginEmail;
