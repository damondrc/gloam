# Contributing

## The bar

Every proposal is measured against one question:

> **Does this make Gloam better without making Gloam busier?**

Gloam is a countdown you are not supposed to look at. Most things that would
make it a better *application* would make it a worse widget, and the failure
mode is not one bad feature — it is twelve good ones. So the rule underneath
everything is that **the default state never gets busier**. Anything new
arrives as something you expand into: a Gloam with every setting turned on
still looks like the recording at the top of the README until you ask it for
more. Growth goes into disclosure, not into the resting state.

Some things are settled, and a pull request implementing one will be declined
however well it is written:

- **Statistics, history, streaks.** A dashboard is the shortest path to
  becoming the kind of app Gloam exists instead of.
- **A scene editor.** A skyline is worth having. A mode for arranging one,
  inside a 320-pixel window, is not.
- **Notifications.** The widget is already on screen, and a notification is
  precisely the interruption it exists in order not to be.
- **Accounts, sync, anything networked.** Gloam opens no connections at all.
  That is worth more than any feature which would end it.

If you are unsure, open an issue before writing code. A design conversation
costs an afternoon; a rejected pull request costs somebody a weekend.

## Building it

Requires [Node.js](https://nodejs.org) 20 or newer and the
[Rust toolchain](https://rustup.rs). On Windows you also need the **Desktop
development with C++** workload from the Visual Studio Build Tools. On Debian
or Ubuntu:

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

Then:

```bash
npm install
npm run app        # development build with hot reload
npm run app:build  # an installer in src-tauri/target/release/bundle
```

The frontend also runs standalone in a browser, which is much faster for
iterating on the visual layer:

```bash
npm run dev        # then open http://localhost:1420
```

Every Tauri call is guarded, so the widget degrades gracefully outside the
desktop shell rather than throwing.

### What a development build does that a shipped one cannot

The durations offer a **half-minute stop** below their real minimum. The sky
takes a whole session to get from afternoon to dark and the city takes a whole
break to fall asleep, so checking the order any of that happens in would
otherwise cost forty minutes per adjustment. The flock and the shooting star
are also scheduled far more often, so they can be looked at at all.

Both live behind `import.meta.env.DEV`, which the release bundler resolves to
`false` and then removes. They are not hidden settings in a shipped Gloam; in a
shipped Gloam they are absent. Anything added there must only ever *add* a
choice, never change one — a test build has to behave like a release build
until the moment you deliberately ask it not to.

**One trap follows from the same difference.** Turning on *Launch at login* in
a development build registers the debug binary, which only works while Vite is
running. Gloam refuses second copies, so your next `npm run app` will surface
that broken instance instead of starting a new one, and it looks exactly like
the app being broken. Turn the switch off again before you finish.

## Checks

Everything CI will run, before it runs it:

```bash
npm run check        # types, across TypeScript and Svelte
npm test             # once; npm run test:watch on every save
npm run rust:fmt     # add --check to ask rather than apply
npm run rust:lint    # clippy, warnings are errors
```

The Rust ones go through npm rather than cargo so they can be run from the
project root like everything else, and so that CI and a person about to push
are running the same string out of the same file.

**Tests assert rules rather than examples.** What they protect is "a plan
always alternates and never ends on a break", not "with these numbers it comes
out like this". And they are themselves checked by breaking the code on purpose
and confirming they notice — a test that passes against a deliberately wrong
implementation is worse than no test, because it also stops anyone looking.
[How it works](docs/architecture.md#what-is-tested-and-what-is-not) explains
where the boundary is drawn and why.

**What no test covers is the window itself.** Always-on-top, click-through,
resizing and trays need a desktop and a person, so they are a written
checklist: [docs/platform-testing.md](docs/platform-testing.md). If your change
touches how the window behaves, expect to run the relevant sections on a real
machine and record the result. A row nobody ran counts as a row that failed.

When you add a row, make sure it **can fail**. State the moment, not only the
outcome — "the sound arrives at the boundary" rather than "the state is correct
afterwards", because the second is satisfied by a widget that does nothing at
all until you look at it.

## Versioning

From 1.0 onward, anything that would invalidate `gloam.prefs.v1` needs a
migration or a major version. Adding a field does not: stored preferences are
validated on the way in and anything missing falls back to its default. Removing
one, or changing what one means, does.

## Commits

Commit messages here explain **why**, not what — the diff already says what.
The useful content is the alternative that was rejected and the reason, because
that is the part which is invisible six months later and which stops the same
decision being relitigated. Look at the history for the shape of it.

Documentation is part of the change, not a follow-up. If a paragraph in the
README or in `docs/` describes what your change replaced, it is now wrong, and
a wrong document is worse than a missing one.

## Anything you promise to come back to

Goes in [docs/open.md](docs/open.md), with what would unblock it. A note in a
source file is easy to write and easy to lose; that list exists so "we will
look at that" has somewhere to be ticked off.
