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

Version: `______`   Date: `______`

Windows: `______`   Linux: `______` (distro, desktop, session type)

### A · Startup and position

| # | Check | Win 11 | Linux |
| --- | --- | --- | --- |
| A1 | Opens at the position it was last left, with no visible jump from the default corner | | |
| A2 | The position survives Quit and relaunch, not just hide and show | | |
| A3 | Moved to the second monitor, closed, reopened — comes back on the second monitor | | |
| A4 | With that monitor disconnected, it opens **visibly** in the default corner instead of vanishing | | |
| A5 | Dragged until almost entirely off-screen, then reopened — the position is discarded and it opens in the corner | | |
| A6 | Launching Gloam a second time surfaces the running copy rather than starting another | | |

### B · Always on top

| # | Check | Win 11 | Linux |
| --- | --- | --- | --- |
| B1 | Stays above a maximised ordinary window | | |
| B2 | Stays above a fullscreen video or presentation | | |
| B3 | Still on top after being hidden and shown again from the tray | | |

### C · Lock mode

| # | Check | Win 11 | Linux |
| --- | --- | --- | --- |
| C1 | The padlock dims the widget and a click on it lands on the window underneath | | |
| C2 | Moving the cursor onto the padlock makes it clickable again, and it unlocks | | |
| C3 | `Ctrl+Alt+G` locks and unlocks while another application has the focus | | |
| C4 | C2 still works at 80% scale | | |
| C5 | C2 still works at 180% scale | | |
| C6 | C2 still works with the widget on the second monitor | | |
| C7 | The hint naming `Ctrl+Alt+G` appears each time it locks | | |

### D · Scale, layout and the panel

| # | Check | Win 11 | Linux |
| --- | --- | --- | --- |
| D1 | The grip resizes from 80% to 180% without the edges shimmering | | |
| D2 | Text stays crisp at every scale — no blurring, no half pixels | | |
| D3 | Double-click folds to compact and back | | |
| D4 | The panel opens and closes, and the window grows and shrinks with it | | |
| D5 | No resize border or resize cursor appears around the widget | | |
| D6 | The bottom corners stay rounded with the panel open and closed | | |

### E · The tray

| # | Check | Win 11 | Linux |
| --- | --- | --- | --- |
| E1 | A tray icon appears at startup | | |
| E2 | The close button hides the widget, and the run carries on | | |
| E3 | Left-clicking the icon brings it back | | |
| E4 | `Reset position` recovers a widget dragged off-screen | | |
| E5 | `Reset position` works while the widget is locked | | |
| E6 | `Quit` really ends the process — check Task Manager or `ps aux \| grep gloam` | | |

### F · The timer under interruption

Use Focus 1, Break 1, Sessions 2 from the panel to keep these short.

| # | Check | Win 11 | Linux |
| --- | --- | --- | --- |
| F1 | A full run completes with exactly one sound per transition | | |
| F2 | Hidden to the tray across a segment boundary: correct state on return, **one** sound, not a burst | | |
| F3 | Minimised (not hidden) for longer than a segment: same | | |
| F4 | Machine suspended mid-run — lid closed or sleep — correct state on waking | | |
| F5 | Session locked mid-run: correct state on unlocking | | |

### G · Multiple monitors and DPI

Set one display to 100% and the other to 150% for these.

| # | Check | Win 11 | Linux |
| --- | --- | --- | --- |
| G1 | Dragged from one monitor to the other, the widget redraws at the right size | | |
| G2 | The padlock hotspot is still correct after that move | | |
| G3 | Changing a display's scaling with Gloam open leaves it usable | | |
| G4 | Unplugging a monitor with Gloam on it leaves it recoverable — by hand or via `Reset position` | | |

### H · Packaging

| # | Check | Win 11 | Linux |
| --- | --- | --- | --- |
| H1 | The installer runs on a machine that has never had Gloam on it | | — |
| H2 | The SmartScreen warning appears and the published checksum matches the download | | — |
| H3 | Uninstalling removes it | | — |
| H4 | The `.deb` installs, and the desktop entry launches it | — | |
| H5 | The AppImage runs after `chmod +x` | — | |
| H6 | The binary needs no glibc newer than 2.35 — see below | — | |

**H6, without a virtual machine.** The Linux packages are built in an Ubuntu
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

Anything marked CAVEAT or NO goes here, one line each: what you did, what
happened, what you expected.

-

---

## When it is run

Before tagging any release that changed how the window behaves, and before
1.0.0 whatever changed. Sections A, B, C, E and G are the ones that go stale;
D and F rarely move once they work.

A release that only touches documentation, the backdrop or the sound does not
need this. Opening it, dragging it, locking it and closing it is enough.
