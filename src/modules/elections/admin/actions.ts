import { routeAction$, z, zod$ } from "@qwik.dev/router";
import { requireModuleAdmin, requireWithinScope } from "~/core";
import { electionsService } from "../service";

const ELECTIONS = { module: "elections" } as const;

export const useCreateCycle = routeAction$(
	async (data, event) => {
		const { scope, adminBase } = await requireModuleAdmin(event, ELECTIONS);

		const cycle = await electionsService.createCycle({
			scopeId: scope.id,
			title: data.title,
			year: data.year,
			description: data.description || undefined,
			requiredMembershipTier: data.requiredMembershipTier || null,
		});

		throw event.redirect(303, `${adminBase}/elections/${cycle.id}`);
	},
	zod$({
		title: z.string().min(1, "Title is required"),
		year: z.coerce.number().int().min(2000).max(2100),
		description: z.string().optional(),
		requiredMembershipTier: z.enum(["associated", "full", ""]).optional(),
	}),
);

export const useCreatePosition = routeAction$(
	async (data, event) => {
		const { scope, adminBase } = await requireModuleAdmin(event, ELECTIONS);
		await requireWithinScope(
			event,
			scope,
			await electionsService.scopeOf({ cycleId: data.cycleId }),
		);
		// Positions can only be added while the cycle is a draft (the loader checks this
		// too, but an action runs before loaders and can be posted to directly).
		const cycle = await electionsService.getCycleById(data.cycleId);
		if (!cycle || cycle.status !== "draft") {
			return event.fail(400, {
				message: "Positions can only be added to draft cycles",
			});
		}
		await electionsService.createPosition({
			cycleId: data.cycleId,
			title: data.title,
			description: data.description || undefined,
			maxCandidates: data.maxCandidates || undefined,
		});
		throw event.redirect(302, `${adminBase}/elections/${data.cycleId}`);
	},
	zod$({
		cycleId: z.string().uuid(),
		title: z.string().min(1, "Title is required"),
		description: z.string().optional(),
		maxCandidates: z.preprocess(
			(v) => (v === "" || v === undefined ? undefined : v),
			z.coerce.number().int().positive().optional(),
		),
	}),
);

export const useAdvanceStatus = routeAction$(
	async (data, event) => {
		const { scope } = await requireModuleAdmin(event, ELECTIONS);
		await requireWithinScope(
			event,
			scope,
			await electionsService.scopeOf({ cycleId: data.cycleId }),
		);
		try {
			await electionsService.updateCycle(data.cycleId, {
				status: data.status,
			});
			return { success: true };
		} catch (e) {
			// Expected: the service refuses to move a cycle backwards.
			return { failed: true, error: (e as Error).message };
		}
	},
	zod$({
		cycleId: z.string().uuid(),
		status: z.enum(["draft", "open", "voting", "closed"]),
	}),
);

export const useSetVotingUrl = routeAction$(
	async (data, event) => {
		const { scope } = await requireModuleAdmin(event, ELECTIONS);
		await requireWithinScope(
			event,
			scope,
			await electionsService.scopeOf({ cycleId: data.cycleId }),
		);
		await electionsService.updateCycle(data.cycleId, {
			votingUrl: data.votingUrl || null,
		});
		return { success: true };
	},
	zod$({ cycleId: z.string().uuid(), votingUrl: z.string() }),
);

export const useDeletePosition = routeAction$(
	async (data, event) => {
		const { scope } = await requireModuleAdmin(event, ELECTIONS);
		await requireWithinScope(
			event,
			scope,
			await electionsService.scopeOf({ positionId: data.positionId }),
		);
		const result = await electionsService.deletePosition(data.positionId);
		if (result.error) return { failed: true, error: result.error };
		return { success: true };
	},
	zod$({ positionId: z.string().uuid() }),
);

export const useApproveApplication = routeAction$(
	async (data, event) => {
		const { scope } = await requireModuleAdmin(event, ELECTIONS);
		await requireWithinScope(
			event,
			scope,
			await electionsService.scopeOf({ applicationId: data.appId }),
		);
		await electionsService.updateApplicationStatus(
			data.appId,
			"approved",
			data.notes || undefined,
		);
		return { success: true };
	},
	zod$({ appId: z.string().uuid(), notes: z.string().optional() }),
);

export const useRejectApplication = routeAction$(
	async (data, event) => {
		const { scope } = await requireModuleAdmin(event, ELECTIONS);
		await requireWithinScope(
			event,
			scope,
			await electionsService.scopeOf({ applicationId: data.appId }),
		);
		await electionsService.updateApplicationStatus(
			data.appId,
			"rejected",
			data.notes || undefined,
		);
		return { success: true };
	},
	zod$({ appId: z.string().uuid(), notes: z.string().optional() }),
);
