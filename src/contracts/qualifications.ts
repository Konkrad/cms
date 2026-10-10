/**
 * Core → theme data contract for the qualification verification page
 * (`/qualifications/verify/:token`, modules/qualifications).
 */
import type { qualificationVerifyPage } from "~modules/qualifications/pages";

export type QualificationVerifyViewData = Awaited<
	ReturnType<typeof qualificationVerifyPage.load>
>;
