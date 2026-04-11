import { component$ } from "@builder.io/qwik";
import type { Transaction } from "~/db/schemas/transactions";
import type { events, transactionItems, products } from "~/db/schema";
import { SectionCard } from "~/components/ui/SectionCard";

interface TransactionWithRelations extends Transaction {
  event: typeof events.$inferSelect;
  items: Array<
    typeof transactionItems.$inferSelect & {
      product: typeof products.$inferSelect;
    }
  >;
}

interface TransactionsListProps {
  transactions: TransactionWithRelations[];
}

export default component$<TransactionsListProps>(({ transactions }) => {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Amounts are stored in EUR (floats). Don't divide by 100 here.
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <SectionCard title="Purchase History">
      {transactions.length === 0 ? (
        <p class="text-gray-500 text-center py-8">
          You haven't made any purchases yet
        </p>
      ) : (
        <div class="space-y-4">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              class="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
            >
              <div class="flex items-start justify-between mb-3">
                <div>
                  <h4 class="font-semibold text-gray-900">
                    {transaction.event.title}
                  </h4>
                  <p class="text-sm text-gray-600">
                    {formatDate(transaction.paymentDate)}
                  </p>
                </div>
                <div class="text-right">
                  <p class="font-semibold text-gray-900">
                    {formatCurrency(transaction.totalAmount)}
                  </p>
                  <p class="text-xs text-gray-500">
                    Fee: {formatCurrency(transaction.transactionFee)}
                  </p>
                </div>
              </div>

              <div class="space-y-1">
                {transaction.items.map((item) => (
                  <div
                    key={item.id}
                    class="flex items-center justify-between text-sm"
                  >
                    <span class="text-gray-700">
                      {item.quantity}x {item.product.name}
                    </span>
                    <span class="text-gray-600">
                      {formatCurrency(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
});
