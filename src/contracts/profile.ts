/**
 * Core → theme data contract for the profile page (`/profile`) and its
 * in-place editing actions.
 */
import type {
  useUpdateName,
  useUpdateLocation,
  useUpdatePicture,
  useUpdateDetails,
} from "~/routes/profile";

export type UpdateNameAction = ReturnType<typeof useUpdateName>;
export type UpdateLocationAction = ReturnType<typeof useUpdateLocation>;
export type UpdatePictureAction = ReturnType<typeof useUpdatePicture>;
export type UpdateDetailsAction = ReturnType<typeof useUpdateDetails>;
