import { defineRelations } from "drizzle-orm/relations";
import { moduleTables, withModuleRelations } from "../core/registry/schemas";
import { formResults } from "./schemas/form-results";
import { forms } from "./schemas/forms";
import { groupMemberships } from "./schemas/group-memberships";
import { groupRepresentatives } from "./schemas/group-representatives";
import { groups } from "./schemas/groups";
import { logins } from "./schemas/logins";
import { menuItems } from "./schemas/menu-items";
import { pages } from "./schemas/pages";
import { posts } from "./schemas/posts";
import { scopeMemberships, scopeRoles, scopes } from "./schemas/scopes";
import { sessions } from "./schemas/sessions";
import { tagDefinitions } from "./schemas/tag-definitions";
import { userMemberships } from "./schemas/user-memberships";
import { userTags } from "./schemas/user-tags";
import { users } from "./schemas/users";

export * from "../core/registry/schemas";
export * from "./schemas/form-results";
export * from "./schemas/forms";
export * from "./schemas/group-memberships";
export * from "./schemas/group-representatives";
export * from "./schemas/groups";
export * from "./schemas/logins";
export * from "./schemas/menu-items";
export * from "./schemas/pages";
export * from "./schemas/posts";
export * from "./schemas/scopes";
export * from "./schemas/sessions";
export * from "./schemas/shared";
export * from "./schemas/tag-definitions";
export * from "./schemas/user-memberships";
export * from "./schemas/user-tags";
export * from "./schemas/users";

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
