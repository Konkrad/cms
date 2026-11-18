import nodemailer, { type SendMailOptions, type Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { env } from "~/env";

type MailResult = SMTPTransport.SentMessageInfo;

const SMTP_HOST = env.SMTP_HOST;
const SMTP_PORT = env.SMTP_PORT;
const SMTP_USER = env.SMTP_USER;
const SMTP_PASS = env.SMTP_PASS;
const SMTP_FROM = env.SMTP_FROM;

let transporterInstance: Transporter<MailResult> | null = null;

/**
 * Lazily construct and cache a nodemailer transporter.
 * Will throw if required environment variables (host/port) are missing.
 */
function getTransporter(): Transporter<MailResult> {
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
 * Low-level SMTP send. Core only: the login email calls it directly; everything else is
 * queued with `notify()` and sent by the outbox worker's email channel.
 */
export async function sendEmail({
	to,
	subject,
	html,
	text,
	attachments,
	headers,
}: {
	to: string;
	subject: string;
	html: string;
	text?: string;
	attachments?: SendMailOptions["attachments"];
	headers?: Record<string, string>;
}): Promise<MailResult> {
	const transporter = getTransporter();

	const info = await transporter.sendMail({
		from: SMTP_FROM,
		to,
		subject,
		html,
		text,
		attachments,
		headers,
	});
	return info;
}
