import crypto from "crypto";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db, type PublicUser, publicUserColumns, usersService } from "~/core";
import type { events } from "../schema/events";
import type { products } from "../schema/products";
import type { ticketParticipants } from "../schema/ticket-participants";
import {
	type InsertTicket,
	insertTicketSchema,
	type Ticket,
	tickets,
	updateTicketSchema,
} from "../schema/tickets";
import { transactions } from "../schema/transactions";

/** A ticket buyer's public identity plus their login email (admin-only shapes). */
export type BuyerWithEmail = PublicUser & { email: string | null };

/** Attaches each buyer's login email (resolved server-side from the buyer id). */
async function withBuyerEmails<T extends { buyer: PublicUser }>(
	rows: T[],
): Promise<Array<Omit<T, "buyer"> & { buyer: BuyerWithEmail }>> {
	const emails = await usersService.getEmailsByIds([
		...new Set(rows.map((r) => r.buyer.id)),
	]);
	return rows.map((r) => ({
		...r,
		buyer: { ...r.buyer, email: emails.get(r.buyer.id) ?? null },
	}));
}

export const ticketsService = {
	async create(data: InsertTicket): Promise<Ticket> {
		const validated = insertTicketSchema.parse(data);
		const [ticket] = await db
			.insert(tickets)
			.values(validated as any)
			.returning();
		return ticket;
	},

	async createBulk(
		ticketData: Array<Omit<InsertTicket, "id" | "qrCodeUuid" | "createdAt">>,
	): Promise<Ticket[]> {
		const validated = ticketData.map((data) => insertTicketSchema.parse(data));
		const result = await db
			.insert(tickets)
			.values(validated as any)
			.returning();
		return result;
	},

	async getById(id: string): Promise<
		| (Ticket & {
				buyer: PublicUser;
				product: typeof products.$inferSelect;
				event: typeof events.$inferSelect;
				participants: Array<typeof ticketParticipants.$inferSelect>;
		  })
		| undefined
	> {
		const result = await db.query.tickets.findFirst({
			where: { id },
			with: {
				buyer: { columns: publicUserColumns },
				product: true,
				event: true,
				participants: {
					orderBy: { participantOrder: "asc" },
				},
			},
		});
		return result as any;
	},

	async rotateQrCode(ticketId: string): Promise<Ticket | undefined> {
		const [result] = await db
			.update(tickets)
			.set({ qrCodeUuid: crypto.randomUUID() })
			.where(eq(tickets.id, ticketId))
			.returning();
		return result;
	},

	async getByQrCodeUuid(qrCodeUuid: string): Promise<
		| (Ticket & {
				buyer: PublicUser;
				product: typeof products.$inferSelect;
				event: typeof events.$inferSelect;
		  })
		| undefined
	> {
		const result = await db.query.tickets.findFirst({
			where: { qrCodeUuid },
			with: {
				buyer: { columns: publicUserColumns },
				product: true,
				event: true,
			},
		});
		return result as any;
	},

	/**
	 * PRIVATE: an event's tickets with the buyer's login email, for the admin tickets
	 * page only (admins search tickets by buyer email).
	 */
	async getByEventIdWithBuyerEmail(eventId: string): Promise<
		Array<
			Ticket & {
				buyer: BuyerWithEmail;
				product: typeof products.$inferSelect;
			}
		>
	> {
		const results = await db.query.tickets.findMany({
			where: { eventId },
			with: {
				buyer: { columns: publicUserColumns },
				product: true,
			},
		});
		return withBuyerEmails(results as any) as any;
	},

	async getByBuyerId(buyerId: string): Promise<
		Array<
			Ticket & {
				event: typeof events.$inferSelect;
				product: typeof products.$inferSelect;
				participants: Array<typeof ticketParticipants.$inferSelect>;
			}
		>
	> {
		const results = await db.query.tickets.findMany({
			where: { buyerId },
			with: {
				event: true,
				product: true,
				participants: {
					orderBy: { participantOrder: "asc" },
				},
			},
		});
		return results as any;
	},

	async scanTicket(
		qrDataString: string,
		eventId: string,
	): Promise<
		| {
				success: true;
				ticket: Ticket;
				participants: Array<typeof ticketParticipants.$inferSelect>;
		  }
		| { success: false; error: string }
	> {
		// Look up ticket by the scanned QR UUID
		const currentTicket = await db.query.tickets.findFirst({
			where: { qrCodeUuid: qrDataString },
			with: {
				participants: {
					orderBy: { participantOrder: "asc" },
				},
			},
		});

		if (!currentTicket) {
			return { success: false, error: "Invalid QR code" };
		}

		// Verify event ID matches
		if (currentTicket.eventId !== eventId) {
			return { success: false, error: "QR code is for a different event" };
		}

		// Check if already scanned
		if (currentTicket.scannedAt) {
			return {
				success: false,
				error: `Ticket already scanned at ${currentTicket.scannedAt}`,
			};
		}

		// Update ticket as scanned
		const [ticket] = await db
			.update(tickets)
			.set({ scannedAt: new Date().toISOString() })
			.where(and(eq(tickets.id, currentTicket.id), isNull(tickets.scannedAt)))
			.returning();

		if (!ticket) {
			return { success: false, error: "Failed to scan ticket" };
		}

		return {
			success: true,
			ticket,
			participants: currentTicket.participants as any,
		};
	},

	/** Whether a user holds a ticket for an event, and whether one of them was scanned. */
	async getViewerTicketState(
		eventId: string,
		userId: string,
	): Promise<{ hasTicket: boolean; hasAttended: boolean }> {
		const [ticket, scanned] = await Promise.all([
			db.query.tickets.findFirst({ where: { eventId, buyerId: userId } }),
			db.query.tickets.findFirst({
				where: { eventId, buyerId: userId, scannedAt: { isNotNull: true } },
			}),
		]);
		return { hasTicket: !!ticket, hasAttended: !!scanned };
	},

	async getAttendanceStats(eventId: string): Promise<{
		totalTickets: number;
		scannedTickets: number;
		freeTickets: number;
		paidTickets: number;
		attendanceRate: number;
	}> {
		const allTickets = await db.query.tickets.findMany({
			where: { eventId },
			with: {
				product: true,
			},
		});

		const totalTickets = allTickets.length;
		const scannedTickets = allTickets.filter((t) => t.scannedAt).length;
		const freeTickets = allTickets.filter((t) => t.product.price === 0).length;
		const paidTickets = totalTickets - freeTickets;
		const attendanceRate =
			totalTickets > 0 ? (scannedTickets / totalTickets) * 100 : 0;

		return {
			totalTickets,
			scannedTickets,
			freeTickets,
			paidTickets,
			attendanceRate,
		};
	},

	/** PRIVATE: scanned tickets with the buyer's login email, for the admin attendance page only. */
	async getAttendedTicketsWithBuyerEmail(eventId: string): Promise<
		Array<
			Ticket & {
				buyer: BuyerWithEmail;
				product: typeof products.$inferSelect;
				participants: Array<typeof ticketParticipants.$inferSelect>;
			}
		>
	> {
		const results = await db.query.tickets.findMany({
			where: {
				eventId,
				scannedAt: { isNotNull: true },
			},
			with: {
				buyer: { columns: publicUserColumns },
				product: true,
				participants: {
					orderBy: { participantOrder: "asc" },
				},
			},
		});
		return withBuyerEmails(results as any) as any;
	},

	async createFreeTicket(data: {
		productId: string;
		eventId: string;
		buyerId: string;
	}): Promise<Ticket> {
		// Create a dummy transaction for free tickets
		const { transactionsService } = await import("./transactions");
		const transaction = await transactionsService.create({
			userId: data.buyerId,
			eventId: data.eventId,
			totalAmount: 0,
			transactionFee: 0,
			stripeSessionId: `free_${crypto.randomUUID()}`,
			stripePaymentId: `free_${crypto.randomUUID()}`,
		});

		// Create the ticket
		const ticket = await this.create({
			transactionId: transaction.id,
			productId: data.productId,
			eventId: data.eventId,
			buyerId: data.buyerId,
		});

		return ticket;
	},

	async findUnscannedByBuyerEventProduct(data: {
		productId: string;
		eventId: string;
		buyerId: string;
	}): Promise<Ticket[]> {
		const results = await db.query.tickets.findMany({
			where: {
				productId: data.productId,
				eventId: data.eventId,
				buyerId: data.buyerId,
			},
		});
		return results.filter((t) => t.scannedAt === null) as Ticket[];
	},

	async deleteFreeTicketsByIds(ticketIds: string[]): Promise<void> {
		if (ticketIds.length === 0) return;

		const rows = await db
			.select({
				ticketId: tickets.id,
				transactionId: transactions.id,
				stripeSessionId: transactions.stripeSessionId,
			})
			.from(tickets)
			.innerJoin(transactions, eq(tickets.transactionId, transactions.id))
			.where(inArray(tickets.id, ticketIds));

		for (const row of rows) {
			await db.delete(tickets).where(eq(tickets.id, row.ticketId));
			if (row.stripeSessionId.startsWith("free_")) {
				await db
					.delete(transactions)
					.where(eq(transactions.id, row.transactionId));
			}
		}
	},
};
