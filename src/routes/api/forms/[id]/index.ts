import type { RequestHandler } from "@qwik.dev/router";
import { formAccessService } from "~/services/form-access.service";
import { formsService } from "~/services/forms.service";
import { getServerSession } from "~/utils/server-auth";

export const onGet: RequestHandler = async (event) => {
  const { params, json } = event;
  const form = await formsService.getById(params.id);
  if (!form) {
    json(404, { error: "Form not found" });
    return;
  }

  const user = await getServerSession(event as any);

  try {
    formAccessService.ensureViewAccess(form, user);
  } catch {
    json(401, { error: "Authentication required" });
    return;
  }

  json(200, {
    data: {
      id: form.id,
      title: form.title,
      description: form.description,
      schemaJson: form.schemaJson,
      requireAltcha: formAccessService.requiresAltcha(form),
    },
  });
};
