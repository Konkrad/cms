/**
 * Core → theme data contracts for the event photo gallery route
 * (`/events/:id/photos`, src/modules/events).
 */
import type { useGenerateSecureUrl } from "~/modules/events/actions";
import type { PhotosPageData } from "~/modules/events/public-checkout";

export type EventPhotosPageData = PhotosPageData;
export type EventPhotosEventData = PhotosPageData["event"];
export type EventPhotosData = PhotosPageData["photos"];
export type GenerateSecureUrlAction = ReturnType<typeof useGenerateSecureUrl>;
