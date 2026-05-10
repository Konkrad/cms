import { defineRelations } from "drizzle-orm/relations";
import { events } from "./schemas/events";
import { logins } from "./schemas/logins";
import { menuItems } from "./schemas/menu-items";
import { pages } from "./schemas/pages";
import { sessions } from "./schemas/sessions";
import { users } from "./schemas/users";
import { groups } from "./schemas/groups";
import { groupMemberships } from "./schemas/group-memberships";
import { groupRepresentatives } from "./schemas/group-representatives";
import { inventoryGroups } from "./schemas/inventory-groups";
import { products } from "./schemas/products";
import { posts } from "./schemas/posts";
import { transactions } from "./schemas/transactions";
import { transactionItems } from "./schemas/transaction-items";
import { tickets } from "./schemas/tickets";
import { ticketParticipants } from "./schemas/ticket-participants";
import { participationStatus } from "./schemas/participation-status";
import { eventPhotos } from "./schemas/event-photos";
import { forms } from "./schemas/forms";
import { formResults } from "./schemas/form-results";

export * from "./schemas/events";
export * from "./schemas/logins";
export * from "./schemas/menu-items";
export * from "./schemas/pages";
export * from "./schemas/posts";
export * from "./schemas/sessions";
export * from "./schemas/shared";
export * from "./schemas/users";
export * from "./schemas/groups";
export * from "./schemas/group-memberships";
export * from "./schemas/group-representatives";
export * from "./schemas/inventory-groups";
export * from "./schemas/products";
export * from "./schemas/transactions";
export * from "./schemas/transaction-items";
export * from "./schemas/tickets";
export * from "./schemas/ticket-participants";
export * from "./schemas/participation-status";
export * from "./schemas/event-photos";
export * from "./schemas/forms";
export * from "./schemas/form-results";

export const schemaRelations = defineRelations(
	{
		events,
		logins,
		menuItems,
		pages,
		sessions,
		users,
		groups,
		groupMemberships,
		groupRepresentatives,
		inventoryGroups,
		products,
		posts,
		transactions,
		transactionItems,
		tickets,
		ticketParticipants,
		participationStatus,
		eventPhotos,
		forms,
		formResults,
	},
	({
		events,
		sessions,
		users,
		groups,
		inventoryGroups,
		products,
		posts,
		transactions,
		transactionItems,
		tickets,
		ticketParticipants,
		participationStatus,
		eventPhotos,
		forms,
		formResults,
		one,
		many,
	}) => ({
		users: {
			posts: many.posts({ from: users.id, to: posts.userId }),
			events: many.events({ from: users.id, to: events.userId }),
			sessions: many.sessions({ from: users.id, to: sessions.userId }),
		},
		sessions: {
			user: one.users({ from: sessions.userId, to: users.id }),
		},
		events: {
			user: one.users({ from: events.userId, to: users.id, optional: false }),
			group: one.groups({ from: events.groupId, to: groups.id }),
			deletedByUser: one.users({ from: events.deletedBy, to: users.id }),
			inventoryGroups: many.inventoryGroups({
				from: events.id,
				to: inventoryGroups.eventId,
			}),
			participationRows: many.participationStatus({
				from: events.id,
				to: participationStatus.eventId,
			}),
		},
		inventoryGroups: {
			event: one.events({
				from: inventoryGroups.eventId,
				to: events.id,
				optional: false,
			}),
			products: many.products({
				from: inventoryGroups.id,
				to: products.inventoryGroupId,
			}),
		},
		products: {
			event: one.events({ from: products.eventId, to: events.id, optional: false }),
			inventoryGroup: one.inventoryGroups({
				from: products.inventoryGroupId,
				to: inventoryGroups.id,
				optional: false,
			}),
			transactionItems: many.transactionItems({
				from: products.id,
				to: transactionItems.productId,
			}),
			tickets: many.tickets({ from: products.id, to: tickets.productId }),
		},
		posts: {
			user: one.users({ from: posts.userId, to: users.id, optional: false }),
			group: one.groups({ from: posts.groupId, to: groups.id }),
			deletedByUser: one.users({ from: posts.deletedBy, to: users.id }),
		},
		transactions: {
			event: one.events({ from: transactions.eventId, to: events.id, optional: false }),
			user: one.users({ from: transactions.userId, to: users.id, optional: false }),
			items: many.transactionItems({
				from: transactions.id,
				to: transactionItems.transactionId,
			}),
			tickets: many.tickets({ from: transactions.id, to: tickets.transactionId }),
		},
		transactionItems: {
			transaction: one.transactions({
				from: transactionItems.transactionId,
				to: transactions.id,
				optional: false,
			}),
			product: one.products({
				from: transactionItems.productId,
				to: products.id,
				optional: false,
			}),
		},
		tickets: {
			transaction: one.transactions({
				from: tickets.transactionId,
				to: transactions.id,
				optional: false,
			}),
			product: one.products({ from: tickets.productId, to: products.id, optional: false }),
			event: one.events({ from: tickets.eventId, to: events.id, optional: false }),
			buyer: one.users({ from: tickets.buyerId, to: users.id, optional: false }),
			participants: many.ticketParticipants({
				from: tickets.id,
				to: ticketParticipants.ticketId,
			}),
		},
		ticketParticipants: {
			ticket: one.tickets({
				from: ticketParticipants.ticketId,
				to: tickets.id,
				optional: false,
			}),
		},
		participationStatus: {
			user: one.users({
				from: participationStatus.userId,
				to: users.id,
				optional: false,
			}),
			event: one.events({
				from: participationStatus.eventId,
				to: events.id,
				optional: false,
			}),
		},
		eventPhotos: {
			event: one.events({ from: eventPhotos.eventId, to: events.id, optional: false }),
			uploader: one.users({ from: eventPhotos.uploadedBy, to: users.id, optional: false }),
		},
		formResults: {
			form: one.forms({ from: formResults.formId, to: forms.id, optional: false }),
			user: one.users({ from: formResults.userId, to: users.id }),
		},
	}),
);
