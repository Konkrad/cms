import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { AdminEventTransactions } from "../../../../../../modules/events/admin/transactions";
import { loadAdminTransactions } from "../../../../../../modules/events/admin/transactions-data";

export const useTransactions = routeLoader$(async (event) =>
	assertNoPrivateFields(await loadAdminTransactions(event), {
		// Admin transactions: the buyer's email for payment support/reconciliation.
		allow: ["email"],
	}),
);

export default component$(() => {
	const data = useTransactions();
	return <AdminEventTransactions data={data.value} />;
});
