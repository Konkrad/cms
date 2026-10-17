import { component$, Slot } from "@qwik.dev/core";
import { Link, useLocation } from "@qwik.dev/router";
import { t } from "~/core/i18n";

export default component$(() => {
	const loc = useLocation();
	const eventId = loc.params.id;
	const scopeSegment = loc.params.scope;

	const tabs = [
		{ path: "details", label: t("admin.events.tabs.details") },
		{ path: "review", label: t("admin.events.tabs.review") },
		{ path: "products", label: t("admin.events.tabs.products") },
		{ path: "participation", label: t("admin.events.tabs.participants") },
		{ path: "transactions", label: t("admin.events.tabs.transactions") },
		{ path: "tickets", label: t("admin.events.tabs.tickets") },
		{ path: "photos", label: t("admin.events.tabs.photos") },
		{ path: "updates", label: t("admin.events.tabs.updates") },
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
