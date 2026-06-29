/**
 * Core → theme data contract for the public group page (`/groups/[slug]`).
 */
import type { useGroupData, useJoinGroup } from "~/routes/groups/[slug]";

export type GroupViewData = ReturnType<typeof useGroupData>["value"];
export type JoinGroupAction = ReturnType<typeof useJoinGroup>;
