/**
 * Thin wrapper over the Tauri window API.
 *
 * Every call is guarded so the app still runs under a plain `npm run dev` in a
 * browser, where the Tauri bridge does not exist. That keeps the visual layer
 * iterable without a Rust toolchain or a full rebuild.
 */

export const inTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function closeWindow(): Promise<void> {
  if (!inTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().close();
}

export async function minimizeWindow(): Promise<void> {
  if (!inTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().minimize();
}

export async function setAlwaysOnTop(value: boolean): Promise<void> {
  if (!inTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().setAlwaysOnTop(value);
}
