/**
 * Core → theme data contract for the public user profile route (`/users/[userId]`).
 */
import type { usePublicProfile } from "~/routes/users/[userId]";

export type PublicProfileViewData = ReturnType<typeof usePublicProfile>["value"];
