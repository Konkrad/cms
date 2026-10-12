import type { RequestEvent } from "~/core/auth/server-auth";
import { type Form, formsService } from "~/core/forms/forms.service";
import { ADMIN_ACCESS, requireScopeRole } from "~/core/scopes/access";
import type { Scope } from "~/core/scopes/schema/scopes";

export type FormsAdminScope = {
	/** The URL's scope: forms belong to it (site-wide forms to the root). */
	scope: Scope;
	userId: string;
};

/** Authorize a forms admin request against the URL's scope (any managing role). */
export async function resolveFormsAdminScope(
	event: RequestEvent,
): Promise<FormsAdminScope> {
	const { user, scope } = await requireScopeRole(event, ADMIN_ACCESS);
	return { scope, userId: user.id };
}

/** The form with this id when the URL's scope owns it (forms of other scopes are not editable here). */
export async function getOwnForm(
	scope: Scope,
	formId: string,
): Promise<Form | undefined> {
	const form = await formsService.getById(formId);
	return form && form.scopeId === scope.id ? form : undefined;
}

export function buildFormsAdminBasePath(scopeSegment: string): string {
	return `/admin/${scopeSegment}/forms`;
}
