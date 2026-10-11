import type { RequestEventLoader } from "@qwik.dev/router";
import QRCode from "qrcode";
import { requireModuleAdmin, toPublicUser } from "~/core";
import {
	qualificationsService,
	type UserQualificationWithApplicant,
} from "../service";

/** Server-only: import from route loaders only, never from components. */
export async function loadAdminQualifications(event: RequestEventLoader) {
	await requireModuleAdmin(event, { module: "qualifications" });
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

	// The admin tables show the applicant's name only; keep the rest of the users row server-side.
	const withPublicUser = (rows: UserQualificationWithApplicant[]) =>
		rows.map(({ user, ...row }) => ({ ...row, user: toPublicUser(user) }));

	return {
		types,
		pending: withPublicUser(pending),
		all: withPublicUser(all),
		tokensByType,
	};
}

export type AdminQualificationsData = Awaited<
	ReturnType<typeof loadAdminQualifications>
>;
