/**
 * Core → theme data contract for the magic-link verification route
 * (`/auth/verify`).
 */
import type { useVerify } from "~/routes/auth/verify";

export type AuthVerifyViewData = ReturnType<typeof useVerify>["value"];
