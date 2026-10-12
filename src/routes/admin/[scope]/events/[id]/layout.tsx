import { component$, Slot } from "@qwik.dev/core";
import { Link, useLocation } from "@qwik.dev/router";

export default component$(() => {
	const loc = useLocation();
	const eventId = loc.params.id;
	const scopeSegment = loc.params.scope;

	const tabs = [
		{ path: "details", label: "Details" },
		{ path: "review", label: "Review" },
		{ path: "products", label: "Products" },
		{ path: "participation", label: "Participants" },
		{ path: "transactions", label: "Transactions" },
		{ path: "tickets", label: "Tickets" },
		{ path: "photos", label: "Photos" },
		{ path: "updates", label: "Updates" },
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
								href={`/admin/${scopeSegment}/events/${eventId}/${tab.path}/`}
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
