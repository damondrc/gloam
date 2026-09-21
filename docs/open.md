# Open threads

Everything this project has said it would come back to.

A note in a source file or a paragraph in a document is easy to write and easy
to lose. This list exists so that "we will look at that" stays a commitment
with somewhere to be ticked off, rather than a sentence somebody wrote once.

Nothing here is a bug. Bugs get fixed or written down as limitations; these are
decisions that were deliberately deferred, and each says what would unblock it.

## Waiting on a machine

- [ ] **Confirm the Linux floor.** [platforms.md](platforms.md) says the
      packages are *expected* to run on **Ubuntu 22.04, Debian 12 and
      Mint 21** or newer. The
      glibc half of that is measured, from the versioned symbols in the binary;
      the rest is deduced from what `libwebkit2gtk-4.1` first appeared in, and
      nobody has watched it happen. It is the only claim in that document that
      did not come from a real machine, and it is a promise already published
      beside the downloads. One Ubuntu 22.04 virtual machine settles it.
- [ ] **Watch a run end while knowing it was running.** On Linux, an
      unattended laptop announced the end of a run at a moment nobody was
      expecting, with the lid shut. Every part of that is consistent with the
      engine working — the end sound cannot fire unless a run is in progress,
      and the countdown is held against an absolute deadline, so a run spanning
      a suspend finishes the instant the machine returns rather than drifting.
      But that is an explanation, and the row wants an observation. Start a run
      with a known length, leave, and note what the widget says when the sound
      arrives: `DONE` closes this. Recorded as a caveat on F5 until somebody
      has.
- [ ] **Run the checklist under Wayland.** Everything the project says about
      Wayland is currently reasoning from the protocol rather than observation,
      and the two are kept apart on purpose. One session with the checklist
      would replace the whole section with facts.
- [ ] **Try `GDK_BACKEND=x11` under Wayland.** Expected to restore
      always-on-top, the global shortcut and window positioning, since the app
      becomes an X11 client. If it holds, the packages could set it and the
      Wayland row would change from a limitation to a footnote.
- [ ] **Open it on macOS.** Nothing in the code is written for one platform.
      Nobody has run it there, so nothing is claimed.

## Waiting on a decision

- [ ] **How to reach the distributions that are not Debian.** Gloam ships a
      `.deb` and nothing else, so Fedora, openSUSE and Arch have no package.
      There are two routes and they are not equal.

      An **`.rpm`** is one word in `tauri.conf.json`. It is also the same
      binary with different metadata, and it inherits the `.deb`'s model —
      declare dependencies, let the distribution provide them — rather than
      the AppImage's, which was to carry everything and collide with the host.
      What can still go wrong is the metadata: package names differ between
      families, Tauri guesses the translation, and a wrong guess is an install
      that fails to resolve or an app that installs and will not start. Built
      in an Ubuntu 22.04 container, what it declares may not describe what
      Fedora ships.

      A **Flatpak** answers all of them at once, which is why it is the more
      likely direction, and it is also the honest successor to the AppImage:
      the same wish for one package everywhere, in a format that was designed
      for it instead of improvised.

      Either way the rule the AppImage taught stands — nothing gets published
      that nobody has installed. So this waits for a virtual machine, and the
      virtual machine waits for a version that has stopped changing: one round
      of checking against something stable is worth more than keeping a VM
      alive through a release cycle. After 1.0.

- [ ] **`gtk-layer-shell` for Wayland.** Would restore always-on-top on
      compositors that implement `wlr-layer-shell`, which GNOME does not — so
      it fixes the smaller half of Wayland. Worth revisiting if people turn up
      on sway or Hyprland.
- [ ] **A GTK window type hint to opt out of tiling.** Dragging resists screen
      edges on Cinnamon because the window manager does that to every window.
      Setting the window's type hint might exempt it, at the cost of changing
      how focus and the window list treat it. An experiment, not a plan.
- [ ] **Preferences in a file rather than `localStorage`.** The seam is marked
      in `prefs.ts`. Nothing needs it yet; the validation on the way in already
      does the job that moving would be meant to do.
- [ ] **What the face shows when there is more to show than room.** The
      readout and a track title both want the middle of a 320-pixel widget,
      and in compact there are 180. Three shapes have been considered and two
      were set aside, which is the part worth keeping.

      **Swapping one for the other by size** was the first idea and it fails
      on its own premise. The argument for dropping the digits is that the sky
      already carries the time — but compact is 180×58, and at that size the
      gradient stops being legible as progress: nobody reads early dusk off
      late dusk in a band 58 pixels tall. The digits are needed *more* there,
      not less. As a setting it also multiplies: compact against readout
      against whether music is loaded is eight states to document and test.

      **A title that appears when the track changes and leaves again** is the
      shape that fits. It costs no setting and no space, it answers "what is
      this?" at the moment the question occurs, and it is the same grammar as
      the flock and the shooting star — things that happen rather than things
      that sit there.

      **A resting face with no readout on it** is worth doing and worth
      renaming. Hiding the clock outright would break the one job: the sky
      says "about half way", never whether three minutes are left or six, and
      that number is exactly what somebody wants before starting something.
      But the controls already appear on hover and withdraw at rest, so the
      readout can join them — at rest the widget is scenery, and the number
      stays one gesture away. Not hidden, just not resident.

      Whatever is built, none of it keys off whether music is loaded. Having
      chosen a folder and wanting to see the digits are unrelated questions,
      and tying them together means plugging in music silently changes the
      clock.

## Planned

- [ ] **A local music player** — 1.1.0. Decoding in Rust rather than through
      the WebView, for the reason the AppImage demonstrated: anything routed
      through WebKitGTK's media stack depends on what the machine happens to
      have. A folder rather than a library, and the music ducks for a
      transition rather than competing with it.
- [x] **Alternative horizons** — landed in 1.0.0. A skyline whose windows come
      on as the sun goes down and out again through the break, and a mountain
      ridge in three ranges. Generated from a seed rather than drawn, so
      nothing had to be licensed and both scale with everything else.
      `src/lib/horizon.ts`.
- [x] **Launch with the session** — landed in 1.0.0, into the tray. The state
      is read from the operating system rather than stored, because it is the
      operating system's. `src/lib/autostart.ts`.

## Answered

- [x] **Revisit the AppImage** — answered by not reviving it. Withdrawn in
      0.6.0 after shipping silent and then failing to start; the cause is
      over-bundled libraries colliding with the host's, and the fix is
      post-processing the AppDir, which Tauri gives no hook for. The wish
      behind it — one package that works everywhere — is real, and belongs to
      the packaging thread above, where a Flatpak answers it in a format
      designed for the job rather than improvised into it.
- [x] **The `.rpm` that was never built.** [platforms.md](platforms.md) claimed
      one was published and unverified; `tauri.conf.json` had only ever listed
      `nsis` and `deb`. Corrected in 1.0.0, and folded into the packaging
      thread above rather than fixed by adding the target — publishing a
      package nobody has installed is the thing the AppImage taught this
      project not to do.

## Documented instead

- [x] **The Spanish translation.** Asked for while 1.0 was being built, and
      deferred past 1.1 on purpose: an interface this small is mostly nouns, and the work is
      not the words but deciding which of them are labels and which are part
      of the picture. FOCUS and BREAK are set in the widget's own type at its
      own size and read as marks rather than as text, so they would most
      likely stay. Nothing is blocked; there is simply nothing to translate
      until the app has stopped changing shape.

---

When one of these is done, tick it and say where it went — the release it
landed in, or the document that now records the answer.
