/**
 * Thin wrapper over the Tauri window API.
 *
 * Every call is guarded so the app still runs under a plain `npm run dev` in a
 * browser, where the Tauri bridge does not exist. That keeps the visual layer
 * iterable without a Rust toolchain or a full rebuild.
 */

import type { Rect } from "./placement";

type WindowModule = typeof import("@tauri-apps/api/window");

let cached: WindowModule | null = null;

export const inTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function api(): Promise<WindowModule | null> {
  if (!inTauri()) return null;
  cached ??= await import("@tauri-apps/api/window");
  return cached;
}

async function core(): Promise<typeof import("@tauri-apps/api/core") | null> {
  if (!inTauri()) return null;
  return await import("@tauri-apps/api/core");
}

/**
 * What the close button does, decided in Rust.
 *
 * With a tray icon it hides and the run carries on; without one it quits,
 * because a widget that is hidden with nothing to bring it back is a widget
 * that has been lost. Only Rust knows which of those it managed to build, so
 * only Rust decides.
 */
export async function dismissWindow(): Promise<void> {
  const m = await core();
  await m?.invoke("dismiss");
}

/** Whether a tray icon exists — which is to say, what dismissing will mean. */
export async function hasTray(): Promise<boolean> {
  const m = await core();
  return (await m?.invoke<boolean>("tray_present")) ?? false;
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

/**
 * Resizes the window, which is otherwise declared fixed.
 *
 * The widget carries its own dimensions, so a window resized by anything but
 * this function goes out of step with what is drawn inside it: the widget ends
 * up clipped, ringed by dead transparent space, or dragged away to nothing
 * with no obvious way back.
 *
 * Declaring the window non-resizable is what stops a window manager offering
 * an invisible resize border and swapping the cursor for it — pinning the
 * minimum and maximum is not enough, since a manager may still advertise the
 * grip it will then refuse. But GTK also reads the same flag as "ignore
 * programmatic resizing", which is the bug this whole dance exists to avoid.
 *
 * So the flag is treated as momentary rather than permanent: opened for the
 * length of one resize and closed again. The min/max pins are set to the new
 * size as well, so that closing it cannot snap the window back to some size
 * GTK would rather it had.
 */
export async function setWindowSize(
  width: number,
  height: number
): Promise<void> {
  const m = await api();
  if (!m) return;

  const win = m.getCurrentWindow();
  const size = new m.LogicalSize(width, height);

  await win.setResizable(true);
  await win.setMinSize(null);
  await win.setMaxSize(null);
  await win.setSize(size);
  await win.setMinSize(size);
  await win.setMaxSize(size);
  await win.setResizable(false);
}

/**
 * The window's rectangle on the desktop, in physical pixels.
 *
 * Outer rather than inner, because this is compared against monitors: what
 * matters is the space the window occupies, not the part of it that draws.
 */
export async function readOuterRect(): Promise<Rect | null> {
  const m = await api();
  if (!m) return null;

  const win = m.getCurrentWindow();
  const [position, size] = await Promise.all([
    win.outerPosition(),
    win.outerSize(),
  ]);
  return { x: position.x, y: position.y, width: size.width, height: size.height };
}

/** Moves the window. Physical pixels, to match what everything else reports. */
export async function setWindowPosition(x: number, y: number): Promise<void> {
  const m = await api();
  if (!m) return;
  await m.getCurrentWindow().setPosition(new m.PhysicalPosition(x, y));
}

/** Every attached screen, as plain rectangles in physical pixels. */
export async function listMonitors(): Promise<Rect[]> {
  const m = await api();
  if (!m) return [];

  const monitors = await m.availableMonitors();
  return monitors.map((monitor) => ({
    x: monitor.position.x,
    y: monitor.position.y,
    width: monitor.size.width,
    height: monitor.size.height,
  }));
}

/**
 * The primary screen's usable area, and how many physical pixels it has to a
 * logical one.
 *
 * The work area rather than the screen: it is the monitor minus the taskbar,
 * the dock, and whatever else the desktop has reserved along an edge. Placing
 * a window by the screen's corner puts it behind those; placing it by the work
 * area's corner puts it beside them.
 *
 * The scale factor comes back with it because the two are always needed
 * together — the rectangle is in physical pixels and the widget's size is in
 * logical ones, so neither is usable without the other.
 */
export async function primaryWorkArea(): Promise<{
  rect: Rect;
  scaleFactor: number;
} | null> {
  const m = await api();
  if (!m) return null;

  const monitor = await m.primaryMonitor();
  if (!monitor) return null;

  const { position, size } = monitor.workArea;
  return {
    rect: { x: position.x, y: position.y, width: size.width, height: size.height },
    scaleFactor: monitor.scaleFactor,
  };
}

/**
 * Fires while the window is being dragged, and whenever anything else moves
 * it. Returns an unlisten function.
 */
export async function onWindowMoved(
  handler: (position: { x: number; y: number }) => void
): Promise<() => void> {
  const m = await api();
  if (!m) return () => {};
  return m.getCurrentWindow().onMoved(({ payload }) => handler(payload));
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
