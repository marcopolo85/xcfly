// Vitest stub for the vite-plugin-pwa virtual module; the app only calls
// registerSW outside previews, so tests just need the import to resolve.
export function registerSW(): () => void {
  return () => {};
}
