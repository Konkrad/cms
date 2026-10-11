import { and, desc, eq, inArray, like, sql } from "drizzle-orm";
import {
	canViewStreamItem,
	changedSubject,
	checkVisibility,
	cleanNoteBody,
	requireExistingScope,
	type StreamItemInput,
	validateSubject,
} from "~/core/content/content-input";
import { textExcerpt } from "~/core/content/content-items";
import { type Note, notes } from "~/core/content/schema/notes";
import { db } from "~/core/db/connection";
import {
	type PublicUser,
	publicUserColumns,
	publicUserThumbnailUrl,
} from "~/core/users/public-user";
import { users as usersTable } from "~/core/users/schema";

export type { Note };

/** A note with its author's public identity (never the users row). */
export type NoteWithAuthor = Note & { author: PublicUser };

/** What a caller may set on a note: no title, no image (spec 4.4). */
export type NoteInput = StreamItemInput;

const withAuthor = { author: { columns: publicUserColumns } } as const;

/** The label of a note where a title is needed (link picker, admin lists): its first words. */
export const noteLabel = (body: string) => textExcerpt(body, 60);

/**
 * Notes (spec 4.4): short stream items without a title or image. Listings that mix notes and
 * articles go through the stream reader (`stream.service.ts`).
 */
export const notesService = {
	canView: canViewStreamItem,

	/** Notes by id with public authors, in no particular order (stream hydration). */
	async byIds(ids: readonly string[]): Promise<NoteWithAuthor[]> {
		if (!ids.length) return [];
		return (await db.query.notes.findMany({
			with: withAuthor,
			where: { id: { in: [...ids] } },
		})) as NoteWithAuthor[];
	},

	/** Every note about one item, published or not, newest first (the item's admin page). */
	async listForSubject(
		subjectType: string,
		subjectId: string,
	): Promise<NoteWithAuthor[]> {
		return (await db.query.notes.findMany({
			with: withAuthor,
			where: { subjectType, subjectId },
			orderBy: { publishedAt: "desc", id: "desc" },
		})) as NoteWithAuthor[];
	},

	/** Admin note list (text search; `scopeIds` limits it to those scopes, null = all). */
	async adminList({
		scopeIds,
		search,
		limit,
		offset,
	}: {
		scopeIds: string[] | null;
		search: string;
		limit: number;
		offset: number;
	}) {
		const where = and(
			scopeIds ? inArray(notes.scopeId, scopeIds) : undefined,
			search ? like(notes.body, `%${search}%`) : undefined,
		);
		const [countRows, rows] = await Promise.all([
			db.select({ total: sql<number>`COUNT(*)` }).from(notes).where(where),
			db
				.select({
					id: notes.id,
					body: notes.body,
					visibility: notes.visibility,
					subjectType: notes.subjectType,
					subjectId: notes.subjectId,
					publishedAt: notes.publishedAt,
					updatedAt: notes.updatedAt,
					authorName: usersTable.name,
					authorFamilyName: usersTable.familyName,
				})
				.from(notes)
				.leftJoin(usersTable, eq(notes.authorId, usersTable.id))
				.where(where)
				.orderBy(desc(notes.publishedAt), desc(notes.updatedAt))
				.limit(limit)
				.offset(offset),
		]);
		return {
			total: Number(countRows[0]?.total ?? 0),
			items: rows.map(({ authorName, authorFamilyName, body, ...r }) => ({
				...r,
				excerpt: textExcerpt(body, 140),
				author: { name: authorName ?? "", familyName: authorFamilyName ?? "" },
			})),
		};
	},

	/**
	 * A note with its author's public identity and thumbnail. Does NOT check visibility:
	 * public pages must call `canView` before showing it.
	 */
	async getById(id: string): Promise<
		| (Note & {
				author: PublicUser & { profilePictureSmallUrl: string | null };
		  })
		| undefined
	> {
		const result = await db.query.notes.findFirst({
			where: { id },
			with: {
				author: {
					columns: {
						...publicUserColumns,
						profilePicture: true,
						profilePictureSmall: true,
					},
				},
			},
		});
		if (!result?.author) return undefined;
		const { profilePicture, profilePictureSmall, ...author } = result.author;
		return {
			...result,
			author: {
				...author,
				profilePictureSmallUrl: publicUserThumbnailUrl({
					profilePicture,
					profilePictureSmall,
				}),
			},
		};
	},

	/** Owning scope and label of the notes with these ids (reference resolution). */
	async locate(
		ids: readonly string[],
	): Promise<Array<{ id: string; scopeId: string; title: string }>> {
		if (!ids.length) return [];
		const rows = await db
			.select({ id: notes.id, scopeId: notes.scopeId, body: notes.body })
			.from(notes)
			.where(inArray(notes.id, [...ids]));
		return rows.map((r) => ({
			id: r.id,
			scopeId: r.scopeId,
			title: noteLabel(r.body),
		}));
	},

	/** Published public notes whose text contains `query`, newest first (link picker). */
	async searchPublic(
		query: string,
		limit: number,
	): Promise<Array<{ id: string; scopeId: string; title: string }>> {
		const rows = await db
			.select({ id: notes.id, scopeId: notes.scopeId, body: notes.body })
			.from(notes)
			.where(
				and(
					sql`${notes.publishedAt} IS NOT NULL`,
					eq(notes.visibility, "public"),
					like(notes.body, `%${query}%`),
				),
			)
			.orderBy(desc(notes.publishedAt))
			.limit(limit);
		return rows.map((r) => ({
			id: r.id,
			scopeId: r.scopeId,
			title: noteLabel(r.body),
		}));
	},

	/**
	 * Creates and publishes a note by `authorId`. Validates what the caller cannot be trusted
	 * with: the scope exists, the author may use the visibility on it (`allowedVisibilities`),
	 * the subject resolves; sanitizes the body (links only, `NOTE_MAX_LENGTH`). Throws
	 * `ContentInputError` otherwise. Callers authorize first (e.g. `requireScopeRole`).
	 */
	async create(input: NoteInput & { authorId: string }): Promise<Note> {
		await requireExistingScope(input.scopeId);
		await checkVisibility(input.authorId, input.scopeId, input.visibility);
		const subject = await validateSubject(input.subjectType, input.subjectId);
		const now = new Date().toISOString();
		const [row] = await db
			.insert(notes)
			.values({
				id: crypto.randomUUID(),
				scopeId: input.scopeId,
				...subject,
				body: await cleanNoteBody(input.body),
				visibility: input.visibility,
				authorId: input.authorId,
				publishedAt: now,
				updatedAt: now,
			})
			.returning();
		return row;
	},

	/**
	 * Updates body, visibility and subject (whitelisted; scope and author never change).
	 * `editorId` is checked against a changed visibility like an author on create.
	 */
	async update(
		id: string,
		input: Partial<Omit<NoteInput, "scopeId">>,
		editorId: string,
	): Promise<Note | undefined> {
		const current = await db.query.notes.findFirst({ where: { id } });
		if (!current) return undefined;
		const changes: Partial<Note> = { updatedAt: new Date().toISOString() };
		if (input.body !== undefined)
			changes.body = await cleanNoteBody(input.body);
		if (
			input.visibility !== undefined &&
			input.visibility !== current.visibility
		) {
			await checkVisibility(editorId, current.scopeId, input.visibility);
			changes.visibility = input.visibility;
		}
		const subject = await changedSubject(input, current);
		if (subject) Object.assign(changes, subject);
		const [row] = await db
			.update(notes)
			.set(changes)
			.where(eq(notes.id, id))
			.returning();
		return row;
	},

	async delete(id: string): Promise<void> {
		await db.delete(notes).where(eq(notes.id, id));
	},
};
