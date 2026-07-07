/**
 * Theme Loader Utilities
 *
 * This module provides utilities for lazy-loading theme components,
 * enabling theme replacement without rebuilding the core application.
 *
 * With the Rollup manualChunks configuration, all theme modules are bundled
 * into a separate chunk that can be replaced independently.
 */

import { useResource$ } from "@qwik.dev/core";

/**
 * QRL version for vite-plugin-qwik compatibility
 */
export const useThemeComponentQrl = undefined;

/**
 * QRL version for vite-plugin-qwik compatibility
 */
export const useThemeNamedExportsQrl = undefined;

/**
 * Hook to dynamically import theme named exports.
 * Returns a proxy object where each named export from the imported module becomes
 * a resource-like object that can be accessed with .value
 *
 * @example
 * ```tsx
 * const { Navigation } = useThemeNamedExports$(() => import("~theme/chrome/Navigation/Navigation"));
 * // Then in your JSX:
 * <Navigation.value user={user} />
 * ```
 */
export function useThemeNamedExports$<T extends Record<string, any>>(
  importFn: () => Promise<T>,
) {
  const moduleResource = useResource$(async () => {
    return await importFn();
  });

  // Create a proxy object that maps each property access to a ResourceReturn
  // Usage: const { Navigation } = useThemeNamedExports$(...);
  //        <Resource value={Navigation} onResolved={(Comp) => <Comp ... />} />
  // Or with helper: <ThemeNamedExport resource={Navigation} user={user} />
  return new Proxy({} as any, {
    get(_target, prop: string) {
      // Return a ResourceReturn for the specific property
      return useResource$(async () => {
        const module = await moduleResource.value;
        return (module as T)[prop as keyof T];
      });
    },
  }) as { [K in keyof T]: { value: Promise<T[K]>; loading: boolean } };
}

/**
 * Hook to dynamically import a theme component.
 * Returns a resource-like object where .value is the imported component.
 *
 * @example
 * ```tsx
 * const PostView = useThemeComponent$(() => import("~theme/routes/posts/PostView"));
 * // Then in your JSX:
 * <PostView.value post={post} />
 * ```
 */
export function useThemeComponent$<T = any>(
  importFn: () => Promise<{ default: T } | T>,
): ReturnType<typeof useResource$<T>> {
  // Return a ResourceReturn that resolves to the component
  // Usage: const PostView = useThemeComponent$(...);
  //        <Resource value={PostView} onResolved={(Comp) => <Comp ... />} />
  // Or with helper: <ThemeComponent resource={PostView} post={post} />
  return useResource$(async () => {
    const module = (await importFn()) as any;
    // If the module has a default export, use it. Otherwise return the module itself.
    // This allows handling both default and named exports.
    if (module && typeof module === "object" && "default" in module) {
      return module.default as T;
    }
    return module as T;
  });
}
