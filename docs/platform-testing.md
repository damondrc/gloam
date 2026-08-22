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
| **n/a** | Does not exist on this platform. A `.deb` has no meaning on Windows. |

**"—" is a real answer.** A row nobody ran is not a row that passed, and the
README says "supported" only where this file says OK. It is worth keeping
apart from **n/a**, which is not a gap in the testing but a question the
platform never asks.

Run it on a **release build** (`npm run app:build`, then install the artifact),
not on `npm run app`. Development builds differ in ways that matter here: the
flock and the shooting star are scheduled far more often, and the console
window behaves differently on Windows.

---

## Results

Version: **0.6.0-rc.5** — Date: **2026-08-22**

Windows: **Windows 11** — Linux: **Linux Mint 22, Cinnamon, X11**

Wayland was not tested: no session available. Every claim this project makes
about it is inference, and the README says so.

### A · Startup and position

| # | Check | Win 11 | Linux |
| --- | --- | --- | --- |
| A1 | Opens at the position it was last left, with no visible jump from the default corner | OK | OK |
| A2 | The position survives Quit and relaunch, not just hide and show | OK | OK |
| A3 | Moved to the second monitor, closed, reopened — comes back on the second monitor | OK | OK |
| A4 | With that monitor disconnected, it opens **visibly** in the default corner instead of vanishing | OK | OK |
| A5 | Dragged until almost entirely off-screen, then reopened — the position is discarded and it opens in the corner | OK | OK |
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
| D7 | Locking with the panel open closes the panel, leaving only the dimmed backdrop | OK | OK |

### E · The tray

| # | Check | Win 11 | Linux |
| --- | --- | --- | --- |
| E1 | A tray icon appears at startup | OK | OK |
| E2 | The close button hides the widget, and the run carries on | OK | OK |
| E3 | Left-clicking the icon toggles the widget away and back | OK | NO |
| E4 | The menu's first entry toggles, and says which way it will go | OK | OK |
| E5 | `Reset position` recovers a widget dragged off-screen | OK | OK |
| E6 | `Reset position` works while the widget is locked | OK | OK |
| E7 | `Quit` really ends the process — check Task Manager or `ps aux \| grep gloam` | OK | OK |

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
| H1 | The installer runs, and the app starts afterwards | OK | OK |
| H2 | The SmartScreen warning appears, and says what the README says it will | OK | n/a |
| H3 | The published checksum matches the file that was downloaded | OK | OK |
| H4 | Uninstalling removes it | OK | OK |
| H5 | The `.deb` installs, and the desktop entry launches it | n/a | OK |
| H6 | A shortcut on the desktop shows the app's own icon, not a placeholder | n/a | OK |
| H7 | The binary needs no glibc newer than 2.35 — see below | n/a | OK |

**H7, without a virtual machine.** The Linux packages are built in an Ubuntu
22.04 container so that they reach back to Ubuntu 22.04, Debian 12 and Mint 21.
Proving that normally means installing one of those. It can also be read
straight off the binary:

```bash
objdump -T "$(which gloam)" | grep -o 'GLIBC_[0-9.]*' | sort -Vu | tail -3
```

Every symbol the binary imports carries the glibc version that introduced it,
and the highest one is the oldest system it can start on. **2.35 or below
passes.** Anything higher means the build escaped its container and the claim
in the README is wrong.

Measured on 0.6.0: `GLIBC_2.32`, `GLIBC_2.33`, `GLIBC_2.34`. The binary asks
for nothing newer than **2.34**, which is a year older than the container it
was built in and comfortably inside the claim.

Which means glibc is not what decides the floor. The `.deb` also depends on
`libwebkit2gtk-4.1`, and that package first appears in Ubuntu 22.04 and Debian
12 — so those remain the oldest supported releases, for a different reason than
the one this check was written to test. Worth knowing before anyone tries to
widen the range by building somewhere older still.

### Notes

**D1 · Linux** — resizing with the grip is noticeably less smooth than on
Windows. Expected, and already explained in the README: the compositor resizes
the surface on a different beat from the WebView's repaint, and no amount of
CSS reaches underneath that. Not a defect to fix.

**E3 · Linux** — clicking the icon, with either button, only opens the menu.
Not fixable: the AppIndicator protocol that Linux trays speak has no notion of
a click on an icon. E4 exists because of it — the menu had to learn to do both
directions, since on Linux it is the only interaction a tray has.

**Dragging feels sticky on Linux** — not a row, and not Gloam. The window
resists screen edges and other windows' edges because Muffin does that to every
window. The screen-edge half is configurable; the window-to-window half has not
been since Cinnamon 5.4.

**Nothing is left unrun.** Every row that exists on a platform was checked on
it. The four `n/a` are questions Windows does not ask about a `.deb`, and the
Wayland column is absent rather than empty — there is no session to run it on,
which `docs/platforms.md` says in the only place a reader would look.

**What the first run found, and what became of it** — the widget not returning
where it was put away, the settings panel staying opaque over a locked widget,
a tray click that only ever showed, a desktop shortcut with no icon, and an
AppImage that first played nothing and then would not start. All fixed except
the last, which was withdrawn: two rounds on the least used package, at a
problem belonging to somebody else's packaging.

---

## When it is run

Before tagging any release that changed how the window behaves, and before
1.0.0 whatever changed. Sections A, B, C, E and G are the ones that go stale;
D and F rarely move once they work.

A release that only touches documentation, the backdrop or the sound does not
need this. Opening it, dragging it, locking it and closing it is enough.
