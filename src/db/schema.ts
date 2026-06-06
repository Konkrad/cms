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
import { jobs } from "./schemas/jobs";
import { qualificationTypes } from "./schemas/qualification-types";
import { qualificationTokens } from "./schemas/qualification-tokens";
import { userQualifications } from "./schemas/user-qualifications";
import { userMemberships } from "./schemas/user-memberships";
import { tagDefinitions } from "./schemas/tag-definitions";
import { userTags } from "./schemas/user-tags";
import { electionCycles } from "./schemas/election-cycles";
import { electionPositions } from "./schemas/election-positions";
import { electionApplications } from "./schemas/election-applications";

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
export * from "./schemas/deals";
export * from "./schemas/jobs";
export * from "./schemas/qualification-types";
export * from "./schemas/qualification-tokens";
export * from "./schemas/user-qualifications";
export * from "./schemas/user-memberships";
export * from "./schemas/tag-definitions";
export * from "./schemas/user-tags";
export * from "./schemas/election-cycles";
export * from "./schemas/election-positions";
export * from "./schemas/election-applications";

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
		jobs,
		qualificationTypes,
		qualificationTokens,
		userQualifications,
		userMemberships,
		tagDefinitions,
		userTags,
		electionCycles,
		electionPositions,
		electionApplications,
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
		menuItems,
		pages,
		jobs,
		qualificationTypes,
		qualificationTokens,
		userQualifications,
		userMemberships,
		tagDefinitions,
		userTags,
		electionCycles,
		electionPositions,
		electionApplications,
		one,
		many,
	}) => ({
		menuItems: {
			page: one.pages({ from: menuItems.pageId, to: pages.id, optional: true }),
		},
		pages: {
			menuItem: one.menuItems({ from: pages.id, to: menuItems.pageId, optional: true }),
		},
		jobs: {
			user: one.users({ from: jobs.suggestedBy, to: users.id, optional: false }),
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
		qualificationTypes: {
			qualifications: many.userQualifications({
				from: qualificationTypes.id,
				to: userQualifications.typeId,
			}),
			tokens: many.qualificationTokens({
				from: qualificationTypes.id,
				to: qualificationTokens.typeId,
			}),
		},
		qualificationTokens: {
			type: one.qualificationTypes({
				from: qualificationTokens.typeId,
				to: qualificationTypes.id,
				optional: false,
			}),
			creator: one.users({
				from: qualificationTokens.createdBy,
				to: users.id,
				optional: false,
			}),
		},
		userQualifications: {
			user: one.users({ from: userQualifications.userId, to: users.id, optional: false }),
			verifier: one.users({ from: userQualifications.verifiedBy, to: users.id }),
			type: one.qualificationTypes({
				from: userQualifications.typeId,
				to: qualificationTypes.id,
				optional: false,
			}),
		},
		userMemberships: {
			user: one.users({ from: userMemberships.userId, to: users.id, optional: false }),
			granter: one.users({ from: userMemberships.grantedBy, to: users.id }),
		},
		userTags: {
			user: one.users({ from: userTags.userId, to: users.id, optional: false }),
			granter: one.users({ from: userTags.grantedBy, to: users.id }),
		},
		electionCycles: {
			positions: many.electionPositions({
				from: electionCycles.id,
				to: electionPositions.cycleId,
			}),
		},
		electionPositions: {
			cycle: one.electionCycles({
				from: electionPositions.cycleId,
				to: electionCycles.id,
				optional: false,
			}),
			applications: many.electionApplications({
				from: electionPositions.id,
				to: electionApplications.positionId,
			}),
		},
		electionApplications: {
			position: one.electionPositions({
				from: electionApplications.positionId,
				to: electionPositions.id,
				optional: false,
			}),
			cycle: one.electionCycles({
				from: electionApplications.cycleId,
				to: electionCycles.id,
				optional: false,
			}),
			user: one.users({
				from: electionApplications.userId,
				to: users.id,
				optional: false,
			}),
		},
		users: {
			posts: many.posts({ from: users.id, to: posts.userId }),
			events: many.events({ from: users.id, to: events.userId }),
			sessions: many.sessions({ from: users.id, to: sessions.userId }),
			jobs: many.jobs({ from: users.id, to: jobs.suggestedBy }),
			qualifications: many.userQualifications({ from: users.id, to: userQualifications.userId }),
			membership: many.userMemberships({ from: users.id, to: userMemberships.userId }),
			tags: many.userTags({ from: users.id, to: userTags.userId }),
			electionApplications: many.electionApplications({ from: users.id, to: electionApplications.userId }),
		},
	}),
);
