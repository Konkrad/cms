import type { RequestEventLoader } from "@qwik.dev/router";
import { deriveThumbnailKey, generatePresignedGetUrl } from "~/core-api";
import { photosService } from "../services/photos";
import { requireAdminEvent } from "./auth";

/** Server-only: import from route loaders only, never from components. */
export async function loadAdminPhotos(event: RequestEventLoader) {
	const { event: target } = await requireAdminEvent(event);
	const photos = await photosService.getByEventId(target.id);

	const photosWithUrls = await Promise.all(
		photos.map(async (photo) => {
			const thumbnailUrl = await generatePresignedGetUrl(
				deriveThumbnailKey(photo.filePath),
				60 * 60,
			);
			const fullUrl = await generatePresignedGetUrl(photo.filePath, 60 * 60);

			return {
				...photo,
				thumbnailUrl,
				fullUrl,
			};
		}),
	);

	return {
		event: { id: target.id, title: target.title },
		photos: photosWithUrls,
	};
}

export type AdminPhotosData = Awaited<ReturnType<typeof loadAdminPhotos>>;
