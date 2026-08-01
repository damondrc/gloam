/**
 * Thin wrapper over the Tauri window API.
 *
 * Every call is guarded so the app still runs under a plain `npm run dev` in a
 * browser, where the Tauri bridge does not exist. That keeps the visual layer
 * iterable without a Rust toolchain or a full rebuild.
 */

type WindowModule = typeof import("@tauri-apps/api/window");

let cached: WindowModule | null = null;

export const inTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function api(): Promise<WindowModule | null> {
  if (!inTauri()) return null;
  cached ??= await import("@tauri-apps/api/window");
  return cached;
}

export async function closeWindow(): Promise<void> {
  const m = await api();
  await m?.getCurrentWindow().close();
}

export async function minimizeWindow(): Promise<void> {
  const m = await api();
  await m?.getCurrentWindow().minimize();
}

export async function setAlwaysOnTop(value: boolean): Promise<void> {
  const m = await api();
  await m?.getCurrentWindow().setAlwaysOnTop(value);
}

/**
 * Begins a window drag.
 *
 * Called by hand rather than through `data-tauri-drag-region`, because that
 * attribute also opts into the desktop convention that a double-click on a
 * title bar maximises the window — and the widget uses a double-click on the
 * same surface to toggle compact mode.
 */
export async function startDragging(): Promise<void> {
  const m = await api();
  await m?.getCurrentWindow().startDragging();
}

/** When true, clicks fall through to whatever sits behind the widget. */
export async function setClickThrough(value: boolean): Promise<void> {
  const m = await api();
  await m?.getCurrentWindow().setIgnoreCursorEvents(value);
}

export async function setWindowSize(
  width: number,
  height: number
): Promise<void> {
  const m = await api();
  if (!m) return;
  await m.getCurrentWindow().setSize(new m.LogicalSize(width, height));
}

export interface Geometry {
  /** Top-left of the *client area* in physical desktop pixels. */
  x: number;
  y: number;
  /** Ratio of physical pixels to CSS pixels. */
  scale: number;
}

/**
 * Reads the client area origin, deliberately not the window origin.
 *
 * getBoundingClientRect() is measured from the client area, so anything
 * converting a DOM rect to screen coordinates has to start from the same
 * place. outerPosition() includes whatever frame the window manager reserves:
 * on Windows with decorations disabled the two coincide and the distinction is
 * invisible, but GTK keeps a frame band above the content, which offsets every
 * derived coordinate upward by that amount.
 */
export async function readGeometry(): Promise<Geometry | null> {
  const m = await api();
  if (!m) return null;

  const win = m.getCurrentWindow();
  const [position, scale] = await Promise.all([
    win.innerPosition(),
    win.scaleFactor(),
  ]);
  return { x: position.x, y: position.y, scale };
}

/** Cursor position in physical desktop pixels, independent of window focus. */
export async function readCursor(): Promise<{ x: number; y: number } | null> {
  const m = await api();
  if (!m) return null;

  const position = await m.cursorPosition();
  return { x: position.x, y: position.y };
}

/** Subscribes to an event emitted from Rust. Returns an unlisten function. */
export async function onBackendEvent(
  name: string,
  handler: () => void
): Promise<() => void> {
  if (!inTauri()) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  return listen(name, handler);
}
