/**
 * Social web (spec 5.3): the site's public, approved notes and articles as an RSS feed and as a
 * pull-only ActivityPoll actor (WebFinger → actor → outbox). Deleted items become Tombstones;
 * the inbox answers 405 to every POST.
 *
 * One test for the whole flow: the `adminPage` fixture deletes its admin, and their notes and
 * articles, when the test ends.
 */
import {
	createNoteInDb,
	createUserSession,
	deleteArticleByTitle,
	deleteNoteById,
	expect,
	getArticleByTitle,
	getNotesByBodyText,
	test,
} from "../fixtures";

const suffix = Date.now().toString(36);
const NOTE_TEXT = `Social note ${suffix}`;
const ARTICLE_TITLE = `Social article ${suffix}`;
const MEMBERS_TEXT = `Social members ${suffix}`;

let author: ReturnType<typeof createUserSession>;
let membersNoteId: string;

type Activity = {
	type: string;
	object: {
		id: string;
		type: string;
		name?: string;
		formerType?: string;
		content?: string;
	};
};

/** The `<item>` of the feed that contains `text`, or null. */
function feedItem(xml: string, text: string): string | null {
	return (
		xml.match(/<item>[\s\S]*?<\/item>/g)?.find((i) => i.includes(text)) ?? null
	);
}

test.beforeAll(() => {
	author = createUserSession("user", "social");
	membersNoteId = createNoteInDb({
		body: `<p>${MEMBERS_TEXT}</p>`,
		userId: author.userId,
		visibility: "members",
	});
});

test.afterAll(() => {
	deleteNoteById(membersNoteId);
	for (const note of getNotesByBodyText(NOTE_TEXT)) deleteNoteById(note.id);
	deleteArticleByTitle(ARTICLE_TITLE);
	author.cleanup();
});

async function writeBody(page: import("@playwright/test").Page, text: string) {
	const editor = page.locator('[contenteditable="true"]').first();
	await expect(editor).toBeVisible({ timeout: 15_000 });
	await editor.click();
	await page.keyboard.type(text);
	await expect(page.locator('input[name="body"]')).toHaveValue(
		new RegExp(text),
		{ timeout: 5_000 },
	);
}

test("every page announces the feed in its head", async ({
	guestPage: page,
}) => {
	await page.goto("/");
	await expect(
		page.locator('head link[rel="alternate"][type="application/rss+xml"]'),
	).toHaveAttribute("href", "/feed.xml");
});

test("published notes and articles reach the feed and the outbox; a deleted note becomes a Tombstone", async ({
	adminPage: page,
	guestPage,
}) => {
	test.setTimeout(90_000);
	const guest = guestPage.request;
	let noteId = "";

	await test.step("an admin publishes a public note and an article", async () => {
		await page.goto("/admin/root/notes");
		await writeBody(page, NOTE_TEXT);
		await page.getByRole("button", { name: "Publish note" }).click();
		await expect(page.locator("table")).toContainText(NOTE_TEXT, {
			timeout: 15_000,
		});
		noteId = getNotesByBodyText(NOTE_TEXT)[0]?.id ?? "";
		expect(noteId, "note saved").toBeTruthy();

		await page.goto("/admin/root/articles/new");
		await page.locator('input[name="title"]').fill(ARTICLE_TITLE);
		await writeBody(page, `Body of ${ARTICLE_TITLE}`);
		await page.getByRole("button", { name: "Publish" }).click();
		await expect(page).toHaveURL(/\/admin\/root\/articles\/?$/, {
			timeout: 15_000,
		});
		expect(getArticleByTitle(ARTICLE_TITLE)).toBeTruthy();
	});

	await test.step("the RSS feed lists both; the note has no title", async () => {
		const res = await guest.get("/feed.xml");
		expect(res.status()).toBe(200);
		expect(res.headers()["content-type"]).toContain("application/rss+xml");
		const xml = await res.text();
		const note = feedItem(xml, NOTE_TEXT);
		expect(note, "note in the feed").not.toBeNull();
		expect(note).not.toContain("<title>");
		expect(note).toContain(`<description><![CDATA[<p>${NOTE_TEXT}`);
		expect(feedItem(xml, ARTICLE_TITLE)).toContain(
			`<title>${ARTICLE_TITLE}</title>`,
		);
		// Members-only content never reaches the feed.
		expect(xml).not.toContain(MEMBERS_TEXT);

		const short = await (await guest.get("/feed.xml?kind=short")).text();
		expect(feedItem(short, NOTE_TEXT)).not.toBeNull();
		expect(feedItem(short, ARTICLE_TITLE)).toBeNull();
		const long = await (await guest.get("/feed.xml?kind=long")).text();
		expect(feedItem(long, ARTICLE_TITLE)).not.toBeNull();
		expect(feedItem(long, NOTE_TEXT)).toBeNull();

		// A second fetch with the validators is answered 304.
		const again = await guest.get("/feed.xml", {
			headers: { "If-None-Match": res.headers().etag },
		});
		expect(again.status()).toBe(304);
	});

	let outboxFirst = "";
	let inbox = "";
	await test.step("WebFinger leads to the actor and its outbox", async () => {
		await guestPage.goto("/");
		const host = new URL(guestPage.url()).host;
		const finger = await guest.get(
			`/.well-known/webfinger?resource=acct:news@${host}`,
		);
		expect(finger.status()).toBe(200);
		expect(finger.headers()["content-type"]).toContain("application/jrd+json");
		const jrd = await finger.json();
		const self = jrd.links.find((l: { rel: string }) => l.rel === "self");
		expect(self.type).toBe("application/activity+json");

		const actorRes = await guest.get(self.href, {
			headers: { Accept: "application/activity+json" },
		});
		expect(actorRes.headers()["content-type"]).toContain(
			"application/activity+json",
		);
		const actor = await actorRes.json();
		expect(actor).toMatchObject({
			id: self.href,
			type: "Service",
			preferredUsername: "news",
			pollOnly: true,
		});
		expect(actor.updateInterval).toMatch(/^P/);
		inbox = actor.inbox;

		const outbox = await (await guest.get(actor.outbox)).json();
		expect(outbox.type).toBe("OrderedCollection");
		expect(outbox.totalItems).toBeGreaterThanOrEqual(2);
		outboxFirst = outbox.first;
		const first = await (await guest.get(outboxFirst)).json();
		const items = first.orderedItems as Activity[];
		expect(
			items.find((a) => a.object.content?.includes(NOTE_TEXT)),
		).toMatchObject({ type: "Create", object: { type: "Note" } });
		expect(items.find((a) => a.object.name === ARTICLE_TITLE)).toMatchObject({
			type: "Create",
			object: { type: "Article", preview: { type: "Note" } },
		});
		expect(JSON.stringify(first)).not.toContain(MEMBERS_TEXT);
	});

	await test.step("the inbox answers 405 to a POST", async () => {
		const post = await guest.post(inbox, {
			data: { type: "Follow" },
			headers: { "Content-Type": "application/activity+json" },
		});
		expect(post.status()).toBe(405);
	});

	await test.step("after the note is deleted the outbox shows a Tombstone", async () => {
		await page.goto("/admin/root/notes");
		page.on("dialog", (d) => d.accept());
		await page
			.locator("tr", { hasText: NOTE_TEXT })
			.getByRole("button", { name: "Delete" })
			.click();
		await expect(page.locator("table")).not.toContainText(NOTE_TEXT, {
			timeout: 15_000,
		});

		const first = await (await guest.get(outboxFirst)).json();
		const deletion = (first.orderedItems as Activity[]).find(
			(a) =>
				a.type === "Delete" &&
				a.object.id.endsWith(`/social/objects/note/${noteId}`),
		);
		expect(deletion?.object).toMatchObject({
			type: "Tombstone",
			formerType: "Note",
		});
		const gone = await guest.get(`/social/objects/note/${noteId}`);
		expect(gone.status()).toBe(410);
		const xml = await (await guest.get("/feed.xml")).text();
		expect(xml).not.toContain(NOTE_TEXT);
	});
});
