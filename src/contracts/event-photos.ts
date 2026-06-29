/**
 * Core → theme data contracts for the event photo gallery route
 * (`/events/[id]/photos`).
 */
import type {
  useEvent,
  usePhotos,
  useGenerateSecureUrl,
} from "~/routes/events/[id]/photos";

export type EventPhotosEventData = ReturnType<typeof useEvent>["value"];
export type EventPhotosData = ReturnType<typeof usePhotos>["value"];
export type GenerateSecureUrlAction = ReturnType<typeof useGenerateSecureUrl>;
