import { $, component$, useSignal, useVisibleTask$ } from "@qwik.dev/core";
import type { ActionStore } from "@qwik.dev/router";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Button, t } from "~/core/ui";

interface TicketScannerProps {
	action: ActionStore<any, any, true>;
}

export default component$<TicketScannerProps>(({ action }) => {
	const scannerRef = useSignal<HTMLDivElement>();
	const isScanning = useSignal(false);
	const scanResult = useSignal<{
		success: boolean;
		message?: string;
		error?: string;
		alreadyScanned?: boolean;
		scannedAt?: string;
		reason?: string;
		ticketId?: string;
	} | null>(null);
	const handleScan = $(async (decodedText: string) => {
		if (action.isRunning) return;

		try {
			const result = await action.submit({ qrCodeUuid: decodedText });
			scanResult.value = result.value;

			if (result.value?.success && navigator.vibrate) {
				navigator.vibrate(200);
			} else if (!result.value?.success && navigator.vibrate) {
				navigator.vibrate([100, 50, 100]);
			}

			if (result.value?.success) {
				setTimeout(() => {
					window.location.reload();
				}, 1000);
			} else {
				setTimeout(() => {
					scanResult.value = null;
				}, 3000);
			}
		} catch (error) {
			scanResult.value = {
				success: false,
				error: t("events.adminTicketScanner.failedToProcessScan"),
			};
		}
	});

	const toggleScanner = $(() => {
		if (isScanning.value) {
			isScanning.value = false;
		} else {
			isScanning.value = true;
		}
	});

	// biome-ignore lint/correctness/noQwikUseVisibleTask: browser-only (camera/DOM/storage) initialisation, must run on the client
	useVisibleTask$(({ track, cleanup }) => {
		track(() => isScanning.value);

		if (isScanning.value && scannerRef.value && typeof window !== "undefined") {
			const html5QrcodeScanner = new Html5QrcodeScanner(
				scannerRef.value.id,
				{
					fps: 10,
					qrbox: { width: 250, height: 250 },
					aspectRatio: 1.0,
				},
				false,
			);

			html5QrcodeScanner.render(
				(decodedText) => {
					handleScan(decodedText);
				},
				(error) => {
					// Ignore scanning errors
				},
			);

			cleanup(() => {
				html5QrcodeScanner.clear().catch(() => {});
			});
		}
	});

	return (
		<div class="bg-white rounded-lg shadow-md p-6">
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-xl font-semibold">
					{t("events.adminTicketScanner.qrCodeScanner")}
				</h3>
				<Button
					type="button"
					variant={isScanning.value ? "danger" : "primary"}
					onClick$={toggleScanner}
				>
					{isScanning.value
						? t("events.adminTicketScanner.stopScanning")
						: t("events.adminTicketScanner.startScanning")}
				</Button>
			</div>

			{isScanning.value && (
				<div class="relative">
					<div id="qr-reader" ref={scannerRef}></div>

					{scanResult.value && (
						<div
							class={`absolute top-0 left-0 right-0 p-4 rounded-lg text-center font-semibold ${
								scanResult.value.success
									? "bg-green-500 text-white"
									: scanResult.value.alreadyScanned
										? "bg-yellow-500 text-white"
										: "bg-red-500 text-white"
							}`}
						>
							{scanResult.value.success ? (
								scanResult.value.message
							) : (
								<div class="flex flex-col items-center">
									<div>{scanResult.value.error}</div>

									{scanResult.value.alreadyScanned &&
										scanResult.value.scannedAt && (
											<div class="text-xs mt-1">
												{t("events.adminTicketScanner.scannedAt", {
													scannedAt: scanResult.value.scannedAt,
												})}
											</div>
										)}

									{scanResult.value.reason && (
										<div class="text-xs mt-1">
											{t("events.adminTicketScanner.reason", {
												reason: scanResult.value.reason,
											})}
										</div>
									)}

									{scanResult.value.ticketId && (
										<div class="text-xs mt-1">
											{t("events.adminTicketScanner.ticketId", {
												ticketId: scanResult.value.ticketId,
											})}
										</div>
									)}
								</div>
							)}
						</div>
					)}
				</div>
			)}

			{!isScanning.value && (
				<p class="text-gray-600 text-center py-8">
					{t("events.adminTicketScanner.clickStartScanningToActivate")}
				</p>
			)}
		</div>
	);
});
