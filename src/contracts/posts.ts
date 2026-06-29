/**
 * Core → theme data contracts for the posts routes.
 *
 * Types here are DERIVED FROM THE ROUTE LOADERS, so any field the loader strips
 * (secrets/PII) is automatically absent from the contract. Theme components
 * import these types (`~/contracts/posts`) instead of deep-importing route files
 * or reaching into services. `import type` only — these carry no runtime code.
 */
import type { usePost } from "~/routes/posts/[id]";

/** Non-null data passed to the themed single-post view. */
export type PostViewData = NonNullable<ReturnType<typeof usePost>["value"]>;
