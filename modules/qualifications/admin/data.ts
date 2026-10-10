import type { RequestEventLoader } from "@qwik.dev/router";
import QRCode from "qrcode";
import { qualificationsService } from "../service";
import { requireQualificationsAdmin } from "./auth";

/** Server-only: import from route loaders only, never from components. */
export async function loadAdminQualifications(event: RequestEventLoader) {
	await requireQualificationsAdmin(event);
	const [types, pending, all] = await Promise.all([
		qualificationsService.getTypes(),
		qualificationsService.getPendingApplications(),
		qualificationsService.getAllApplications(),
	]);

	// Load active tokens for each type and generate QR data URIs
	const baseUrl = event.url.origin;
	const tokensWithQr = await Promise.all(
		types.map(async (t) => {
			const tokens = await qualificationsService.getActiveTokensForType(t.id);
			const now = new Date().toISOString();
			const activeTokens = tokens.filter((tok) => tok.expiresAt > now);
			const withQr = await Promise.all(
				activeTokens.map(async (tok) => ({
					...tok,
					qrDataUrl: await QRCode.toDataURL(
						`${baseUrl}/qualifications/verify/${tok.token}`,
						{ width: 280, margin: 2, errorCorrectionLevel: "H" },
					),
					verifyUrl: `${baseUrl}/qualifications/verify/${tok.token}`,
				})),
			);
			return { typeId: t.id, tokens: withQr };
		}),
	);

	const tokensByType = Object.fromEntries(
		tokensWithQr.map((t) => [t.typeId, t.tokens]),
	);

	return { types, pending, all, tokensByType };
}

export type AdminQualificationsData = Awaited<
	ReturnType<typeof loadAdminQualifications>
>;
