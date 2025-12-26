import { component$, Slot } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";

export default component$(() => {
  const loc = useLocation();
  const eventId = loc.params.id;

  const tabs = [
    { path: "details", label: "Details" },
    { path: "products", label: "Products" },
    { path: "transactions", label: "Transactions" },
    { path: "tickets", label: "Tickets" },
  ];

  return (
    <div>
      <nav class="border-b border-gray-200 mb-6">
        <div class="flex space-x-8">
          {tabs.map((tab) => {
            const isActive = loc.url.pathname.includes(`/${tab.path}`);
            return (
              <Link
                key={tab.path}
                href={`/admin/events/${eventId}/${tab.path}/`}
                class={`
                  py-4 px-1 border-b-2 font-medium text-sm
                  ${
                    isActive
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }
                `}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <Slot />
    </div>
  );
});
