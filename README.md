# Gloam

A floating, ambient focus timer that lives in the corner of your screen.

<p align="center">
  <img src="docs/media/hero.png" width="640"
       alt="The Gloam widget resting on a desktop: a dusk sky with the sun still high, the readout showing 35:00, and three session dots below the horizon">
</p>

<p align="center">
  <a href="https://github.com/damondrc/gloam/actions/workflows/ci.yml">
    <img src="https://github.com/damondrc/gloam/actions/workflows/ci.yml/badge.svg"
         alt="CI status">
  </a>
</p>

Gloam is not a window you switch to. It is a small always-on-top widget that
sits on a second monitor and runs configurable focus and break intervals while
you work. Its backdrop moves through dusk as the session elapses — the sun
descends toward the horizon during focus, the moon rises during a break — so a
glance tells you roughly how much time is left before you read a single digit.

Built with **Tauri 2**, **Svelte 5** and **TypeScript**. The release binary is
a few megabytes and idles at a fraction of the memory an Electron equivalent
would need, which matters for something meant to stay open all day.

## Download

Installers are on the
[latest release](https://github.com/damondrc/gloam/releases/latest): an `.exe`
for Windows, a `.deb` and an AppImage for Linux.

Every release publishes a `SHA256SUMS.txt` beside them. Gloam is not
code-signed — a certificate costs more per year than this project costs to run —
so Windows will raise a SmartScreen warning the first time you run the
installer. The checksum is the honest answer to that, and it is worth checking
before clicking through:

```powershell
Get-FileHash .\Gloam_x.y.z_x64-setup.exe -Algorithm SHA256
```

```bash
sha256sum -c SHA256SUMS.txt --ignore-missing
```

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
- Clouds that drift across it, a flock that crosses once in a long while, and
  a shooting star on a rare night
- Lock mode: dims the widget and lets clicks pass through to the window beneath
- Compact mode: double-click to shrink to the readout, play control and padlock
- Resizable from 80% to 180% by dragging the corner grip
- A settings panel that unfolds below the horizon, in three tabs: the cycle,
  sound, and how alive the backdrop is
- Soft synthesised sound throughout — no audio assets, no jump scares
- Controls stay hidden until you hover, so the widget reads as scenery

<p align="center">
  <img src="docs/media/controls.gif" width="640"
       alt="Hovering over the widget fades the transport controls in; play, skip to the break, reset, then the padlock dims the whole thing to a watermark">
</p>

<p align="center"><em>The controls only exist while the pointer is over the
widget. Skipping to a break swaps the sun for the moon; the padlock drops it to
44% and hands the clicks to whatever is underneath.</em></p>

### Keyboard

| Key | Action |
| --- | --- |
| `Space` | Start / pause |
| `S` | Skip to next segment |
| `R` | Reset the run |
| `L` | Toggle lock |
| `C` | Toggle compact mode |
| `,` | Open or close the settings panel |
| `+` / `-` | Scale the widget up or down |
| `0` | Reset the scale |
| `Ctrl+Alt+G` | Toggle lock, from anywhere |

## Lock mode

An always-on-top widget is easy to live with on a second monitor and awkward on
a single one, where it covers the document you are reading and intercepts
clicks meant for it. Clicking the padlock turns the whole window click-through,
so the mouse passes straight to whatever is underneath, and drops the widget to
44% opacity so it reads as a watermark.

The interesting part is getting back out. Click-through is a whole-window
property — no platform exposes "pass everything through except this button" —
so Gloam does the hit-testing itself. While locked it polls the global cursor
position every 70 ms and compares it against the padlock's rectangle in screen
coordinates. When the cursor enters, click-through is switched off so the click
can land; when it leaves, it goes back on. The padlock behaves like a hole in
an otherwise pass-through surface.

Two known consequences:

- While the cursor is inside the padlock's rectangle the entire window is
  briefly clickable again, so a click a few pixels outside the padlock is
  swallowed rather than passed through. The hotspot is kept small to limit it.
- Polling costs one IPC round trip every 70 ms, and only while locked.

`Ctrl+Alt+G` is registered in Rust as a safety net: if hit-testing ever fails
on an unusual window manager, the widget is still recoverable. If another
application already owns that shortcut, registration fails quietly and the
padlock keeps working.

Locking hides the close button, so the widget cannot be quit until it is
unlocked. That makes the escape hatch load-bearing, and Gloam states it rather
than leaving it to be discovered: a hint naming the shortcut appears for a few
seconds every time you lock.

For the same reason only one copy may run at a time. Two would be worse than it
sounds — the window opens at a fixed position, so a duplicate lands exactly on
top of the original and reads as one widget misbehaving, and since only one
process can hold a global shortcut, the second copy silently loses its way out.
Launching again surfaces the running instance instead of starting another.

Lock is not remembered between runs, unlike scale and compact mode. It is a
mode rather than a preference, and it is the one mode in which the widget
accepts almost no input — booting into it means any failure in the
click-through path hands the user a window they cannot interact with. A wrong
saved scale is merely ugly; a wrong saved lock is a trap. Gloam always starts
interactive.

Because click-through is write-only — nothing reports back whether the call
took effect — the controller restates its intent every ten polls rather than
only on transitions, so a dropped call heals itself within a second.

## Scale

Dragging the grip in the bottom-right corner resizes the widget between 80% and
180%. Everything scales together — type, buttons, the sun, the spacing — because
sizes throughout the stylesheet are written in `rem`, and the root font size is
one design pixel multiplied by the current scale. Changing one custom property
therefore relays out the entire widget, and because it is a real relayout rather
than a transform, text stays crisp at every size.

Scale is kept independent of the other two size-ish concepts on purpose:

| Axis | Question it answers | Control |
| --- | --- | --- |
| Scale | How big is everything drawn? | Corner grip, `+` / `-` |
| Layout | Which elements exist? | Double-click for compact |
| Panels | How much content is there? | The chevron, `,` |

Folding these into a single "size" control is tempting and wrong: dragging to
enlarge the clock would also unfold the settings, and collapsing them would
shrink your type.

The window is declared non-resizable, and `setWindowSize` opens that flag for
the length of one resize before closing it again. The dance is not decoration:
the two platforms read the same flag differently.

Windows takes it to mean "the user may not drag the edges" and still honours
programmatic resizing. GTK takes it to mean "this window has one size" and
ignores every later resize request, including the app's own — with it simply
set to false, the Linux build kept its startup size forever. Set to true
instead, the window manager advertises an invisible resize border and swaps the
cursor for it all around the widget, and a hand-resized window desyncs from the
widget drawn inside it, since the frame carries its own dimensions.

Pinning the minimum and maximum is not enough on its own: a window manager may
still offer the grip it will then refuse. So the flag stays shut except for the
instant a resize needs it.

## Settings

The chevron on the bottom edge unfolds a panel below the horizon. That
placement is deliberate: the sky is the timer, the ground is where the
machinery lives. Controls laid over the gradient would be hard to read and
would break the one idea the backdrop carries.

<p align="center">
  <img src="docs/media/settings.gif" width="640"
       alt="The chevron unfolds a panel below the horizon; stepping the focus and break durations on the general tab, then moving through the sound and backdrop tabs">
</p>

It is split into three tabs — the cycle, sound, and the backdrop. Stacked in
one column the sections had grown past 280 design pixels, which at 180% scale
is most of a laptop screen. Tabs cut that to 152 and group by question rather
than by type: how long, how it sounds, how alive the sky is. The tab is
navigation rather than preference, so it is not remembered.

Durations are steppers rather than number fields. At this size a form input
looks borrowed from another application, and more usefully a stepper cannot
produce an invalid value — there is no empty state and nothing to mistype. They
freeze while the timer runs, so a stray click cannot discard a session; when
the run is paused part-way the panel says that applying a change will restart
it, rather than letting the cost be discovered.

### Sound

Everything is synthesised. No audio files means nothing to license, nothing to
decode, no binaries in the repository, and a timbre that stays editable as code.

The module splits along one line: an *instrument* decides how a single note
sounds, a *phrase* decides which notes and in what order. That split is why
timbre and pattern are separate settings, and why adding either is a function
rather than a redesign.

Whatever the pattern, the two transitions are always the same material in
opposite directions: rising into focus, falling into a break. Identical notes
make them audibly a pair, opposite direction makes them impossible to confuse,
and direction was chosen over register because it survives being half-heard —
which is the condition these play under. The end of a run is a fuller chord,
marking an ending rather than a change.

Button sets were first designed around what different speakers can reproduce,
which turned out to be the wrong question — a recommendation mistaken for a
rule. The right one is what this widget sounds like. Its alarms are a struck
bowl, so its buttons are struck, plucked or dropped things too: soft attacks,
some warmth, no digital edges. Every set keeps the same grammar, so the meaning
survives changing the material — start rises, pause falls, reset is neutral,
locking falls shut and unlocking springs open.

There is no way to silence the buttons alone, deliberately. Feedback you cannot
hear is a button you are not sure you pressed, and muting is what the volume
control is for.

Every gesture fades out whatever is still ringing before it starts. Auditioning
a setting is the reason: you are there to hear the thing you picked, not the
thing you picked over the last two.

### The backdrop

Clouds drift across the sky in three banks, taking six to eight minutes to
cross. Their colour is interpolated from the same keyframes as everything else,
so they are lit by the moment: cream at golden hour, dull violet at dusk,
near-silhouettes once night falls. They render above the sun, so a bank
crossing it dims it — that occlusion is most of what separates a cloud from a
smudge.

A flock crosses once every four to nine minutes and is gone in fifteen seconds.
The birds are a twelve-frame flipbook rather than a rotating shape, which is
the whole animation: swapping silhouettes lets the wing change shape as well as
angle, so it extends through the downstroke, folds on the recovery, and its
tips curl upward as it rises. A wing that keeps its length reads as a
windscreen wiper. Every crossing rolls its own duration, flock size, height and
descent, and each bird holds its own pace within the group, so the formation
changes shape on the way across and no two crossings are alike.

The flock is damped against the widget's scale rather than tracking it: making
the window bigger should reveal more sky, not larger birds.

Three modes, in the panel, answering three different questions rather than
being three degrees of one:

| | |
| --- | --- |
| **Full** | Clouds and the occasional flock. |
| **Calm** | Clouds only. Nothing crosses quickly. |
| **Light** | A flat sky, for a modest machine. |

*Calm* is about attention. *Light* is about a laptop's battery, so it drops
what actually costs something — blurred surfaces and per-frame animation —
rather than what merely looks busy; the birds are unrendered rather than
hidden, which stops their scheduler too. A fourth mode sat between the two for
a while, with one unblurred cloud bank and nothing else, but blur is what makes
a cloud a cloud, so all it did was leave a shape on the sky. A mode has to be a
coherent thing to want rather than a point on a slider.

The sky, the horizon and the grain are never touched by any of them. They are
the widget's face rather than its ambience.

## Compact mode

Double-clicking collapses the widget to a single row: the readout, the play
control and the padlock. Skip, reset and close are dropped rather than shrunk —
below about 24px a button stops being worth aiming at — and stay available on
the keyboard. Double-clicking again restores the full widget.

<p align="center">
  <img src="docs/media/compact.gif" width="640"
       alt="Double-clicking collapses the widget to a single row and back; the corner grip then drags it through its scale range, from 80% up to 180%">
</p>

<p align="center"><em>Compact mode and the scale range are separate axes: one
decides how much the widget shows, the other how big it is.</em></p>

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

### Tests

```bash
npm test           # once
npm run test:watch # on every save
```

The suite covers the timer's pure logic — the plan builder, the duration
formatter, the settings clamp — and nothing else. That boundary is the point
rather than a shortcut: the window, the click-through and the layout are where
every bug in this project has actually lived, and they are also where automated
tests are expensive, fragile and need a real desktop to run against. What *is*
covered is the part where being wrong would be invisible. A misplaced button is
obvious; a seven-session run with six breaks instead of five is not.

The tests assert rules rather than examples, running the same checks across a
spread of configurations, so what they protect is "a plan always alternates and
never ends on a break" rather than "with these numbers it comes out like this".

## Platform support

| | Status |
| --- | --- |
| Windows 10/11 | Supported |
| Linux (X11) | Supported |
| Linux (Wayland) | Runs, but always-on-top is ignored |

The Wayland limitation is [upstream](https://github.com/tauri-apps/tao/issues/1134):
the protocol gives clients no way to request that a surface stay above others.
Running under XWayland restores it. A `gtk-layer-shell` surface would too, in
principle, except that the protocol it depends on is one GNOME has declined to
implement — so it would fix the smaller half of Wayland. Both are being looked
at rather than promised.

macOS is not listed because it has never been run there. Nothing in the code is
Windows- or Linux-specific by design, but a platform nobody has opened the app
on is not one to claim.

### Linux binaries

Released Linux packages are built by CI inside an **Ubuntu 22.04** container,
and therefore need **glibc 2.35 or newer** — Ubuntu 22.04+, Debian 12+, Mint
21+, Fedora 36+. glibc is not backward compatible, so a binary built on a newer
base will not start on an older one: the build environment is what decides how
far a release reaches, and it is worth deciding on purpose.

A container rather than a runner image of the right age, because runner images
are retired on a schedule that has nothing to do with this project — the one
that matched was already weeks from deprecation when this was set up. An image
tag does not move underneath you.

### Running the AppImage

An AppImage is a file rather than an installed program: it arrives without the
execute bit, and until it has one nothing happens when you open it.

```bash
chmod +x Gloam_0.5.0_amd64.AppImage
./Gloam_0.5.0_amd64.AppImage
```

On a distribution newer than the one it was built on it prints a few lines
about `libgvfscommon.so` and an undefined `g_task_set_static_name`, and on Mint
one more about a missing `xapp-gtk3-module`. Neither stops it starting, and
both are the other side of the trade above: the AppImage carries the GLib it
was compiled against, the host's GIO modules were compiled against a newer one,
and the two decline to load into each other. Building old is what lets the
packages reach back to 2022, and this is what it costs. Gloam opens no files
and mounts nothing, so there is nothing in gvfs for it to miss.

The `.deb` carries none of this, and is the better choice wherever it fits.

## Roadmap

Everything here is built on one rule: **the default state never gets busier.**
Anything new arrives as something you expand into, so a Gloam with every
setting turned on still looks like the screenshot above until you ask it for
more. Growth goes into disclosure, not into the resting state.

What is left before 1.0 is mostly not features. The timer works; what Gloam has
been missing is everything around it — remembering where it lives, being
impossible to lose, and being verifiable by someone who is not holding the
laptop it was built on.

**Done**

- [x] The widget: frameless, always-on-top, an ambient sky that encodes progress
- [x] Lock mode with cursor hit-testing, compact mode, persisted preferences
- [x] A scale factor and a corner grip, so later panels grow inside a container
      that already knows how
- [x] The settings panel: durations, session count, alarm timbre and button
      feedback, with the timer's rules under test
- [x] A living backdrop: clouds, a rare flock, a rarer shooting star, and three
      ambience modes
- [x] CI on every push, and a release built, checksummed and drafted by tag

**0.6.0 — the widget stays where you put it**

- [ ] A tray icon: show, reset the position, quit. Closing hides rather than
      exits, so the widget cannot be lost by clicking the wrong thing.
- [ ] The window position remembered between runs, and checked against the
      monitors that actually exist at startup rather than the ones that did
- [ ] The countdown correct while the window is hidden, not only while it is
      being watched
- [ ] The timer engine, the preference validation and the hit-test arithmetic
      under test — the places where being wrong would be invisible

**0.7.0 — polish, if it earns its place**

- [ ] A one-time hint on first run, so dragging and the compact toggle are
      discovered rather than read about
- [ ] The shortcuts listed inside the app
- [ ] Launch on startup, as a preference
- [ ] An alternative horizon or two — a city skyline whose windows light up as
      the sun goes down — as one row in the backdrop tab

**1.0.0 — the declaration**

No new code. The README split into documentation that suits someone using
Gloam and documentation that suits someone reading it, a contributing guide
that states the bar a feature has to clear, a security policy, and a platform
checklist that has actually been run rather than assumed. The version people
judge a project by should be the one with the least left to go wrong.

### Deliberately not on this list

- **Statistics, history, streaks.** The second paragraph of this README says
  what Gloam is not, and a dashboard is the shortest path to becoming it.
- **A scene *editor*.** A skyline is worth having. A mode for arranging one,
  inside a 320-pixel window, is not.
- **Notifications.** The widget is already on screen, and a notification is
  precisely the interruption it exists in order not to be.
- **Accounts, sync, anything networked.** Gloam opens no connections at all.
  That is worth more than any feature which would end it.

### After 1.0

- `gtk-layer-shell`, if enough people turn out to be on a compositor that
  implements the protocol GNOME does not.
- Ambient music from a local folder. It would be the heaviest subsystem in the
  project, the only one nothing else depends on, and a transport with a track
  name on it is a thing to fiddle with — which is the argument this README
  opens with. Last on purpose, and not certain.

### A note on motion

The eye detects movement in peripheral vision far better than it detects detail
or colour — which is exactly the hazard for an app whose whole purpose is to not
take your attention. Ambient motion here is therefore governed by one rule:
**continuous motion must be too slow to trigger that reflex, and anything fast
must be rare.** Clouds drift slowly enough that you only notice they moved by
comparing two moments. Birds cross once every several minutes, which turns them
from noise into something you catch by chance and enjoy. Scarcity is what makes
them work.

## Project layout

```
src/
  App.svelte          composition and layout of every visual layer
  lib/
    plan.ts           the timer's pure logic, and the only tested code
    plan.test.ts      its rules, asserted across many configurations
    timer.svelte.ts   the reactive state and the countdown
    lock.svelte.ts    click-through and cursor hit-testing
    scale.svelte.ts   the scale factor and its drag interaction
    sky.ts            the palette, keyframes and interpolation
    ambience.ts       what each backdrop mode switches off
    sound.ts          instruments and phrases, all synthesised
    prefs.ts          persisted preferences, validated on the way in
    window.ts         guarded wrappers over the Tauri window API
    Stars.svelte      fixed star field
    Clouds.svelte     drifting banks
    Birds.svelte      the flock, and when it flies
    birdFrames.ts     its twelve silhouettes, generated
    Grain.svelte      generated film grain
    Controls.svelte   transport buttons
    Padlock.svelte    the animated lock
    Grip.svelte       the corner resize handle
    Panel.svelte      the settings panel below the horizon
    Stepper.svelte    minus/value/plus row
    Cycler.svelte     one-of-a-short-list row
src-tauri/            Rust shell, window configuration, global shortcut
scripts/              version and changelog checks, used by CI
.github/workflows/    checks on every push, a release on every tag
docs/media/           the stills and GIFs in this file
```

## License

MIT — see [LICENSE](LICENSE).
