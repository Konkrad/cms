export type TagRuleConditionType =
  | "participation_total"
  | "participation_locationType"
  | "participation_group"
  | "participation_visibility";

export type TagRule = {
  slug: string;
  label: string;
  category: "participation";
  conditionType: TagRuleConditionType;
  conditionCount: number;
  conditionFilter?: string;
};

export const TAG_RULES: TagRule[] = [
  {
    slug: "active-member",
    label: "Active Member",
    conditionType: "participation_total",
    conditionCount: 5,
    category: "participation",
  },
  {
    slug: "local-veteran",
    label: "Local Event Veteran",
    conditionType: "participation_locationType",
    conditionCount: 10,
    conditionFilter: "in-person",
    category: "participation",
  },
];
