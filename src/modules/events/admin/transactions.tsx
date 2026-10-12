import { component$ } from "@qwik.dev/core";
import { formatCurrency } from "~/core/ui";
import TransactionsList from "../components/TransactionsList";
import type { AdminTransactionsData } from "./transactions-data";

type Props = { data: AdminTransactionsData };

export const AdminEventTransactions = component$<Props>(({ data }) => {
	const transactions = data.transactions;

	// Amounts are stored in EUR (floats). Don't divide by 100 here.
	const formatEuro = (amount: number) => formatCurrency(amount, "EUR");

	// Only completed orders count; pending, canceled and refunded ones are listed below.
	const paid = transactions.filter((t) => t.status === "paid");
	const totalRevenue = paid.reduce((sum, t) => sum + t.totalAmount, 0);
	const totalFees = paid.reduce((sum, t) => sum + t.transactionFee, 0);
	const netRevenue = totalRevenue - totalFees;

	return (
		<div class="space-y-6">
			<div>
				<h2 class="text-2xl font-bold mb-2">Transactions</h2>
				<p class="text-gray-600">
					Review all purchases and financial details for this event
				</p>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div class="bg-white rounded-lg shadow-md p-6">
					<p class="text-sm text-gray-600 mb-1">Total Revenue</p>
					<p class="text-3xl font-bold text-gray-900">
						{formatEuro(totalRevenue)}
					</p>
					<p class="text-sm text-gray-500 mt-1">
						{paid.length} paid transaction(s)
					</p>
				</div>

				<div class="bg-white rounded-lg shadow-md p-6">
					<p class="text-sm text-gray-600 mb-1">Fees</p>
					<p class="text-3xl font-bold text-red-600">{formatEuro(totalFees)}</p>
					<p class="text-sm text-gray-500 mt-1">Processing costs</p>
				</div>

				<div class="bg-white rounded-lg shadow-md p-6">
					<p class="text-sm text-gray-600 mb-1">Net Revenue</p>
					<p class="text-3xl font-bold text-green-600">
						{formatEuro(netRevenue)}
					</p>
					<p class="text-sm text-gray-500 mt-1">After fees</p>
				</div>
			</div>

			<div>
				<h3 class="text-xl font-semibold mb-4">Transaction History</h3>
				<TransactionsList transactions={transactions} />
			</div>
		</div>
	);
});
