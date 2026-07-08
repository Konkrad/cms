/**
 * Theme Components
 *
 * Helper components for rendering theme resources loaded via useThemeNamedExports$ and useThemeComponent$.
 * These components wrap Qwik's Resource component to provide a cleaner API.
 */

import { component$, Resource } from "@qwik.dev/core";
import type { ResourceReturn } from "@qwik.dev/core";

/**
 * Helper component to render a theme component resource.
 * Usage: <ThemeComponent resource={PostView} post={post} />
 * where PostView was loaded via useThemeComponent$
 */
export const ThemeComponent = component$<{
  resource: ResourceReturn<any>;
  [key: string]: any;
}>(({ resource, ...props }) => {
  return (
    <Resource
      value={resource}
      onResolved={(Component: any) => <Component {...props} />}
    />
  );
});

/**
 * Helper component to render a named export from a theme module resource.
 * Usage: <ThemeNamedExport resource={Navigation} user={user} />
 * where Navigation was loaded via useThemeNamedExports$ as { Navigation }
 */
export const ThemeNamedExport = component$<{
  resource: ResourceReturn<any>;
  [key: string]: any;
}>(({ resource, ...props }) => {
  return (
    <Resource
      value={resource}
      onResolved={(Component: any) => <Component {...props} />}
    />
  );
});
