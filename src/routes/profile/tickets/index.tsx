import { component$ } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";
import { transactionsService } from "~/services/transactions.service";
import { ticketsService } from "~/services/tickets.service";
import TransactionsList from "~/components/profile/TransactionsList";
import UserTickets from "~/components/profile/UserTickets";

export const useUserDashboard = routeLoader$(async (event) => {
  const session = event.sharedMap.get("session");
  const userId = session?.userId;

  if (!userId) {
    throw event.redirect(302, "/login");
  }

  const [transactions, tickets] = await Promise.all([
    transactionsService.getByUserId(userId),
    ticketsService.getByBuyerId(userId),
  ]);

  return {
    transactions,
    tickets,
  };
});

export default component$(() => {
  const dashboard = useUserDashboard();

  return (
    <div class="max-w-6xl mx-auto px-4 py-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold mb-2">My Tickets & Purchases</h1>
        <p class="text-gray-600">
          View your purchase history and access your event tickets
        </p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <UserTickets tickets={dashboard.value.tickets} />
        </div>
        <div>
          <TransactionsList transactions={dashboard.value.transactions} />
        </div>
      </div>
    </div>
  );
});
