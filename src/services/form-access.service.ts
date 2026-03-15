import type { Form } from "~/db/schema";

type UserLike = { id: string } | null;

export const formAccessService = {
  ensureViewAccess(form: Form, user: UserLike): { allowed: true } {
    if (form.visibility === "private" && !user) {
      throw new Error("Authentication required to access this form.");
    }

    return { allowed: true };
  },

  requiresAltcha(form: Form): boolean {
    return form.visibility === "public";
  },
};
