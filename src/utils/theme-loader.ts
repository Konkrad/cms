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
export const useThemeNamedExports$ = <T extends Record<string, any>>(
  importFn: () => Promise<T>,
) => {
  const moduleResource = useResource$(async () => {
    return await importFn();
  });

  // Create a proxy object that maps each property access to a resource-like object
  // This allows the usage pattern: const { Navigation } = useThemeNamedExports$(...);
  // Navigation.value && <Navigation.value ... />
  return new Proxy({} as any, {
    get(_target, prop: string) {
      // Return a resource-like object for the specific property
      return {
        get value() {
          // This will be accessed in JSX. In Qwik, this creates a dependency
          // on the moduleResource, and when it resolves, this will return
          // the specific export
          return moduleResource.value.then(
            (module) => (module as T)[prop as keyof T],
          );
        },
        get loading() {
          return moduleResource.loading;
        },
      };
    },
  }) as { [K in keyof T]: { value: Promise<T[K]>; loading: boolean } };
};

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
export const useThemeComponent$ = <T = any>(importFn: () => Promise<T>) => {
  const resource = useResource$(async () => {
    const module = await importFn();
    return module;
  });

  // Return a resource-like object
  return {
    get value() {
      return resource.value.then((module) => {
        // If the module has a default export, use it. Otherwise return the module itself.
        // This allows handling both default and named exports.
        if ("default" in module) {
          return (module as any).default as T;
        }
        return module as T;
      });
    },
    get loading() {
      return resource.loading;
    },
  } as { value: Promise<T>; loading: boolean };
};
