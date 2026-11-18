import { $, component$ } from "@qwik.dev/core";
import { Link, routeAction$, useLocation, z, zod$ } from "@qwik.dev/router";
import { t } from "~/core/ui";
import { TicketScanner } from "../components/EventTicketScanner";
import { ticketsService } from "../services/tickets";
import { requireAdminEvent } from "./event-guards";
import type { AdminScanData } from "./scan-data";

export const useScanEventTicket = routeAction$(
	async (data, event) => {
		await requireAdminEvent(event);
		const result = await ticketsService.scanTicket(
			data.qrData,
			event.params.id,
		);

		if (!result.success) {
			return {
				success: false,
				message: result.error,
			};
		}

		return {
			success: true,
			message: t("events.admin.scan.ticketScannedSuccessfully"),
			ticketId: result.ticket.id,
			scannedAt: result.ticket.scannedAt,
			participants: result.participants,
		};
	},
	zod$({
		qrData: z.string().min(1),
	}),
);

type Props = { event: AdminScanData };

export const AdminEventScan = component$<Props>(({ event }) => {
	const scanAction = useScanEventTicket();
	const location = useLocation();
	const parts = location.url.pathname.split("/");
	const scopeSegment = parts[2] || "root";
	const attendanceUrl = `/admin/${scopeSegment}/events/${event.id}/attendance`;

	return (
		<div class="container mx-auto px-4 py-8 max-w-4xl">
			<div class="mb-6">
				<h1 class="text-3xl font-bold text-gray-900">{event.title}</h1>
				<p class="mt-2 text-gray-600">
					{t("events.admin.scan.scanTicketsForAttendanceVerification")}
				</p>
			</div>

			<TicketScanner
				eventId={event.id}
				onScan={$(async (qrData: string) => {
					const result = await scanAction.submit({ qrData });
					if (!result.value || result.value.failed) {
						return {
							success: false,
							message:
								result.value?.fieldErrors?.qrData ||
								t("events.admin.scan.failedToProcessScan"),
						};
					}
					return {
						success: result.value.success,
						message: result.value.message,
						ticketId: result.value.ticketId,
						scannedAt: result.value.scannedAt ?? undefined,
						participants: result.value.participants,
					};
				})}
			/>

			<div class="mt-8">
				<Link
					href={attendanceUrl}
					class="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
				>
					<svg
						aria-hidden="true"
						class="w-5 h-5 mr-2"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
						/>
					</svg>
					{t("events.admin.scan.viewAttendanceReport")}
				</Link>
			</div>
		</div>
	);
});
