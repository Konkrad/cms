import { component$ } from "@qwik.dev/core";
import TransactionsList from "../components/TransactionsList";
import type { AdminTransactionsData } from "./transactions-data";

type Props = { data: AdminTransactionsData };

export const AdminEventTransactions = component$<Props>(({ data }) => {
	const transactions = data.transactions;

	// Amounts are stored in EUR (floats). Don't divide by 100 here.
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-GB", {
			style: "currency",
			currency: "EUR",
			minimumFractionDigits: 2,
		}).format(amount);
	};

	const totalRevenue = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
	const totalFees = transactions.reduce((sum, t) => sum + t.transactionFee, 0);
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
						{formatCurrency(totalRevenue)}
					</p>
					<p class="text-sm text-gray-500 mt-1">
						{transactions.length} transaction(s)
					</p>
				</div>

				<div class="bg-white rounded-lg shadow-md p-6">
					<p class="text-sm text-gray-600 mb-1">Stripe Fees</p>
					<p class="text-3xl font-bold text-red-600">
						{formatCurrency(totalFees)}
					</p>
					<p class="text-sm text-gray-500 mt-1">Processing costs</p>
				</div>

				<div class="bg-white rounded-lg shadow-md p-6">
					<p class="text-sm text-gray-600 mb-1">Net Revenue</p>
					<p class="text-3xl font-bold text-green-600">
						{formatCurrency(netRevenue)}
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
