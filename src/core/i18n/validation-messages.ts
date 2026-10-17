/** Default validation messages of the router's zod 3 issues, in the site locale. */
import type { z as routerZod } from "@qwik.dev/router";
import { t } from "./index";

type Issue = Parameters<Parameters<typeof routerZod.setErrorMap>[0]>[0];

/** The catalog message for a zod issue, or undefined to keep zod's default. */
export function validationMessage(issue: Issue): string | undefined {
	switch (issue.code) {
		case "invalid_type":
			return issue.received === "undefined" || issue.received === "null"
				? t("core.validation.required")
				: t("core.validation.invalidType");
		case "too_small":
			if (issue.type === "string")
				return Number(issue.minimum) <= 1
					? t("core.validation.required")
					: t("core.validation.tooShort", { count: Number(issue.minimum) });
			if (issue.type === "number")
				return t("core.validation.tooSmall", {
					minimum: Number(issue.minimum),
				});
			if (issue.type === "array")
				return t("core.validation.tooFewItems", {
					count: Number(issue.minimum),
				});
			return undefined;
		case "too_big":
			if (issue.type === "string")
				return t("core.validation.tooLong", { count: Number(issue.maximum) });
			if (issue.type === "number")
				return t("core.validation.tooBig", { maximum: Number(issue.maximum) });
			if (issue.type === "array")
				return t("core.validation.tooManyItems", {
					count: Number(issue.maximum),
				});
			return undefined;
		case "invalid_string":
			if (issue.validation === "email")
				return t("core.validation.invalidEmail");
			if (issue.validation === "url") return t("core.validation.invalidUrl");
			return t("core.validation.invalidFormat");
		case "invalid_enum_value":
			return t("core.validation.invalidOption");
		case "invalid_date":
			return t("core.validation.invalidDate");
		default:
			return undefined;
	}
}
