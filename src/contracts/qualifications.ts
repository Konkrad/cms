/**
 * Core → theme data contract for the qualification verification route
 * (`/qualifications/verify/[token]`).
 */
import type { useVerify } from "~/routes/qualifications/verify/[token]";

export type QualificationVerifyViewData = ReturnType<typeof useVerify>["value"];
