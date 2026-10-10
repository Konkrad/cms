import type { PageViews } from "~/core-api";
import { jobsViews } from "./jobs/views";

/** Page id → view for the catch-all route (client-safe: no server imports). */
export const moduleViews: PageViews = { ...jobsViews };
