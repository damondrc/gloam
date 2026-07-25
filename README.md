# Gloam

A floating, ambient focus timer that lives in the corner of your screen.

Gloam is not a window you switch to. It is a small always-on-top widget that
sits on a second monitor and runs configurable focus and break intervals while
you work. Its backdrop moves through dusk as the session elapses — the sun
descends toward the horizon during focus, the moon rises during a break — so a
glance tells you roughly how much time is left before you read a single digit.

Built with **Tauri 2**, **Svelte 5** and **TypeScript**. The release binary is
a few megabytes and idles at a fraction of the memory an Electron equivalent
would need, which matters for something meant to stay open all day.

---

## Why this exists

Existing Pomodoro apps fall into two camps. Some are full applications with
task lists, statistics and accounts — far more surface than a countdown needs.
Others are ambient "focus companion" experiences on Steam, which are lovely but
demand attention of their own: scenes to configure, characters to watch.

Gloam takes the middle path deliberately: the ambience is decorative and
peripheral, never interactive. There is nothing in it to fiddle with.

One small design decision that came out of using those other apps: **a break is
only ever placed between two focus sessions, never after the last one.** A
trailing break has nothing to resume into, so it is dead time.

## Features

- Frameless, transparent, always-on-top window you can drag anywhere
- Focus/break interval cycles with a plan that ends on a focus session
- An ambient sky whose state encodes progress
- Soft synthesised chimes at every transition — no audio assets, no jump scares
- Keyboard control: `Space` start/pause, `S` skip segment, `R` reset
- Controls stay hidden until you hover, so the widget reads as scenery

## Running it

Requires [Node.js](https://nodejs.org) 18+ and the
[Rust toolchain](https://rustup.rs). On Windows you also need the
**Desktop development with C++** workload from the Visual Studio Build Tools.

```bash
npm install
npm run app        # development build with hot reload
npm run app:build  # produce an installer in src-tauri/target/release/bundle
```

The frontend runs standalone in a browser too, which is convenient for
iterating on the visual layer without a Rust rebuild:

```bash
npm run dev        # then open http://localhost:1420
```

All Tauri calls are guarded, so the widget degrades gracefully outside the
desktop shell.

## Platform support

| | Status |
| --- | --- |
| Windows 10/11 | Fully supported |
| Linux (X11) | Fully supported |
| Linux (Wayland) | Runs, but always-on-top is ignored |

The Wayland limitation is [upstream](https://github.com/tauri-apps/tao/issues/1134):
the protocol gives clients no way to request that a surface stay above others.
The planned workaround is a `gtk-layer-shell` overlay surface — see the roadmap.

## Roadmap

- [x] **Phase 1** — Floating widget, fixed 30/10 cycles, ambient sky, chimes
- [ ] **Phase 2** — Settings panel: durations, session count, volume, opacity
- [ ] **Phase 3** — Persistence, system tray, launch on startup, global hotkeys
- [ ] **Phase 4** — Session history and a lightweight weekly summary
- [ ] **Phase 5** — Themes beyond dusk; `gtk-layer-shell` path for Wayland

## Project layout

```
src/
  App.svelte          composition and layout of every visual layer
  lib/
    timer.svelte.ts   the state machine and countdown
    sky.ts            the palette, keyframes and interpolation
    chime.ts          WebAudio alarm synthesis
    window.ts         guarded wrappers over the Tauri window API
    Stars.svelte      fixed star field
    Grain.svelte      generated film grain
    Controls.svelte   transport buttons
src-tauri/            Rust shell and window configuration
```

## License

MIT — see [LICENSE](LICENSE).
