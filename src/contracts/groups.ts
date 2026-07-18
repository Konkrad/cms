/**
 * Core → theme data contract for the public group page (`/groups/[slug]`),
 * and for the core-owned `useGroupsList` block composable.
 */

import type { Group } from "~/db/schema";
import type { useGroupData, useJoinGroup } from "~/routes/groups/[slug]";

export type GroupViewData = ReturnType<typeof useGroupData>["value"];
export type JoinGroupAction = ReturnType<typeof useJoinGroup>;

/** Group list item as returned by `~/components/builder/blocks/useGroupsList`. */
export type GroupListItem = Group & { memberCount: number };
