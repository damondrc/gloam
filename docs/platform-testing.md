# Platform checklist

What gets run by hand before a release, and the reason the support table in the
README is allowed to say anything at all.

Gloam's automated tests cover the places where being wrong would be invisible —
the plan, the timer engine, preference validation, the keyboard, the hit-test
arithmetic, whether a remembered position is still on a screen. What they
cannot cover is the window itself: always-on-top, click-through, resizing,
trays, and the different opinions Windows and GTK hold about all four. Those
need a desktop, and a person.

This list is that person's job. It is deliberately not automated: driving a
frameless always-on-top window through WebDriver would be slow, fragile, and
would prove less than fifteen minutes of using it.

## How to record a result

| Mark | Means |
| --- | --- |
| **OK** | Works as described. |
| **CAVEAT** | Works, with something worth writing down. Add a note below. |
| **NO** | Does not work on this platform. Add a note below. |
| **—** | Not tested. No machine, no session, no hardware. |

**"—" is a real answer.** A row nobody ran is not a row that passed, and the
README says "supported" only where this file says OK.

Run it on a **release build** (`npm run app:build`, then install the artifact),
not on `npm run app`. Development builds differ in ways that matter here: the
flock and the shooting star are scheduled far more often, and the console
window behaves differently on Windows.

---

## Results

Version: **0.6.0-rc.1**, with the packaging rows re-checked on **rc.2** — Date: **2026-08-21**

Windows: **Windows 11** — Linux: **Linux Mint 22, Cinnamon, X11**

Wayland was not tested: no session available. Every claim this project makes
about it is inference, and the README says so.

### A · Startup and position

| # | Check | Win 11 | Linux |
| --- | --- | --- | --- |
| A1 | Opens at the position it was last left, with no visible jump from the default corner | OK | CAVEAT |
| A2 | The position survives Quit and relaunch, not just hide and show | OK | CAVEAT |
| A3 | Moved to the second monitor, closed, reopened — comes back on the second monitor | OK | NO |
| A4 | With that monitor disconnected, it opens **visibly** in the default corner instead of vanishing | OK | — |
| A5 | Dragged until almost entirely off-screen, then reopened — the position is discarded and it opens in the corner | OK | — |
| A6 | Launching Gloam a second time surfaces the running copy rather than starting another | OK | OK |

### B · Always on top

| # | Check | Win 11 | Linux |
| --- | --- | --- | --- |
| B1 | Stays above a maximised ordinary window | OK | OK |
| B2 | Stays above a fullscreen video or presentation | OK | OK |
| B3 | Still on top after being hidden and shown again from the tray | OK | OK |

### C · Lock mode

| # | Check | Win 11 | Linux |
| --- | --- | --- | --- |
| C1 | The padlock dims the widget and a click on it lands on the window underneath | OK | OK |
| C2 | While locked, moving the cursor onto the padlock and **clicking** it unlocks the widget. Hovering alone does not unlock anything — it only lets the click reach the padlock instead of passing through | OK | OK |
| C3 | `Ctrl+Alt+G` locks and unlocks while another application has the focus | OK | OK |
| C4 | C2 still works at 80% scale | OK | OK |
| C5 | C2 still works at 180% scale | OK | OK |
| C6 | C2 still works with the widget on the second monitor | OK | OK |
| C7 | The hint naming `Ctrl+Alt+G` appears each time it locks | OK | OK |

### D · Scale, layout and the panel

| # | Check | Win 11 | Linux |
| --- | --- | --- | --- |
| D1 | The grip resizes from 80% to 180% without the edges shimmering | OK | CAVEAT |
| D2 | Text stays crisp at every scale — no blurring, no half pixels | OK | OK |
| D3 | Double-click folds to compact and back | OK | OK |
| D4 | The panel opens and closes, and the window grows and shrinks with it | OK | OK |
| D5 | No resize border or resize cursor appears around the widget | OK | OK |
| D6 | The bottom corners stay rounded with the panel open and closed | OK | OK |
| D7 | Locking with the panel open closes the panel, leaving only the dimmed backdrop | | |

### E · The tray

| # | Check | Win 11 | Linux |
| --- | --- | --- | --- |
| E1 | A tray icon appears at startup | OK | OK |
| E2 | The close button hides the widget, and the run carries on | OK | OK |
| E3 | Left-clicking the icon brings it back | CAVEAT | NO |
| E4 | `Reset position` recovers a widget dragged off-screen | OK | OK |
| E5 | `Reset position` works while the widget is locked | OK | OK |
| E6 | `Quit` really ends the process — check Task Manager or `ps aux \| grep gloam` | OK | OK |

### F · The timer under interruption

Use Focus 1, Break 1, Sessions 2 from the panel to keep these short.

| # | Check | Win 11 | Linux |
| --- | --- | --- | --- |
| F1 | A full run completes with exactly one sound per transition | OK | OK |
| F2 | Hidden to the tray across a segment boundary: correct state on return, **one** sound, not a burst | OK | OK |
| F3 | Minimised (not hidden) for longer than a segment: same | OK | OK |
| F4 | Machine suspended mid-run — lid closed or sleep — correct state on waking | OK | OK |
| F5 | Session locked mid-run: correct state on unlocking | OK | OK |

### G · Multiple monitors and DPI

Set one display to 100% and the other to 150% for these.

| # | Check | Win 11 | Linux |
| --- | --- | --- | --- |
| G1 | Dragged from one monitor to the other, the widget redraws at the right size | OK | OK |
| G2 | The padlock hotspot is still correct after that move | OK | OK |
| G3 | Changing a display's scaling with Gloam open leaves it usable | OK | OK |
| G4 | Unplugging a monitor with Gloam on it leaves it recoverable — by hand or via `Reset position` | OK | OK |

### H · Packaging

| # | Check | Win 11 | Linux |
| --- | --- | --- | --- |
| H1 | The installer runs on a machine that has never had Gloam on it | OK | — |
| H2 | The SmartScreen warning appears and the published checksum matches the download | OK | — |
| H3 | Uninstalling removes it | — | — |
| H4 | The `.deb` installs, and the desktop entry launches it | — | OK |
| H5 | The AppImage runs after `chmod +x` | — | OK |
| H6 | The AppImage makes a sound — the transitions are audible, not just drawn | — | NO |
| H7 | The binary needs no glibc newer than 2.35 — see below | — | — |

**H7, without a virtual machine.** The Linux packages are built in an Ubuntu
22.04 container so that they reach back to Ubuntu 22.04, Debian 12 and Mint 21.
Proving that normally means installing one of those. It can also be read
straight off the binary:

```bash
objdump -T /usr/bin/gloam | grep -o 'GLIBC_[0-9.]*' | sort -Vu | tail -3
```

Every symbol the binary imports carries the glibc version that introduced it,
and the highest one is the oldest system it can start on. **2.35 or below
passes.** Anything higher means the build escaped its container and the claim
in the README is wrong.

This is evidence rather than proof — it says nothing about the shared libraries
the packages depend on rather than bundle. Actually installing it on a 22.04
machine is still worth doing when one is to hand.

### Notes

**A1, A2, A3 · Linux** — the widget does not come back where it was put away.
Sent to the tray from anywhere on the screen, `Show Gloam` returns it to
roughly the top left, and on two attempts to a similar height on the right
instead. A position on the second monitor is not remembered either.

Cause: showing a hidden window on X11 is an unmap and a remap, and a window
manager places a remapped window wherever its own policy says. Windows keeps
the position across the same pair of calls, which is why this was invisible
there. **Fixed** — the position is written down on the way out and restored on
the way in.

A1 and A2 are marked CAVEAT rather than NO because the run exercised the tray
cycle rather than a full quit and relaunch, so whether a cold start restores
the position on Linux is not actually known yet. Confirm on the re-run.

**D1 · Linux** — resizing with the grip is noticeably less smooth than on
Windows. Expected, and already explained in the README: the compositor resizes
the surface on a different beat from the WebView's repaint, and no amount of
CSS reaches underneath that. Not a defect to fix.

**E3 · Windows** — a left click on the icon brought the widget back but never
put it away again, so the gesture only worked in one direction. **Fixed** — it
toggles.

**E3 · Linux** — clicking the icon, with either button, only opens the menu.
Not fixable: the AppIndicator protocol that Linux trays speak has no notion of
a click on an icon. The menu is the whole interface there, which is what makes
`Show Gloam` restoring the position matter more than it looks.

**H5 · Linux** — resolved. The file arrives without the execute bit, which no
download preserves and no file manager will supply, so `chmod +x` is required
and always was. Documented in the README. Not a defect.

**H6 · Linux** — the AppImage is silent. It draws every transition and plays
none of them:

```
GStreamer element appsrc not found. Please install it
GStreamer element autoaudiosink not found. Please install it
```

WebKitGTK plays all web audio through gstreamer, and an AppImage carries only
what the build machine gave it. Worse, with Tauri's media framework bundling
turned off the generated AppRun exports an *empty* gstreamer plugin path,
which switches off the search for the host's own plugins as well — so the
widget could not fall back on what the machine already had.

This is the one failure Gloam cannot survive quietly: the sound is how a
session tells you it ended, and a silent alarm looks exactly like a working
one. **Fixed** — media framework bundling is on and the build container
installs the plugins. Needs verifying on the next candidate; if the AppImage
fails to build with it, the AppImage comes out of the release rather than
shipping mute.

**Not a checklist row, found anyway** — locking the widget with the settings
panel open left the panel on screen at full strength. It is the one opaque
part of the widget, so while everything else receded to a watermark the
settings looked like the only thing on the screen. **Fixed** — locking closes
it, as entering compact mode already did. No row covered this; there is one
now, D7.

### What changed since this run

`A1` `A2` `A3` `E3 (Windows)` and the panel behaviour above have been fixed and
need re-checking before the release is tagged. Everything else stands.

---

## When it is run

Before tagging any release that changed how the window behaves, and before
1.0.0 whatever changed. Sections A, B, C, E and G are the ones that go stale;
D and F rarely move once they work.

A release that only touches documentation, the backdrop or the sound does not
need this. Opening it, dragging it, locking it and closing it is enough.
