import { routeAction$, z, zod$ } from "@qwik.dev/router";
import { requireModuleAdmin } from "~/core";
import { qualificationsService } from "../service";

export const useCreateType = routeAction$(
	async (data, event) => {
		// Root only ("global"): a type grants a membership tier, which is site-wide.
		const { scope } = await requireModuleAdmin(event, {
			module: "qualifications",
			scope: "global",
		});
		await qualificationsService.createType({ ...data, scopeId: scope.id });
		return { success: true };
	},
	zod$({
		slug: z.string().min(1),
		label: z.string().min(1),
		description: z.string().optional(),
		grantsMembershipTier: z.enum(["associated", "full"]),
	}),
);

export const useDeleteType = routeAction$(
	async (data, event) => {
		await requireModuleAdmin(event, {
			module: "qualifications",
			scope: "global",
		});
		await qualificationsService.deleteType(data.typeId);
		return { success: true };
	},
	zod$({ typeId: z.string().uuid() }),
);

export const useApproveQualification = routeAction$(
	async (data, event) => {
		const { user } = await requireModuleAdmin(event, {
			module: "qualifications",
			scope: "global",
		});
		await qualificationsService.approve(
			data.qualId,
			user.id,
			data.notes || undefined,
		);
		return { success: true };
	},
	zod$({ qualId: z.string().uuid(), notes: z.string().optional() }),
);

export const useRejectQualification = routeAction$(
	async (data, event) => {
		const { user } = await requireModuleAdmin(event, {
			module: "qualifications",
			scope: "global",
		});
		await qualificationsService.reject(data.qualId, user.id, data.notes);
		return { success: true };
	},
	zod$({
		qualId: z.string().uuid(),
		notes: z.string().min(1, "Please provide a reason"),
	}),
);

export const useGenerateToken = routeAction$(
	async (data, event) => {
		const { user } = await requireModuleAdmin(event, {
			module: "qualifications",
			scope: "global",
		});
		await qualificationsService.createToken(
			data.typeId,
			user.id,
			data.expiresInHours,
		);
		return { success: true };
	},
	zod$({
		typeId: z.string().uuid(),
		expiresInHours: z.coerce.number().int().min(1).max(72),
	}),
);

export const useRevokeToken = routeAction$(
	async (data, event) => {
		await requireModuleAdmin(event, {
			module: "qualifications",
			scope: "global",
		});
		await qualificationsService.revokeToken(data.tokenId);
		return { success: true };
	},
	zod$({ tokenId: z.string().uuid() }),
);
