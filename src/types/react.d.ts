/* eslint-disable */
/**
 * Minimal local type stubs for `react` and `react/jsx-runtime`.
 *
 * These are intentionally loose (using `any`) to silence TypeScript errors
 * in environments where `@types/react` isn't installed. For full typing,
 * prefer installing `@types/react` via:
 *
 *   npm i -D @types/react
 *
 * or the equivalent for your package manager.
 */

declare module "react" {
  // Commonly-used utility types
  export type PropsWithChildren<T> = T & { children?: any };
  export type ComponentType<P = any> = any;
  export type FunctionComponent<P = any> = (props: PropsWithChildren<P>) => any;
  export type CSSProperties = { [key: string]: any };

  // Minimal JSX namespace
  export namespace JSX {
    interface Element {}
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }

  // Runtime symbols used in the project
  export const Fragment: any;
  export function createElement(type: any, props?: any, ...children: any[]): any;

  // Default export (loose)
  const React: {
    Fragment: any;
    createElement: typeof createElement;
  } & any;
  export default React;
}

declare module "react/jsx-runtime" {
  export function jsx(type: any, props?: any, key?: any): any;
  export function jsxs(type: any, props?: any, key?: any): any;
  export function jsxDEV(type: any, props?: any, key?: any): any;
}
