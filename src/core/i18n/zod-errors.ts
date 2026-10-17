/**
 * Validation messages in the site locale (server only, imported by entry.ssr.tsx): actions
 * validate with the router's zod 3 (`zod$`), whose default messages are mapped through the
 * catalog (`validationMessage`); schemas built with zod 4 (`"zod"`, requirement inputs) use
 * zod's own locale. Explicit messages in a schema (`.min(1, t("…"))`) win over both.
 */
import { z as routerZod } from "@qwik.dev/router";
import { z } from "zod";
import { de } from "zod/locales";
import { siteLocale } from "./index";
import { validationMessage } from "./validation-messages";

if (siteLocale === "de") z.config(de());

routerZod.setErrorMap((issue, ctx) => ({
	message: validationMessage(issue) ?? ctx.defaultError,
}));
