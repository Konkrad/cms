import { defineRelations } from "drizzle-orm/relations";
import { logins } from "../auth/schema/logins";
import { sessions } from "../auth/schema/sessions";
import { articles } from "../content/schema/articles";
import { menuItems } from "../content/schema/menu-items";
import { notes } from "../content/schema/notes";
import { pages } from "../content/schema/pages";
import { contentTombstones } from "../content/schema/tombstones";
import { formResults } from "../forms/schema/form-results";
import { formAssignments, forms } from "../forms/schema/forms";
import { userMemberships } from "../memberships/schema";
import {
	notificationOutbox,
	notificationPreferences,
} from "../notifications/schema";
import { paymentEvents, payments } from "../payments/schema";
import { moduleTables, withModuleRelations } from "../registry/schemas";
import { userRequirements } from "../requirements/schema";
import { reviews } from "../reviews/schema";
import { redirects } from "../router/schema";
import { handlerCalls, scheduleRuns } from "../scheduler/schema";
import { scopeMemberships, scopeRoles, scopes } from "../scopes/schema/scopes";
import { tagDefinitions } from "../tags/schema/tag-definitions";
import { userTags } from "../tags/schema/user-tags";
import { users } from "../users/schema";

export * from "../auth/schema/logins";
export * from "../auth/schema/sessions";
export * from "../content/schema/articles";
export * from "../content/schema/menu-items";
export * from "../content/schema/notes";
export * from "../content/schema/pages";
export * from "../content/schema/shared";
export * from "../content/schema/tombstones";
export * from "../forms/schema/form-results";
export * from "../forms/schema/forms";
export * from "../memberships/schema";
export * from "../notifications/schema";
export * from "../payments/schema";
export * from "../registry/schemas";
export * from "../requirements/schema";
export * from "../reviews/schema";
export * from "../router/schema";
export * from "../scheduler/schema";
export * from "../scopes/schema/scopes";
export * from "../tags/schema/tag-definitions";
export * from "../tags/schema/user-tags";
export * from "../users/schema";

export const schemaRelations = defineRelations(
	{
		logins,
		menuItems,
		pages,
		sessions,
		users,
		notes,
		articles,
		contentTombstones,
		forms,
		formAssignments,
		formResults,
		userMemberships,
		notificationOutbox,
		notificationPreferences,
		redirects,
		scheduleRuns,
		handlerCalls,
		payments,
		paymentEvents,
		reviews,
		userRequirements,
		tagDefinitions,
		userTags,
		scopes,
		scopeRoles,
		scopeMemberships,
		...moduleTables,
	},
	(r) => {
		const {
			sessions,
			users,
			notes,
			articles,
			forms,
			formResults,
			menuItems,
			pages,
			userMemberships,
			tagDefinitions,
			userTags,
			scopes,
			scopeRoles,
			scopeMemberships,
			one,
			many,
		} = r;
		return withModuleRelations(
			{
				menuItems: {
					page: one.pages({
						from: menuItems.pageId,
						to: pages.id,
						optional: true,
					}),
				},
				pages: {
					menuItem: one.menuItems({
						from: pages.id,
						to: menuItems.pageId,
						optional: true,
					}),
				},
				sessions: {
					user: one.users({ from: sessions.userId, to: users.id }),
				},
				notes: {
					author: one.users({
						from: notes.authorId,
						to: users.id,
						optional: false,
					}),
					scope: one.scopes({ from: notes.scopeId, to: scopes.id }),
				},
				articles: {
					author: one.users({
						from: articles.authorId,
						to: users.id,
						optional: false,
					}),
					scope: one.scopes({ from: articles.scopeId, to: scopes.id }),
				},
				formResults: {
					form: one.forms({
						from: formResults.formId,
						to: forms.id,
						optional: false,
					}),
					user: one.users({ from: formResults.userId, to: users.id }),
				},
				userMemberships: {
					user: one.users({
						from: userMemberships.userId,
						to: users.id,
						optional: false,
					}),
					granter: one.users({ from: userMemberships.grantedBy, to: users.id }),
				},
				userTags: {
					user: one.users({
						from: userTags.userId,
						to: users.id,
						optional: false,
					}),
					granter: one.users({ from: userTags.grantedBy, to: users.id }),
				},
				scopes: {
					parent: one.scopes({ from: scopes.parentId, to: scopes.id }),
					children: many.scopes({ from: scopes.id, to: scopes.parentId }),
					roles: many.scopeRoles({ from: scopes.id, to: scopeRoles.scopeId }),
					memberships: many.scopeMemberships({
						from: scopes.id,
						to: scopeMemberships.scopeId,
					}),
				},
				scopeRoles: {
					user: one.users({
						from: scopeRoles.userId,
						to: users.id,
						optional: false,
					}),
					scope: one.scopes({
						from: scopeRoles.scopeId,
						to: scopes.id,
						optional: false,
					}),
				},
				scopeMemberships: {
					user: one.users({
						from: scopeMemberships.userId,
						to: users.id,
						optional: false,
					}),
					scope: one.scopes({
						from: scopeMemberships.scopeId,
						to: scopes.id,
						optional: false,
					}),
				},
				users: {
					scopeRoles: many.scopeRoles({
						from: users.id,
						to: scopeRoles.userId,
					}),
					scopeMemberships: many.scopeMemberships({
						from: users.id,
						to: scopeMemberships.userId,
					}),
					notes: many.notes({ from: users.id, to: notes.authorId }),
					articles: many.articles({ from: users.id, to: articles.authorId }),
					sessions: many.sessions({ from: users.id, to: sessions.userId }),
					membership: many.userMemberships({
						from: users.id,
						to: userMemberships.userId,
					}),
					tags: many.userTags({ from: users.id, to: userTags.userId }),
				},
			},
			r,
		);
	},
);
