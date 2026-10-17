import { $, component$, type Signal, useSignal } from "@qwik.dev/core";
import type { ActionStore } from "@qwik.dev/router";
import Fuse from "fuse.js";
import { Badge, formatDate, SectionCard, t } from "~/core/ui";
import type { products } from "../../schema";
import type { Ticket } from "../../schema/tickets";

interface TicketWithRelations extends Ticket {
	buyer: { id: string; name: string; familyName: string; email: string | null };
	product: typeof products.$inferSelect;
}

interface TicketsListProps {
	tickets: TicketWithRelations[];
	scanAction: ActionStore<any, any, true>;
	searchQuery: Signal<string>;
}

export default component$<TicketsListProps>(
	({ tickets, scanAction, searchQuery }) => {
		const scanningTicketId = useSignal<string | null>(null);

		// Filter tickets using Fuse.js during render
		let filteredTickets = tickets;
		if (searchQuery.value.trim()) {
			const fuse = new Fuse(tickets, {
				keys: ["buyer.name", "buyer.familyName", "buyer.email", "product.name"],
				threshold: 0.3,
			});
			const results = fuse.search(searchQuery.value);
			filteredTickets = results.map((result) => result.item);
		}

		const scannedTickets = filteredTickets.filter((item) => item.scannedAt);
		const unscannedTickets = filteredTickets.filter((item) => !item.scannedAt);

		const handleManualScan = $(async (ticket: TicketWithRelations) => {
			const dbTicket = ticket as any;
			const qrCodeUuid = dbTicket.qr_code_uuid || ticket.qrCodeUuid;
			if (qrCodeUuid) {
				scanningTicketId.value = ticket.id;
				try {
					const result = await scanAction.submit({ qrCodeUuid });
					if (result.value?.success) {
						console.log("Scan successful:", result.value.message);
						window.location.reload();
					} else {
						console.error("Scan failed:", result.value);
						const errorMessage =
							result.value?.error || t("events.ticketsList.unknownError");
						const details = result.value?.details || "";
						const reason = result.value?.reason || "";
						const ticketId = result.value?.ticketId || "";

						let fullMessage = t("events.ticketsList.scanFailed", {
							errorMessage,
						});
						if (details) {
							fullMessage += `\n\nDetails: ${details}`;
						}
						if (reason) {
							fullMessage += `\n\nReason: ${reason}`;
						}
						if (ticketId) {
							fullMessage += `\n\nTicket ID: ${ticketId}`;
						}

						alert(fullMessage);
					}
				} catch (error) {
					console.error("Scan error:", error);
					alert(t("events.ticketsList.anErrorOccurredDuringScanning"));
				} finally {
					scanningTicketId.value = null;
				}
			} else {
				console.error("QR code UUID not found on ticket:", ticket);
				alert(t("events.ticketsList.qrCodeUuidNotFound"));
			}
		});

		const formatDateTime = (dateString: string | null) => {
			if (!dateString) return "-";
			const date = new Date(dateString);
			return formatDate(date, "shortDateTime");
		};

		return (
			<SectionCard title={t("events.ticketsList.allTickets")}>
				<div q:slot="header-right" class="text-sm text-gray-600">
					<span class="font-medium text-green-600">
						{tickets.filter((item) => item.scannedAt).length}
					</span>{" "}
					{t("events.ticketsList.scanned")}
					<span class="font-medium"> {tickets.length}</span>{" "}
					{t("events.ticketsList.total")}
					{searchQuery.value.trim() && (
						<span class="ml-2 text-gray-500">
							{t("events.ticketsList.filtered", {
								count: filteredTickets.length,
							})}
						</span>
					)}
				</div>

				<div class="space-y-6">
					{unscannedTickets.length > 0 && (
						<div>
							<h4 class="text-lg font-medium mb-3 text-gray-700">
								{t("events.ticketsList.pending", {
									count: unscannedTickets.length,
								})}
							</h4>
							<div class="space-y-2">
								{unscannedTickets.map((ticket) => (
									<div
										key={ticket.id}
										class="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
									>
										<div class="flex-1">
											<p class="font-medium text-gray-900">
												{ticket.buyer.name} {ticket.buyer.familyName}
											</p>
											<p class="text-sm text-gray-600">{ticket.product.name}</p>
											<p class="text-xs text-gray-500 mt-1">
												{t("events.ticketsList.purchased", {
													createdAt: formatDateTime(ticket.createdAt),
												})}
											</p>
										</div>
										<div class="flex items-center gap-3">
											<Badge variant="warning">
												{t("events.ticketsList.notScanned")}
											</Badge>
											<button
												type="button"
												onClick$={() => handleManualScan(ticket)}
												disabled={
													scanningTicketId.value === ticket.id ||
													scanAction.isRunning
												}
												class="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
											>
												{scanningTicketId.value === ticket.id
													? t("events.ticketsList.scanning")
													: t("events.ticketsList.manualScan")}
											</button>
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{scannedTickets.length > 0 && (
						<div>
							<h4 class="text-lg font-medium mb-3 text-gray-700">
								{t("events.ticketsList.scanned2", {
									count: scannedTickets.length,
								})}
							</h4>
							<div class="space-y-2">
								{scannedTickets.map((ticket) => (
									<div
										key={ticket.id}
										class="flex items-center justify-between p-4 border border-green-200 bg-green-50 rounded-lg"
									>
										<div class="flex-1">
											<p class="font-medium text-gray-900">
												{ticket.buyer.name} {ticket.buyer.familyName}
											</p>
											<p class="text-sm text-gray-600">{ticket.product.name}</p>
											<p class="text-xs text-gray-500 mt-1">
												{t("events.ticketsList.scanned3", {
													scannedAt: formatDateTime(ticket.scannedAt),
												})}
											</p>
										</div>
										<Badge variant="success">
											{t("events.ticketsList.scanned4")}
										</Badge>
									</div>
								))}
							</div>
						</div>
					)}

					{filteredTickets.length === 0 && searchQuery.value.trim() && (
						<p class="text-gray-500 text-center py-8">
							{t("events.ticketsList.noTicketsFoundMatching", {
								value: searchQuery.value,
							})}
						</p>
					)}

					{tickets.length === 0 && (
						<p class="text-gray-500 text-center py-8">
							{t("events.ticketsList.noTicketsHaveBeenPurchased")}
						</p>
					)}
				</div>
			</SectionCard>
		);
	},
);
