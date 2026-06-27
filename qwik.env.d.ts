// This file can be used to add references for global types like `vite/client`.

// Add global `vite/client` types. For more info, see: https://vitejs.dev/guide/features#client-types
/// <reference types="vite/client" />

// `crypto.randomUUIDv7` landed in Node v26.1.0; @types/node hasn't published it yet.
declare module "crypto" {
  function randomUUIDv7(options?: { disableEntropyCache?: boolean }): string;
}
