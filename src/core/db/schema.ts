import { defineRelations } from "drizzle-orm/relations";
import { formResults } from "../../db/schemas/form-results";
import { forms } from "../../db/schemas/forms";
import { logins } from "../auth/schema/logins";
import { sessions } from "../auth/schema/sessions";
import { menuItems } from "../content/schema/menu-items";
import { pages } from "../content/schema/pages";
import { posts } from "../content/schema/posts";
import { userMemberships } from "../memberships/schema";
import { moduleTables, withModuleRelations } from "../registry/schemas";
import { groupMemberships } from "../scopes/schema/group-memberships";
import { groupRepresentatives } from "../scopes/schema/group-representatives";
import { groups } from "../scopes/schema/groups";
import { scopeMemberships, scopeRoles, scopes } from "../scopes/schema/scopes";
import { tagDefinitions } from "../tags/schema/tag-definitions";
import { userTags } from "../tags/schema/user-tags";
import { users } from "../users/schema";

export * from "../../db/schemas/form-results";
export * from "../../db/schemas/forms";
export * from "../auth/schema/logins";
export * from "../auth/schema/sessions";
export * from "../content/schema/menu-items";
export * from "../content/schema/pages";
export * from "../content/schema/posts";
export * from "../content/schema/shared";
export * from "../memberships/schema";
export * from "../registry/schemas";
export * from "../scopes/schema/group-memberships";
export * from "../scopes/schema/group-representatives";
export * from "../scopes/schema/groups";
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
		groups,
		groupMemberships,
		groupRepresentatives,
		posts,
		forms,
		formResults,
		userMemberships,
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
			groups,
			posts,
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
				posts: {
					user: one.users({
						from: posts.userId,
						to: users.id,
						optional: false,
					}),
					group: one.groups({ from: posts.groupId, to: groups.id }),
					deletedByUser: one.users({ from: posts.deletedBy, to: users.id }),
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
					posts: many.posts({ from: users.id, to: posts.userId }),
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
