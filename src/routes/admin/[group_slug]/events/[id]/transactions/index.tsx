import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { AdminEventTransactions } from "../../../../../../../modules/events/admin/transactions";
import { loadAdminTransactions } from "../../../../../../../modules/events/admin/transactions-data";

export const useTransactions = routeLoader$((event) =>
	loadAdminTransactions(event),
);

export default component$(() => {
	const data = useTransactions();
	return <AdminEventTransactions data={data.value} />;
});
