import { routeAction$ } from "@qwik.dev/router";
import { requireAuth } from "~/core/auth/server-auth";
import { t } from "~/core/i18n";
import { currentScope } from "~/core/router/scope-request";
import { scopesService } from "~/core/scopes/scopes.service";

/**
 * Join the scope whose home page the form is on (`/germany/berlin`). Exported by the catch-all
 * route (relative re-export). The root cannot be joined: every user belongs to it implicitly.
 */
export const useJoinScope = routeAction$(async (_data, event) => {
	const user = await requireAuth(event);
	const scope = await currentScope(event);
	if (!scope || scope.parentId === null) {
		return event.fail(404, { error: t("core.scopes.groupNotFound") });
	}
	await scopesService.join(user.id, scope.id);
	return { success: true };
});
