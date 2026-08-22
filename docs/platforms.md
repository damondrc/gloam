# Platforms

What Gloam is known to do, on what, and how that is known.

Every claim here comes from someone running
[the checklist](platform-testing.md) on a real machine, and the date it was
last run is at the bottom. Where nobody has run it, this file says so instead
of guessing — a platform nobody has opened the app on is not a platform it
supports.

## Windows 10/11

**Supported.** Verified against 0.6.0 on Windows 11, single monitor and dual,
with one display at 100% and the other at 150%.

Everything in the checklist passes. The installer is NSIS, and it is not code
signed, so the first run raises a SmartScreen warning — the checksum published
beside the download is the answer to that, and the README says how to check it.

## Linux · X11

**Supported.** Verified against 0.6.0 on Linux Mint 22 (Cinnamon, X11), single
monitor and dual.

Everything in the checklist passes, with two things worth knowing.

**Dragging can feel sticky.** The window resists screen edges and the edges of
other windows. That is not Gloam — dragging is handed to the window manager,
and Muffin does this for every window. The screen-edge half can be turned off
in *System Settings → Windows → Tiling*; the resistance against other windows
[has not been configurable since Cinnamon 5.4](https://github.com/linuxmint/cinnamon/issues/11113).

**Resizing is less smooth than on Windows.** The corner grip works, but the
edges shimmer slightly as it drags. The compositor resizes the surface on a
different beat from the WebView's repaint, and nothing above that layer can
fix it — it is the same effect the widget already sidesteps by parking the
window at its largest size for the length of a drag.

### How far back a Linux release reaches

Packages are built by CI inside an **Ubuntu 22.04 container**, and the oldest
releases they run on are **Ubuntu 22.04, Debian 12 and Mint 21**.

Two things set that floor, and only one of them is the obvious one. The binary
itself asks for nothing newer than **glibc 2.34** — measured, not assumed, by
reading the versioned symbols out of it — which is older than the container it
was built in. What actually decides the limit is `libwebkit2gtk-4.1`, which the
`.deb` depends on and which first appears in those releases. Building somewhere
older would not widen the range.

The container is still what keeps that true. glibc is not backward compatible,
so a build on a newer base would raise the requirement above what any of those
releases have, and the range would quietly narrow with nobody deciding to
narrow it. Which is why the build environment is pinned in the release workflow
where it can be seen rather than inherited from whatever the runner happens to
be that month.

A container rather than a runner image of the right age, because runner images
are retired on somebody else's schedule — the one that matched was already
weeks from deprecation when this was set up. An image tag does not move
underneath you.

### `.deb` only

There was an AppImage. Built without a bundled media framework it started and
played nothing, because WebKitGTK routes all web audio through gstreamer and
the launcher Tauri generates empties the plugin search path — so it could not
even fall back on the plugins the machine already had. Built with the media
framework bundled, it stopped starting at all.

Two attempts, on the least used package, at a problem belonging to somebody
else's packaging while the `.deb` was correct throughout. A silent alarm looks
exactly like a working one; shipping nothing is more honest than shipping
either of those.

An `.rpm` would cover Fedora and openSUSE and costs one line of configuration.
It is not here yet for the same reason the AppImage left: nobody has a machine
to verify it on.

## Linux · Wayland

**Not tested.** No session has been available to run the checklist on, so
everything below is reasoning rather than knowledge, and it is written down
that way on purpose.

Always-on-top is expected not to work.
[The protocol gives clients no way to ask for it](https://github.com/tauri-apps/tao/issues/1134),
and that is a design decision rather than a gap. The global shortcut is
expected not to work either, for a related reason: Wayland does not let an
arbitrary client grab keys. Remembering the window position will not work,
because a client cannot place itself.

Running under XWayland should restore all three, since the app is then an X11
client. A `gtk-layer-shell` surface would restore the first, except that the
protocol it needs is one GNOME has declined to implement — so it would fix the
smaller half of Wayland at a cost that has to be paid for all of it.

None of this has been observed. It is what the documentation of the layers
underneath says should happen.

## macOS

**Never run.** Nothing in the code is written for one platform, and the whole
window layer is the part that behaves differently everywhere, which is exactly
the part that would decide it. Until somebody opens it on a Mac there is
nothing to say.

---

Last verified: **0.6.0**, on Windows 11 and Linux Mint 22 (Cinnamon, X11).
