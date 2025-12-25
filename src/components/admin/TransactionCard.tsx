import { component$, useSignal, $ } from "@builder.io/qwik";
import type { Transaction } from "~/db/schemas/transactions";
import type { users, transactionItems, products } from "~/db/schema";

interface TransactionWithDetails extends Transaction {
  user: typeof users.$inferSelect;
  items: Array<
    typeof transactionItems.$inferSelect & {
      product: typeof products.$inferSelect;
    }
  >;
}

interface TransactionCardProps {
  transaction: TransactionWithDetails;
}

export default component$<TransactionCardProps>(({ transaction }) => {
  const isExpanded = useSignal(false);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const toggleExpanded = $(() => {
    isExpanded.value = !isExpanded.value;
  });

  return (
    <div class="border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
      <div
        class="p-4 cursor-pointer"
        onClick$={toggleExpanded}
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <h4 class="font-semibold text-gray-900">
                {transaction.user.name} {transaction.user.familyName}
              </h4>
              <span class="text-sm text-gray-500">
                {transaction.user.loginId}
              </span>
            </div>
            <p class="text-sm text-gray-600">
              {formatDate(transaction.paymentDate)}
            </p>
            <p class="text-xs text-gray-500 mt-1">
              {transaction.items.length} item(s)
            </p>
          </div>
          <div class="text-right">
            <p class="text-lg font-semibold text-gray-900">
              {formatCurrency(transaction.totalAmount)}
            </p>
            <p class="text-xs text-gray-500">
              Fee: {formatCurrency(transaction.transactionFee)}
            </p>
            <p class="text-xs text-gray-600 mt-1">
              Net: {formatCurrency(transaction.totalAmount - transaction.transactionFee)}
            </p>
          </div>
        </div>
      </div>

      {isExpanded.value && (
        <div class="border-t border-gray-200 bg-gray-50 p-4">
          <h5 class="font-medium text-gray-700 mb-3">Items Purchased</h5>
          <div class="space-y-2">
            {transaction.items.map((item) => (
              <div
                key={item.id}
                class="flex items-center justify-between text-sm"
              >
                <div>
                  <p class="font-medium text-gray-900">
                    {item.product.name}
                  </p>
                  <p class="text-gray-600">
                    Quantity: {item.quantity}
                  </p>
                </div>
                <div class="text-right">
                  <p class="text-gray-900">
                    {formatCurrency(item.unitPrice)} each
                  </p>
                  <p class="font-medium text-gray-700">
                    {formatCurrency(item.unitPrice * item.quantity)} total
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div class="mt-4 pt-4 border-t border-gray-200">
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-600">Stripe Session ID:</span>
              <span class="text-xs text-gray-500 font-mono">
                {transaction.stripeSessionId}
              </span>
            </div>
            {transaction.stripePaymentId && (
              <div class="flex items-center justify-between text-sm mt-1">
                <span class="text-gray-600">Payment ID:</span>
                <span class="text-xs text-gray-500 font-mono">
                  {transaction.stripePaymentId}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
