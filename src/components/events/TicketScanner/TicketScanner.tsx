import {
  component$,
  useSignal,
  useVisibleTask$,
  $,
  type PropFunction,
} from "@builder.io/qwik";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { Alert } from "~/components/ui/Alert";

type ScanResult = {
  success: boolean;
  message: string;
  ticketId?: string;
  scannedAt?: string;
  participants?: Array<{
    participantOrder: number;
    name: string;
    email: string;
    phone?: string | null;
  }>;
};

type TicketScannerProps = {
  eventId: string;
  onScan: PropFunction<(qrData: string) => Promise<ScanResult>>;
};

export const TicketScanner = component$<TicketScannerProps>(
  ({ eventId, onScan }) => {
    const isScanning = useSignal(false);
    const scanResult = useSignal<ScanResult | null>(null);
    const scannerRef = useSignal<Html5Qrcode | null>(null);
    const cameraId = useSignal<string | null>(null);

    const startScanner = $(async () => {
      try {
        const html5QrCode = new Html5Qrcode("qr-reader");
        scannerRef.value = html5QrCode;

        const devices = await Html5Qrcode.getCameras();
        if (!devices || devices.length === 0) {
          scanResult.value = {
            success: false,
            message: "No cameras found on device",
          };
          return;
        }

        // Prefer back camera on mobile
        const backCamera = devices.find((device) =>
          device.label.toLowerCase().includes("back"),
        );
        cameraId.value = backCamera?.id || devices[0].id;

        await html5QrCode.start(
          cameraId.value,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          async (decodedText) => {
            // Pause scanning while processing
            isScanning.value = false;

            try {
              const result = await onScan(decodedText);
              scanResult.value = result;

              // Auto-resume scanning after 2 seconds if successful
              if (result.success) {
                setTimeout(() => {
                  scanResult.value = null;
                  isScanning.value = true;
                }, 2000);
              }
            } catch (error) {
              scanResult.value = {
                success: false,
                message:
                  error instanceof Error
                    ? error.message
                    : "Failed to process scan",
              };
            }
          },
          (errorMessage) => {
            // Ignore frequent scanning errors
            console.debug("QR scan error:", errorMessage);
          },
        );

        isScanning.value = true;
      } catch (error) {
        scanResult.value = {
          success: false,
          message:
            error instanceof Error ? error.message : "Failed to start camera",
        };
      }
    });

    const stopScanner = $(async () => {
      if (scannerRef.value) {
        try {
          await scannerRef.value.stop();
          scannerRef.value = null;
          isScanning.value = false;
        } catch (error) {
          console.error("Error stopping scanner:", error);
        }
      }
    });

    // Cleanup on unmount
    useVisibleTask$(({ cleanup }) => {
      cleanup(async () => {
        if (scannerRef.value) {
          try {
            await scannerRef.value.stop();
          } catch (error) {
            console.error("Cleanup error:", error);
          }
        }
      });
    });

    return (
      <div class="space-y-4">
        <Card>
          <div class="space-y-4">
            <h2 class="text-2xl font-bold text-gray-900">Scan Ticket</h2>

            <div class="space-y-2">
              {!isScanning.value ? (
                <Button onClick$={startScanner} class="w-full">
                  Start Camera
                </Button>
              ) : (
                <Button onClick$={stopScanner} variant="danger" class="w-full">
                  Stop Camera
                </Button>
              )}
            </div>

            <div
              id="qr-reader"
              class="w-full rounded-lg overflow-hidden bg-gray-100"
            />

            {scanResult.value && (
              <Alert variant={scanResult.value.success ? "success" : "error"}>
                <div class="flex items-start">
                  <div class="flex-shrink-0">
                    {scanResult.value.success ? (
                      <svg
                        class="h-6 w-6 text-green-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    ) : (
                      <svg
                        class="h-6 w-6 text-red-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    )}
                  </div>
                  <div class="ml-3 flex-1">
                    <p
                      class={`text-sm font-medium ${
                        scanResult.value.success
                          ? "text-green-800"
                          : "text-red-800"
                      }`}
                    >
                      {scanResult.value.message}
                    </p>
                    {scanResult.value.scannedAt && (
                      <p class="mt-1 text-xs text-green-700">
                        Scanned at:{" "}
                        {new Date(scanResult.value.scannedAt).toLocaleString()}
                      </p>
                    )}
                    {scanResult.value.participants &&
                      scanResult.value.participants.length > 0 && (
                        <div class="mt-2 space-y-1">
                          <p class="text-xs font-semibold text-green-800">
                            Participants:
                          </p>
                          {scanResult.value.participants.map((p) => (
                            <div
                              key={p.participantOrder}
                              class="text-xs text-green-700 ml-2"
                            >
                              {p.participantOrder}. {p.name} ({p.email})
                              {p.phone && ` - ${p.phone}`}
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                </div>
              </Alert>
            )}

            <div class="text-sm text-gray-600">
              <p class="font-medium">Instructions:</p>
              <ul class="mt-2 space-y-1 list-disc list-inside">
                <li>Point camera at QR code on ticket</li>
                <li>Hold steady until code is detected</li>
                <li>Valid tickets will show success message</li>
                <li>Camera will resume scanning after 2 seconds</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    );
  },
);
