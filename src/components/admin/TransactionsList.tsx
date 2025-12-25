import { component$ } from "@builder.io/qwik";
import type { Transaction } from "~/db/schemas/transactions";
import type { users, transactionItems, products } from "~/db/schema";
import TransactionCard from "./TransactionCard";

interface TransactionWithDetails extends Transaction {
  user: typeof users.$inferSelect;
  items: Array<
    typeof transactionItems.$inferSelect & {
      product: typeof products.$inferSelect;
    }
  >;
}

interface TransactionsListProps {
  transactions: TransactionWithDetails[];
}

export default component$<TransactionsListProps>(({ transactions }) => {
  if (transactions.length === 0) {
    return (
      <div class="bg-white rounded-lg shadow-md p-8 text-center">
        <p class="text-gray-500">No transactions yet</p>
      </div>
    );
  }

  return (
    <div class="space-y-3">
      {transactions.map((transaction) => (
        <TransactionCard key={transaction.id} transaction={transaction} />
      ))}
    </div>
  );
});
