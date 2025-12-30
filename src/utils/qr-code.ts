import QRCode from "qrcode";
import crypto from "crypto";
import { env } from "~/env";

interface QRData {
  ticketId: string;
  eventId: string;
  signature: string;
}

/**
 * Generate QR code as data URL for a ticket
 */
export async function generateTicketQR(
  ticketId: string,
  eventId: string,
): Promise<string> {
  const signature = generateQRSignature(ticketId, eventId);
  const qrData: QRData = { ticketId, eventId, signature };
  const qrDataString = JSON.stringify(qrData);

  return await QRCode.toDataURL(qrDataString, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 300,
  });
}

/**
 * Generate HMAC signature for QR code validation
 */
export function generateQRSignature(
  ticketId: string,
  eventId: string,
): string {
  const secret = env.MAGIC_LINK_SECRET;
  return crypto
    .createHmac("sha256", secret)
    .update(`${ticketId}:${eventId}`)
    .digest("hex");
}

/**
 * Validate QR code signature
 */
export function validateQRSignature(qrData: QRData): boolean {
  try {
    const expectedSig = generateQRSignature(qrData.ticketId, qrData.eventId);
    return crypto.timingSafeEqual(
      Buffer.from(qrData.signature),
      Buffer.from(expectedSig),
    );
  } catch {
    return false;
  }
}

/**
 * Parse and validate QR code data from scanned string
 */
export function parseAndValidateQR(qrString: string): {
  valid: boolean;
  data?: QRData;
  error?: string;
} {
  try {
    const qrData: QRData = JSON.parse(qrString);

    if (!qrData.ticketId || !qrData.eventId || !qrData.signature) {
      return { valid: false, error: "Invalid QR code format" };
    }

    const isValid = validateQRSignature(qrData);
    if (!isValid) {
      return { valid: false, error: "Invalid QR code signature" };
    }

    return { valid: true, data: qrData };
  } catch (error) {
    return { valid: false, error: "Failed to parse QR code data" };
  }
}
