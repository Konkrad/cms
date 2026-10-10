import { defineModuleSchema } from "~/core/schema";
import { eventPhotos } from "./schema/event-photos";
import { events } from "./schema/events";
import { inventoryGroups } from "./schema/inventory-groups";
import { participationStatus } from "./schema/participation-status";
import { products } from "./schema/products";
import { ticketParticipants } from "./schema/ticket-participants";
import { tickets } from "./schema/tickets";
import { transactionItems } from "./schema/transaction-items";
import { transactions } from "./schema/transactions";

export * from "./schema/event-photos";
export * from "./schema/events";
export * from "./schema/inventory-groups";
export * from "./schema/participation-status";
export * from "./schema/products";
export * from "./schema/ticket-participants";
export * from "./schema/tickets";
export * from "./schema/transaction-items";
export * from "./schema/transactions";

export default defineModuleSchema({
	tables: {
		events,
		inventoryGroups,
		products,
		transactions,
		transactionItems,
		tickets,
		ticketParticipants,
		participationStatus,
		eventPhotos,
	},
	relations: (r) => ({
		events: {
			user: r.one.users({
				from: r.events.userId,
				to: r.users.id,
				optional: false,
			}),
			group: r.one.groups({ from: r.events.groupId, to: r.groups.id }),
			deletedByUser: r.one.users({
				from: r.events.deletedBy,
				to: r.users.id,
			}),
			inventoryGroups: r.many.inventoryGroups({
				from: r.events.id,
				to: r.inventoryGroups.eventId,
			}),
			participationRows: r.many.participationStatus({
				from: r.events.id,
				to: r.participationStatus.eventId,
			}),
		},
		inventoryGroups: {
			event: r.one.events({
				from: r.inventoryGroups.eventId,
				to: r.events.id,
				optional: false,
			}),
			products: r.many.products({
				from: r.inventoryGroups.id,
				to: r.products.inventoryGroupId,
			}),
		},
		products: {
			event: r.one.events({
				from: r.products.eventId,
				to: r.events.id,
				optional: false,
			}),
			inventoryGroup: r.one.inventoryGroups({
				from: r.products.inventoryGroupId,
				to: r.inventoryGroups.id,
				optional: false,
			}),
			transactionItems: r.many.transactionItems({
				from: r.products.id,
				to: r.transactionItems.productId,
			}),
			tickets: r.many.tickets({
				from: r.products.id,
				to: r.tickets.productId,
			}),
		},
		transactions: {
			event: r.one.events({
				from: r.transactions.eventId,
				to: r.events.id,
				optional: false,
			}),
			user: r.one.users({
				from: r.transactions.userId,
				to: r.users.id,
				optional: false,
			}),
			items: r.many.transactionItems({
				from: r.transactions.id,
				to: r.transactionItems.transactionId,
			}),
			tickets: r.many.tickets({
				from: r.transactions.id,
				to: r.tickets.transactionId,
			}),
		},
		transactionItems: {
			transaction: r.one.transactions({
				from: r.transactionItems.transactionId,
				to: r.transactions.id,
				optional: false,
			}),
			product: r.one.products({
				from: r.transactionItems.productId,
				to: r.products.id,
				optional: false,
			}),
		},
		tickets: {
			transaction: r.one.transactions({
				from: r.tickets.transactionId,
				to: r.transactions.id,
				optional: false,
			}),
			product: r.one.products({
				from: r.tickets.productId,
				to: r.products.id,
				optional: false,
			}),
			event: r.one.events({
				from: r.tickets.eventId,
				to: r.events.id,
				optional: false,
			}),
			buyer: r.one.users({
				from: r.tickets.buyerId,
				to: r.users.id,
				optional: false,
			}),
			participants: r.many.ticketParticipants({
				from: r.tickets.id,
				to: r.ticketParticipants.ticketId,
			}),
		},
		ticketParticipants: {
			ticket: r.one.tickets({
				from: r.ticketParticipants.ticketId,
				to: r.tickets.id,
				optional: false,
			}),
		},
		participationStatus: {
			user: r.one.users({
				from: r.participationStatus.userId,
				to: r.users.id,
				optional: false,
			}),
			event: r.one.events({
				from: r.participationStatus.eventId,
				to: r.events.id,
				optional: false,
			}),
		},
		eventPhotos: {
			event: r.one.events({
				from: r.eventPhotos.eventId,
				to: r.events.id,
				optional: false,
			}),
			uploader: r.one.users({
				from: r.eventPhotos.uploadedBy,
				to: r.users.id,
				optional: false,
			}),
		},
		users: {
			events: r.many.events({ from: r.users.id, to: r.events.userId }),
		},
	}),
});
