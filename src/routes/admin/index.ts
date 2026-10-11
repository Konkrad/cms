import type { RequestHandler } from "@qwik.dev/router";
import { adminUrl } from "~/core/router/scope-path";
import { currentUser, listManagedScopes } from "~/core/scopes/access";

/**
 * `/admin`: the admin of the highest scope the user manages (the root for platform admins,
 * their chapter for a representative). 403 for users without a managing role.
 */
export const onGet: RequestHandler = async (event) => {
	const user = await currentUser(event);
	if (!user) throw event.redirect(302, "/login");
	const [first] = await listManagedScopes(user);
	if (!first) throw event.error(403, "Forbidden");
	throw event.redirect(302, adminUrl(first.path));
};
