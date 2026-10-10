import { env } from "~/env";

/**
 * Keys that must never reach a page payload unless the page explicitly allows them:
 * private user columns (`src/core/users/schema.ts`), login/session secrets
 * (`src/core/auth/schema/*`) and payment/ticket secrets (events module schemas).
 * Any key starting with `stripe` is forbidden as well (Stripe session/payment ids).
 */
export const PRIVATE_FIELD_KEYS: readonly string[] = [
	// users
	"email",
	"loginId",
	"consent",
	"yearOfBirth",
	"sex",
	"latitude",
	"longitude",
	"foodPreference",
	"photoConsentGiven",
	// the private full-size S3 key; `profilePictureSmall` is a public key
	"profilePicture",
	"role",
	"phone",
	// logins / sessions
	"magicHash",
	"otpHash",
	"otpAttempts",
	"token",
	"sessionToken",
	"ip",
	"userAgent",
	// tickets: the QR code uuid admits whoever presents it
	"qrCodeUuid",
	// elections: internal admin note on an application
	"adminNote",
];

const FORBIDDEN = new Set(PRIVATE_FIELD_KEYS);
const isForbiddenKey = (key: string) =>
	FORBIDDEN.has(key) || /^stripe/i.test(key);

/** Paths (like `items[2].user.email`) of forbidden keys anywhere in `value`. */
export function findPrivateFields(
	value: unknown,
	allow: readonly string[] = [],
): string[] {
	const allowed = new Set(allow);
	const found: string[] = [];
	const seen = new WeakSet<object>();

	const join = (path: string, key: string) => (path ? `${path}.${key}` : key);
	const visit = (node: unknown, path: string) => {
		if (node === null || typeof node !== "object") return;
		if (seen.has(node)) return;
		seen.add(node);
		if (Array.isArray(node) || node instanceof Set) {
			let i = 0;
			for (const item of node) visit(item, `${path}[${i++}]`);
			return;
		}
		if (node instanceof Map) {
			for (const [k, v] of node) {
				const key = String(k);
				if (isForbiddenKey(key) && !allowed.has(key))
					found.push(join(path, key));
				visit(v, join(path, key));
			}
			return;
		}
		if (node instanceof Date || node instanceof URL) return;
		for (const [key, child] of Object.entries(node)) {
			const childPath = join(path, key);
			if (isForbiddenKey(key) && !allowed.has(key)) found.push(childPath);
			visit(child, childPath);
		}
	};

	visit(value, "");
	return found;
}

/**
 * Dev/test safety net for page payloads: throws if `value` (a loader result about to be
 * serialized into the HTML) contains a private key, anywhere, even with a null value.
 * Returns `value` so a loader can `return assertNoPrivateFields(data)`.
 *
 * A page that legitimately shows such a field passes it in `allow`, with a comment
 * saying why (e.g. admin pages listing emails, or the user's own profile).
 * No-op in production (`NODE_ENV === "production"`).
 */
export function assertNoPrivateFields<T>(
	value: T,
	options: { allow?: readonly string[] } = {},
): T {
	if (env.NODE_ENV === "production") return value;
	const found = findPrivateFields(value, options.allow);
	if (found.length > 0) {
		throw new Error(
			`Private fields in a page payload: ${found.slice(0, 20).join(", ")}${
				found.length > 20 ? ` (+${found.length - 20} more)` : ""
			}. Strip them in the service, or allow them explicitly with a reason (assertNoPrivateFields { allow }).`,
		);
	}
	return value;
}
