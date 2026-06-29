/**
 * Core → theme data contract for the profile edit route (`/profile/edit`).
 */
import type { useProfile, useUpdateProfile } from "~/routes/profile/edit";

export type ProfileEditData = ReturnType<typeof useProfile>["value"];
export type UpdateProfileEditAction = ReturnType<typeof useUpdateProfile>;
