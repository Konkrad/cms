import type { RequestEvent } from "@qwik.dev/router";

/** What a handler answered through a fake request event. */
export interface SentResponse {
	status: number;
	body: string;
	headers: Headers;
}

/** The error a fake `event.error(status, message)` throws. */
export class FakeHttpError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
	}
}

/**
 * A minimal Qwik `RequestEvent` for endpoint handlers (`onGet`/`onRequest` that call
 * `event.send`, `event.headers` and `event.error`). `sent()` returns what was sent, or null.
 */
export function fakeRequestEvent(
	url: string,
	init: { method?: string; headers?: Record<string, string> } = {},
): { event: RequestEvent; sent: () => SentResponse | null } {
	const method = init.method ?? "GET";
	const headers = new Headers();
	let sent: SentResponse | null = null;
	const event = {
		url: new URL(url),
		method,
		request: new Request(url, { method, headers: init.headers }),
		headers,
		params: {},
		sharedMap: new Map(),
		send(status: number, body: unknown) {
			sent = { status, body: String(body ?? ""), headers };
		},
		error(status: number, message: string) {
			return new FakeHttpError(status, message);
		},
	};
	return { event: event as unknown as RequestEvent, sent: () => sent };
}

/** Throws unless `xml` is well-formed (balanced tags, quoted attributes, escaped text). */
export function assertWellFormedXml(xml: string): void {
	const token =
		/<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"<]*"|'[^'<]*'))*)\s*(\/?)>|[^<]+|</g;
	const badAmp = /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/;
	const stack: string[] = [];
	let roots = 0;
	for (const m of xml.matchAll(token)) {
		const [text, closing, name, attrs, selfClosing] = m;
		if (/^<(!\[CDATA\[|\?|!--)/.test(text)) continue;
		if (name) {
			if (badAmp.test(attrs ?? "")) throw new Error(`Bad & in <${name}>`);
			if (closing) {
				const open = stack.pop();
				if (open !== name)
					throw new Error(`</${name}> closes <${open ?? "nothing"}>`);
			} else if (!selfClosing) {
				if (!stack.length) roots++;
				stack.push(name);
			} else if (!stack.length) roots++;
			continue;
		}
		if (text === "<") throw new Error("Unescaped <");
		if (!stack.length && text.trim()) throw new Error("Text outside the root");
		if (badAmp.test(text)) throw new Error(`Unescaped & in "${text}"`);
	}
	if (stack.length) throw new Error(`Unclosed <${stack.join("><")}>`);
	if (roots !== 1) throw new Error(`${roots} root elements`);
}
