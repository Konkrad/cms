import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
import type { ActionStore } from "@builder.io/qwik-city";
import { Html5QrcodeScanner } from "html5-qrcode";

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
        error: "Failed to process scan",
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
        <h3 class="text-xl font-semibold">QR Code Scanner</h3>
        <button
          type="button"
          onClick$={toggleScanner}
          class={`px-4 py-2 rounded-lg font-medium transition-colors ${
            isScanning.value
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
        >
          {isScanning.value ? "Stop Scanning" : "Start Scanning"}
        </button>
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
                        Scanned at: {scanResult.value.scannedAt}
                      </div>
                    )}

                  {scanResult.value.reason && (
                    <div class="text-xs mt-1">
                      Reason: {scanResult.value.reason}
                    </div>
                  )}

                  {scanResult.value.ticketId && (
                    <div class="text-xs mt-1">
                      Ticket ID: {scanResult.value.ticketId}
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
          Click "Start Scanning" to activate the camera and scan ticket QR codes
        </p>
      )}
    </div>
  );
});
