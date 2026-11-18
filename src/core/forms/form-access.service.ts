import type { Form } from "~/core/forms/schema/forms";

type UserLike = { id: string } | null;

export const formAccessService = {
	ensureViewAccess(
		form: Pick<Form, "visibility">,
		user: UserLike,
	): { allowed: true } {
		if (form.visibility === "private" && !user) {
			throw new Error("Authentication required to access this form.");
		}

		return { allowed: true };
	},

	requiresAltcha(form: Pick<Form, "visibility">): boolean {
		return form.visibility === "public";
	},
};
