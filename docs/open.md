# Open threads

Everything this project has said it would come back to.

A note in a source file or a paragraph in a document is easy to write and easy
to lose. This list exists so that "we will look at that" stays a commitment
with somewhere to be ticked off, rather than a sentence somebody wrote once.

Nothing here is a bug. Bugs get fixed or written down as limitations; these are
decisions that were deliberately deferred, and each says what would unblock it.

## Waiting on a machine

- [ ] **Verify the `.rpm` on Fedora or openSUSE.** It is built and published,
      and marked unverified in [platforms.md](platforms.md) until somebody
      installs it. A virtual machine is enough.
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

- [ ] **Revisit the AppImage.** Withdrawn in 0.6.0 after it shipped silent and
      then stopped starting. The known cause is over-bundled libraries
      colliding with the host's; the fix is post-processing the AppDir, which
      Tauri gives no hook for. A Flatpak would answer the same need better and
      is the more likely direction.
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

## Planned

- [ ] **A local music player** — 1.1.0. Decoding in Rust rather than through
      the WebView, for the reason the AppImage demonstrated: anything routed
      through WebKitGTK's media stack depends on what the machine happens to
      have. A folder rather than a library, and the music ducks for a
      transition rather than competing with it.
- [ ] **Alternative horizons** — 0.7.0. A skyline whose windows come on as the
      sun goes down, and a mountain ridge, generated rather than drawn so they
      scale with everything else.

---

When one of these is done, tick it and say where it went — the release it
landed in, or the document that now records the answer.
