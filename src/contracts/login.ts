/**
 * Core → theme data contract for the login route (`/login`).
 */
import type { useSendAction, useVerifyAction } from "~/routes/login";

export type SendLoginAction = ReturnType<typeof useSendAction>;
export type VerifyLoginAction = ReturnType<typeof useVerifyAction>;
