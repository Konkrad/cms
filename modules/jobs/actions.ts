import { routeAction$, z, zod$ } from "@qwik.dev/router";
import {
	currentScopeRest,
	matchPath,
	requireActiveModule,
	requireAuth,
} from "~/core-api";
import { jobsService } from "./service";

const MAX_DAYS = 30;

export const useSubmitJob = routeAction$(
	async (data, event) => {
		const user = await requireAuth(event);
		requireActiveModule(event, "jobs");

		const expiresAt = new Date(data.expiresAt);
		const maxExpiry = new Date();
		maxExpiry.setDate(maxExpiry.getDate() + MAX_DAYS);

		if (expiresAt > maxExpiry) {
			return {
				failed: true,
				error: "Expiry date cannot be more than 30 days from today.",
			};
		}

		await jobsService.create({
			title: data.title,
			body: data.body,
			editorState: data.editorState || null,
			locationType: data.locationType as
				| "on-site"
				| "remote-eu"
				| "remote-country",
			city: data.city || null,
			country: data.country || null,
			link: data.link || null,
			posterRelation: data.posterRelation || null,
			expiresAt,
			status: "pending",
			suggestedBy: user.id,
		} as any);

		throw event.redirect(303, "/jobs/mine");
	},
	zod$({
		title: z.string().min(1, "Title is required"),
		body: z.string(),
		editorState: z.string().optional(),
		locationType: z.enum(["on-site", "remote-eu", "remote-country"]),
		city: z.string().optional(),
		country: z.string().optional(),
		link: z.string().optional(),
		posterRelation: z
			.enum(["hiring", "founder", "direct-team", "works-there", "other", ""])
			.optional(),
		expiresAt: z.string().min(1, "Expiry date is required"),
	}),
);

export const useDeleteMyJob = routeAction$(
	async (data, event) => {
		const user = await requireAuth(event);
		requireActiveModule(event, "jobs");

		const job = await jobsService.getById(data.jobId);
		if (!job || job.suggestedBy !== user.id || job.status !== "pending") {
			return { failed: true };
		}

		await jobsService.delete(data.jobId);
		return { success: true };
	},
	zod$({ jobId: z.string().uuid() }),
);

export const useUpdateMyJob = routeAction$(
	async (data, event) => {
		const user = await requireAuth(event);
		requireActiveModule(event, "jobs");

		const jobId = matchPath("/jobs/mine/:id/edit", currentScopeRest(event))?.id;
		const job = jobId ? await jobsService.getById(jobId) : undefined;
		if (!job || job.suggestedBy !== user.id || job.status !== "pending") {
			return { failed: true, error: "Not allowed." };
		}

		const expiresAt = new Date(data.expiresAt);
		const maxExpiry = new Date();
		maxExpiry.setDate(maxExpiry.getDate() + MAX_DAYS);

		if (expiresAt > maxExpiry) {
			return {
				failed: true,
				error: "Expiry date cannot be more than 30 days from today.",
			};
		}

		await jobsService.update(job.id, {
			title: data.title,
			body: data.body,
			editorState: data.editorState || null,
			locationType: data.locationType as
				| "on-site"
				| "remote-eu"
				| "remote-country",
			city: data.city || null,
			country: data.country || null,
			link: data.link || null,
			posterRelation: data.posterRelation || null,
			expiresAt,
		} as any);

		throw event.redirect(303, "/jobs/mine");
	},
	zod$({
		title: z.string().min(1, "Title is required"),
		body: z.string(),
		editorState: z.string().optional(),
		locationType: z.enum(["on-site", "remote-eu", "remote-country"]),
		city: z.string().optional(),
		country: z.string().optional(),
		link: z.string().optional(),
		posterRelation: z.preprocess(
			(v) => (v === "" ? undefined : v),
			z
				.enum(["hiring", "founder", "direct-team", "works-there", "other"])
				.optional(),
		),
		expiresAt: z.string().min(1, "Expiry date is required"),
	}),
);
