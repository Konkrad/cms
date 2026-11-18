/**
 * Core → theme data contract for CMS pages rendered by the catch-all route (`/[...path]`).
 */
import type { loadCmsPage } from "~/core/content/cms-page";

export type PageViewData = Awaited<ReturnType<typeof loadCmsPage>>;
