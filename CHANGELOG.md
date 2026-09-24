# Changelog

All notable changes to Gloam are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
From 1.0 onward, anything that would invalidate `gloam.prefs.v1` needs a
migration or a major version. Adding a field does not: preferences are
validated on the way in and anything missing falls back to its default.

Entries describe what changed for someone using Gloam. Reasoning lives in the
commit that made the change, and in the architecture notes.

## [Unreleased]

## [1.1.0]

### Added

- **A music player.** Point Gloam at a folder and it plays what is in it —
  FLAC, MP3, Vorbis, WAV or AAC. Previous, play and next appear on the
  widget's face with the track name beside them; the folder and its volume
  live in a new **Music** tab in the panel. One folder, flat, in file-name
  order: descending into subfolders would make it a library, and a library
  needs more than three buttons to navigate.
  Decoding happens inside the app rather than through the browser engine.
  That is the whole shape of the feature and not a detail — a web page's audio
  goes through a media stack that depends on what the machine happens to have
  installed, which is precisely what made Gloam's AppImage ship silent. FLAC
  plays here whether or not the system has a codec for it.
  The music has its own volume, separate from the widget's. Your folder is
  read and never written to, and nothing plays on its own: the folder is
  remembered across restarts so the queue is ready, but pressing play stays
  something you do.
- **The music steps aside while Gloam speaks.** At a phase change or the end
  of a run it dips to about a fifth and comes back, rather than being talked
  over. Never to silence — a gap draws more attention than a dip, and you
  should be able to tell the music never stopped. Button clicks never do this;
  only the sounds that mean something.

### Fixed

- **Music now follows the default output device.** Plugging in headphones
  mid-track used to move every sound on the machine except the music, which
  carried on in the speakers. It now moves across within a couple of seconds,
  resuming near where it was rather than starting the track again.

## [1.0.0] — 2026-09-14

### Added

- A tour on the very first run. Four steps below the widget, with arrows to
  move between them and one click to skip the lot: what the sky is for, that
  there is no title bar to grab, what the padlock actually does, and where
  settings and the tray are. It never appears again on its own.
- A resting place. The very first time Gloam opens it settles into the bottom
  right of the screen — inside the usable area, so it sits beside the taskbar
  rather than behind it, inset from both edges, and high enough that the panel
  has somewhere to unfold. It starts at 150% too: at 100% on a modern display
  the readout is small enough to have to look at rather than glance at, and
  glancing is the whole proposition. Both only ever apply to somebody opening
  it for the first time — anyone who has set a size or moved the window keeps
  what they chose.
- A **Keys** tab in the panel, listing every shortcut — and holding the way
  back to the tour for anyone who wants it a second time.
- **Launch at login**, under a Startup heading in the General tab. Gloam
  registers itself with the session and starts *in the tray* rather than on
  screen — a widget is something you reach for, and a session manager is not a
  person reaching. The tray icon or `Ctrl+Alt+G` brings it out. On a desktop
  with no tray it opens on screen instead, and the line under the switch says
  which of the two you will get. It is the one setting Gloam does not store
  with the others, because it belongs to the operating system rather than to
  Gloam.
- A choice of horizon, in the Ambience tab. **Water** is the flat band Gloam
  has always had. **Skyline** is a city whose windows fill in through the
  sunset, are at their fullest the moment the sun has gone, and go out again
  through the break as the place turns in for the night — the same clock the
  sun is keeping, read a second way. **Ridge** is three ranges at three
  distances, the far one tallest and palest.
  Whichever is picked replaces the bottom of the widget rather than standing on
  it, and stays inside the last quarter of the frame, because the sky is the
  clock and the sky is what should dominate. Both shapes are generated rather
  than drawn, and each launch draws a different one — so what changes is which
  city you find next time you open Gloam, never the one you are working in
  front of. Compact keeps whichever was picked.

### Changed

- `Reset position` brings the widget back to the corner it lives in rather than
  centring it. The middle of the screen is the most intrusive place on it, so
  the old behaviour was a rescue you then had to undo; the corner is where
  Gloam starts on a fresh install and where it is out of the way, whether you
  leave it there locked or put it straight back in the tray. The spot is worked
  out from the screen's usable area at the moment you ask for it, so it is as
  certain to exist as the centre was — and it is the same call a first launch
  makes, so the two cannot end up disagreeing.
- The water band is the same height as the other two horizons — the last
  quarter of the widget rather than the last third — so switching between them
  does not move the skyline up and down, and there is a little more sky.
- The documentation is split by who is reading it. The README is a page about
  the app — what it is, how to get it, what the settings do, which platforms it
  is known to work on — and everything about *why* it works the way it does
  moved to [docs/architecture.md](docs/architecture.md). A contributing guide
  and a security policy join them. 810 lines were serving two readers and
  serving the second one better.

### Fixed

- The platform notes no longer claim an `.rpm` that was never built. They said
  one was published and unverified; the bundle targets have only ever been the
  Windows installer and the `.deb`. The claim is withdrawn rather than made
  true by adding the target, because publishing a package nobody has installed
  is what the withdrawn AppImage was. Fedora, openSUSE and Arch are on the
  open list, with an `.rpm` and a Flatpak as the two routes.
- The same notes now say which half of Gloam's Linux floor was measured and
  which was deduced. That the binary needs nothing newer than glibc 2.34 was
  read out of its own symbols; that it therefore runs on Ubuntu 22.04, Debian
  12 and Mint 21 follows from a dependency and has not been watched happen.
- The shooting star's reflection only appears where there is water. It belongs
  to the surface rather than to the sky, and a glow rising out of a rooftop is
  a reflection of nothing. The streak itself still crosses whichever horizon
  is up.

## [0.6.0] — 2026-08-20

### Added

- Gloam remembers where you left it. The position is recorded once the window
  has been still for a moment and applied again at the next launch before
  anything is drawn, so the widget appears in place rather than jumping there.
  It is checked against the screens actually attached first: a position from a
  monitor that is no longer plugged in is discarded, and the window opens where
  it always did.
- A tray icon, with an entry that shows or hides the widget, `Reset position`
  and `Quit`. Closing the widget now hides it and the run carries on; the icon
  is the way back.
  `Reset position` centres the window, which is the way out of having dragged
  it somewhere unreachable or left it on a monitor that is no longer there.
  Where no tray can be created — several Linux desktops ship without one —
  closing goes back to meaning quit, and the button's tooltip says so.
- Tests for the timer engine and for the validation applied to stored
  preferences: pausing and resuming, skipping, resetting, reconfiguring
  mid-run, the sequence of transition sounds, and every way a preferences blob
  can be corrupt without stopping the widget from opening.
- Tests for the keyboard bindings and for the arithmetic that decides whether
  the cursor is over the padlock — the two pieces of logic most able to be
  quietly wrong on a second monitor or at a scale nobody tried.
- A written record of what has actually been checked, on what, and when:
  `docs/platform-testing.md` is the list, `docs/platforms.md` is what it found.
  The support table in the README now says which version each row was verified
  against, and "not tested" where nobody has run it.

### Changed

- The settings panel has two tabs instead of three. **General** is how long a
  run is; **Ambience** is everything about what the widget is like to sit
  beside — volume, sound and backdrop together.
- The three sound settings are now one. Alarm timbre, alarm pattern and button
  set have become a single choice of **Bowl**, **Bell** or **Felt**, each of
  which decides all three. The material of the alarms and the material of the
  buttons were never meant to be picked apart, and separate controls were a way
  to break that rather than a way to choose.
- The backdrop row is labelled **Backdrop** rather than Ambience, which is now
  the name of the tab it sits in.
- Existing preferences carry over: whichever alarm you had chosen selects the
  set nearest to it, so nobody who went looking for the quietest option is
  handed a louder one by the update.

### Fixed

- The settings panel closes when the widget is locked. It was the one opaque
  part of the widget, so while everything else receded to a watermark the
  settings stayed at full strength, looking like the only thing on screen.
- The widget comes back from the tray in one movement, rather than appearing
  where the window manager felt like putting it and jumping into place a frame
  later. It is positioned before it is shown.
- The widget comes back from the tray where it was put away. Showing a hidden
  window on X11 is a remap, and a window manager places a remapped window
  wherever its own policy says — usually near the top left. The position is
  now written down on the way out and restored on the way in.
- Putting the widget away from the tray is possible, not only bringing it back.
  The menu's first entry is a toggle that says which way it will go, and on
  Windows a left click on the icon does the same without opening the menu. On
  Linux the menu is the only interaction a tray icon has at all, so it had to
  carry both directions.
- The Linux package installs icons at every size a desktop asks for. It had
  32, 128, 256 and 512, and no 48 — which is the size a desktop shortcut and a
  file manager reach for first, so a shortcut showed a generic placeholder
  while the same application showed correctly everywhere else.

### Removed

- The AppImage. Without a bundled media framework it started and played
  nothing — WebKitGTK routes web audio through gstreamer, and the generated
  launcher empties the plugin search path, so it could not fall back on the
  plugins already installed either. With one bundled it stopped starting at
  all. A silent alarm looks exactly like a working one, and shipping nothing
  is more honest than shipping either. Linux releases are a `.deb`.
- The `S`, `R`, `L` and `0` shortcuts. A key is bound now only if what it does
  is reversible and reachable another way; skipping, resetting and locking are
  none of those, and all three have a button. Lock keeps `Ctrl+Alt+G`, which is
  modified and cannot be pressed by accident.
- The `pulse` alarm and the `drop` button set, which no set composes from.

## [0.5.0] — 2026-08-11

### Added

- A drifting cloud bank on the backdrop, lit by the same keyframes as
  everything else, so a bank crossing the sun dims it.
- A flock that crosses the sky once every few minutes, with bounding flight,
  depth, and its own order — each bird keeps its own pace within the group.
- A shooting star, on a rare night, reflected in the water below the horizon.
- Backdrop modes — Full, Calm and Light — in a new Backdrop tab.
- Button sound sets, and a second axis for the alarms, so timbre and pattern
  are chosen separately.
- Screenshots and GIFs in the README.
- Continuous integration: every push runs the version check, the type check and
  the tests, then assembles installers on Windows and Linux.
- A release pipeline. Pushing a tag verifies that the tag, the three declared
  versions and the changelog agree, builds both platforms, publishes SHA256
  checksums beside the installers, and opens a draft for review.
- A download section in the README, with how to check a build against its
  checksum.

### Changed

- The settings panel is split into three tabs, so the sections stop growing
  into most of a laptop screen at 180% scale.
- Only one sound gesture plays at a time: starting one fades out whatever is
  still ringing, so auditioning a setting plays the thing you picked.
- The readout sits above the horizon rather than straddling it.
- Linux packages are built inside an Ubuntu 22.04 container and need glibc 2.35
  rather than 2.39, which brings back Ubuntu 22.04 LTS, Debian 12, Mint 21 and
  Fedora 36 — none of which could run a Gloam release before this.

### Fixed

- Keyboard focus is visible again. The controls fade out rather than leaving
  the document, so they kept their place in the tab order while invisible;
  focus now summons them the way hover does.
- A focused control keeps the spacebar. With the focus on a settings tab,
  pressing space started the timer instead of switching tab.
- The countdown is right after the widget has been minimised, or after the
  machine has been asleep. A tick that arrived late used to advance the run by
  exactly one segment and start the next one from the moment it noticed, so an
  interruption both lost the segments it spanned and lengthened the run by
  however long it had lasted. Every segment that expired is now accounted for,
  each starting when the one before it ended — and only the transition you
  actually arrived at is announced, rather than four chimes at once on opening
  a laptop.
- Preferences are no longer written to storage on every pointer move while the
  resize grip is held.
- The space bar starts and pauses again after clicking a button. A button keeps
  the keyboard focus once it has been clicked, so space was pressing it a
  second time — most noticeably on the padlock, where it toggled the lock. A
  control claims the space bar only while it is being driven by the keyboard.
- The controls no longer stay lit after a click once the pointer has left.
- Tabbing to the transport controls, the resize grip or the padlock now reveals
  them. Only the close button and the chevron ever did: Svelte scopes the
  selector inside a `:has()` as well as outside it, so the rule was quietly
  narrowed to elements the root component renders itself, and the padlock's
  rule was dropped altogether.

### Removed

- Two window wrappers nothing called.

## [0.4.0] — 2026-08-04

### Added

- A settings panel that unfolds below the horizon, opening with a volume
  control.
- Configurable focus duration, break duration and session count.
- Sound settings, and a voice for the padlock.
- Tests covering the timer's rules: the plan builder, the duration formatter
  and the settings clamp.

### Changed

- The chimes are now a struck bowl with paired phrases — rising into focus,
  falling into a break.

### Fixed

- The window manager no longer offers a resize border around the widget.

## [0.3.1] — 2026-08-01

### Added

- The resize grip responds to both axes, so a diagonal drag reads as one
  gesture rather than only its horizontal half.

### Fixed

- The window resizes on Linux, where GTK had been reading the non-resizable
  flag as "this window has one size" and ignoring every later request.
- The padlock's hit area is correct on Linux, where GTK's frame band had been
  offsetting every derived coordinate.
- The compact toggle no longer maximises the window.
- The window no longer resizes while the grip is being dragged.

## [0.3.0] — 2026-07-31

### Added

- A scale factor and a corner resize grip: the widget scales from 80% to 180%,
  type and spacing included, as a real relayout rather than a transform.

### Fixed

- Lock mode is self-healing and single-owner, so a dropped click-through call
  recovers within a second and a stale controller stands down.
- A second copy refuses to start, and launching again surfaces the running one.

## [0.2.0] — 2026-07-28

### Added

- Lock mode: the widget dims to a watermark and lets clicks pass through to the
  window beneath, with the padlock hit-tested against the global cursor so
  there is a way back out.
- `Ctrl+Alt+G` as a global escape hatch out of lock mode.
- Compact mode, collapsing the widget to the readout, play control and padlock.
- Preferences that survive a restart.

## [0.1.0]

### Added

- The floating widget: frameless, transparent, always-on-top, draggable.
- Fixed 30/10 focus and break cycles.
- An ambient sky whose state encodes progress, and chimes on each transition.

[Unreleased]: https://github.com/damondrc/gloam/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/damondrc/gloam/compare/v0.6.0...v1.0.0
[0.6.0]: https://github.com/damondrc/gloam/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/damondrc/gloam/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/damondrc/gloam/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/damondrc/gloam/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/damondrc/gloam/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/damondrc/gloam/releases/tag/v0.2.0
