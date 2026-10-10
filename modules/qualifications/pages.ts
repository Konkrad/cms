import { definePage, requireAuth } from "~/core-api";
import { qualificationsService } from "./service";

export const qualificationVerifyPage = definePage({
	id: "qualifications.verify",
	path: "/qualifications/verify/:token",
	async load(event, { params }) {
		const user = await requireAuth(event);
		const result = await qualificationsService.redeemToken(
			params.token,
			user.id,
		);
		return { ...result, userId: user.id };
	},
});

export const qualificationsPages = [qualificationVerifyPage];
