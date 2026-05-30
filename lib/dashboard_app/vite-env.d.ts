/// <reference types="vite/client" />

// Vite `?url` asset imports (e.g. the vendored MediaPipe gesture model). Vite
// resolves these to a string URL at build time; this ambient declaration gives
// `tsc --noEmit` the matching type so the import type-checks cleanly.
declare module '*.task?url' {
  const url: string;
  export default url;
}
