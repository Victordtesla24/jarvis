// Ambient declarations for Vite asset imports. Kept in a non-module .d.ts (no top-level
// import/export) so these are treated as global ambient module declarations rather than
// module augmentations.

declare module '*.task' {
  const url: string;
  export default url;
}

declare module '*.task?url' {
  const url: string;
  export default url;
}
