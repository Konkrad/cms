import type { RequestHandler } from "@qwik.dev/router";
import { formResultsService } from "~/core/forms/form-results.service";
import {
	buildFormsAdminBasePath,
	getOwnForm,
	resolveFormsAdminScope,
} from "../../../_utils";
import { buildResponseColumns, getAnswerValue } from "../_response-pivot";

function csvEscape(value: string): string {
	if (/[",\n]/.test(value)) {
		return `"${value.replace(/"/g, '""')}"`;
	}

	return value;
}

export const onGet: RequestHandler = async (event) => {
	const { scope } = await resolveFormsAdminScope(event);
	const basePath = buildFormsAdminBasePath(event.params.scope);

	const form = await getOwnForm(scope, event.params.id);
	if (!form) {
		throw event.redirect(302, basePath);
	}

	const responses = await formResultsService.getByForm(form.id);
	const questionColumns = buildResponseColumns(form.schema, responses as any);

	const header = [
		"submitted_at",
		...questionColumns.map((column) => column.label),
	];
	const rows = responses.map((response) => [
		response.createdAt,
		...questionColumns.map((column) =>
			getAnswerValue(response.answers as Record<string, any>, column.key),
		),
	]);

	const csv = [header, ...rows]
		.map((line) => line.map((cell) => csvEscape(String(cell))).join(","))
		.join("\n");

	event.headers.set("Content-Type", "text/csv; charset=utf-8");
	event.headers.set(
		"Content-Disposition",
		`attachment; filename=form-${form.id}-responses.csv`,
	);
	event.send(200, csv);
};
