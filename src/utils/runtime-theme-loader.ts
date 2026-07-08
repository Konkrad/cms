/**
 * Runtime Theme Loader
 *
 * This module provides utilities for loading theme components at runtime from a configurable URL.
 * Unlike the built-in theme loader which uses the ~theme/ alias and Qwik's optimizer,
 * this loader fetches pre-compiled ESM JavaScript modules at runtime.
 *
 * Usage:
 * 1. Compile your theme files to ESM JavaScript
 * 2. Place them in a public directory (e.g., public/runtime-theme/)
 * 3. Set THEME_BASE_URL environment variable (e.g., "/runtime-theme/")
 * 4. Use the runtime theme hooks instead of the regular theme hooks
 *
 * Example:
 *   // In your page component
 *   import { useRuntimeThemeComponent$ } from '~/utils/runtime-theme-loader';
 *   
 *   const PostView = useRuntimeThemeComponent$('routes/posts/PostView');
 *   <PostView.value post={post} />
 *
 * Docker example:
 *   docker run -p 3000:3000 \
 *     -e THEME_BASE_URL=/runtime-theme/ \
 *     -v /my-compiled-theme:/app/public/runtime-theme \
 *     ghcr.io/konkrad/cms:latest
 *
 * Note: Theme files loaded this way must be:
 *   - Pre-compiled to ESM JavaScript (.js files)
 *   - Client-side only (no server-side Node.js APIs)
 *   - Qwik components (using component$, etc.)
 */

import { useResource$ } from "@qwik.dev/core";

/**
 * Get the current runtime theme base URL from environment.
 * Falls back to empty string which means runtime theme loading is disabled.
 */
export function getRuntimeThemeBaseUrl(): string {
  // Check window first (client-side)
  if (typeof window !== 'undefined' && window.RUNTIME_THEME_BASE_URL) {
    return window.RUNTIME_THEME_BASE_URL;
  }
  // SSR: check environment variable
  if (typeof process !== 'undefined' && process.env.RUNTIME_THEME_BASE_URL) {
    return process.env.RUNTIME_THEME_BASE_URL;
  }
  // Also check THEME_BASE_URL for backwards compatibility
  if (typeof window !== 'undefined' && window.THEME_BASE_URL) {
    return window.THEME_BASE_URL;
  }
  if (typeof process !== 'undefined' && process.env.THEME_BASE_URL) {
    return process.env.THEME_BASE_URL;
  }
  return '';
}

/**
 * Set the runtime theme base URL.
 * Call this at application startup if you want to load themes from a custom location.
 */
export function setRuntimeThemeBaseUrl(url: string): void {
  if (typeof window !== 'undefined') {
    window.RUNTIME_THEME_BASE_URL = url;
  }
}

/**
 * Construct a full URL for a theme module.
 * Takes a path relative to the theme root (e.g., "routes/posts/PostView")
 * and returns a full URL (e.g., "/runtime-theme/routes/posts/PostView.js").
 */
function buildThemeModuleUrl(themePath: string): string {
  const baseUrl = getRuntimeThemeBaseUrl();
  if (!baseUrl) {
    throw new Error(
      'Runtime theme loading is not configured. Set RUNTIME_THEME_BASE_URL or THEME_BASE_URL.',
    );
  }
  
  // Ensure the path has a .js extension
  let cleanPath = themePath;
  if (!cleanPath.endsWith('.js') && !cleanPath.includes('.')) {
    cleanPath = cleanPath + '.js';
  }
  // Remove .tsx or .ts extension if present (replace with .js)
  cleanPath = cleanPath.replace(/\.(tsx|ts)$/, '.js');
  
  return new URL(cleanPath, baseUrl).toString();
}

/**
 * Hook to dynamically import a runtime theme component by path.
 * The path is relative to the theme root (e.g., "routes/posts/PostView").
 *
 * @example
 * ```tsx
 * const PostView = useRuntimeThemeComponent$('routes/posts/PostView');
 * // Then in your JSX:
 * <PostView.value post={post} />
 * ```
 */
export function useRuntimeThemeComponent$<T = any>(themePath: string): ReturnType<
  typeof useResource$<T>
> {
  const baseUrl = getRuntimeThemeBaseUrl();
  
  // If no runtime theme is configured, return an error resource
  if (!baseUrl) {
    return useResource$(async () => {
      throw new Error(
        'Runtime theme loading is not configured. Set RUNTIME_THEME_BASE_URL or THEME_BASE_URL.',
      );
    });
  }
  
  const moduleUrl = buildThemeModuleUrl(themePath);
  
  return useResource$(async () => {
    // Use dynamic import with the runtime URL
    // @ts-ignore - dynamic import with variable is supported for ESM in the browser
    const module = (await import(/* @vite-ignore */ moduleUrl)) as any;
    
    // If the module has a default export, use it. Otherwise return the module itself.
    if (module && typeof module === "object" && "default" in module) {
      return module.default as T;
    }
    return module as T;
  });
}

/**
 * Hook to dynamically import runtime theme named exports by path.
 * The path is relative to the theme root (e.g., "chrome/Navigation/Navigation").
 * Returns a proxy object where each named export can be accessed.
 *
 * @example
 * ```tsx
 * const { Navigation } = useRuntimeThemeNamedExports$('chrome/Navigation/Navigation');
 * // Then in your JSX:
 * <Navigation.value user={user} />
 * ```
 */
export function useRuntimeThemeNamedExports$<T extends Record<string, any>>(
  themePath: string,
): { [K in keyof T]: { value: Promise<T[K]>; loading: boolean } } {
  const baseUrl = getRuntimeThemeBaseUrl();
  
  // If no runtime theme is configured, return an error proxy
  if (!baseUrl) {
    return new Proxy({} as any, {
      get(_target, prop: string) {
        return useResource$(async () => {
          throw new Error(
            'Runtime theme loading is not configured. Set RUNTIME_THEME_BASE_URL or THEME_BASE_URL.',
          );
        });
      },
    }) as { [K in keyof T]: { value: Promise<T[K]>; loading: boolean } };
  }
  
  const moduleUrl = buildThemeModuleUrl(themePath);
  
  const moduleResource = useResource$(async () => {
    // Use dynamic import with the runtime URL
    // @ts-ignore - dynamic import with variable is supported for ESM in the browser
    return import(/* @vite-ignore */ moduleUrl) as Promise<T>;
  });

  // Create a proxy object that maps each property access to a ResourceReturn
  return new Proxy({} as any, {
    get(_target, prop: string) {
      return useResource$(async () => {
        const module = await moduleResource.value;
        return (module as T)[prop as keyof T];
      });
    },
  }) as { [K in keyof T]: { value: Promise<T[K]>; loading: boolean } };
}

// Global type augmentation for window
declare global {
  interface Window {
    RUNTIME_THEME_BASE_URL: string;
    THEME_BASE_URL: string;
  }
}
