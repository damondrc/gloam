# Platforms

What Gloam is known to do, on what, and how that is known.

Every claim here comes from someone running
[the checklist](platform-testing.md) on a real machine, and the date it was
last run is at the bottom. Where it has not been run yet, this file says so
rather than guessing, and the row stays on the list in
[open threads](open.md) until it has been.

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

An `.rpm` covers Fedora and openSUSE. It is published and **not yet verified**
— nothing has installed it, so nothing is claimed about it beyond that it
builds. Confirming it needs one virtual machine, and it is
[on the list](open.md).

## Linux · Wayland

**Not tested yet.** The checklist has not been run against a Wayland session,
so everything below is reasoning from the protocol rather than knowledge, and
the two are kept apart on purpose. One session with the list would replace this
whole section with facts, and it is [on the list](open.md).

Always-on-top is expected not to work.
[The protocol gives clients no way to ask for it](https://github.com/tauri-apps/tao/issues/1134),
and that is a design decision rather than a gap. The global shortcut is
expected not to work either, for a related reason: Wayland does not let an
arbitrary client grab keys. Remembering the window position will not work,
because a client cannot place itself.

Running under XWayland should restore all three, since the app is then an X11
client — which is the first thing to try, and would turn this section from a
limitation into a footnote. A `gtk-layer-shell` surface would restore the
first, except that the protocol it needs is one GNOME has declined to
implement, so it would fix the smaller half of Wayland at a cost paid for all
of it. Both are open.

None of it has been observed. It is what the documentation of the layers
underneath says should happen, and that is a weaker kind of claim.

## macOS

**Not run yet.** Nothing in the code is written for one platform, but the
window layer is the part that behaves differently everywhere and is exactly
what would decide it. Opening it on a Mac once is all it would take to have
something to say, and it is [on the list](open.md).

---

Last verified: **0.6.0**, on Windows 11 and Linux Mint 22 (Cinnamon, X11).
