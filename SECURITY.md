# Security

## What Gloam does not do

Most of a security policy is usually about what an application touches. The
short version here is that Gloam touches almost nothing, and that is a design
decision rather than an accident.

- **No network.** Gloam opens no connections of any kind. There are no
  accounts, no sync, no telemetry, no update check and no analytics. Its
  Content Security Policy is `default-src 'self'`, so the WebView cannot load
  anything remote even if something tried to.
- **One folder of yours, read and never written.** Since 1.1.0 Gloam can play
  music, and that is the only reason it looks at your files at all. It opens
  one file picker — the operating system's own, from the Music tab, and only
  when you press it — and reads the playable files directly inside the folder
  you chose: not the folders inside it, and nothing else on the disk. It never
  writes, moves, renames or deletes anything there. The folder's path is kept
  in the preferences so the queue is ready next time; it is the only path
  stored.
- **Its own preferences, validated.** They live in the WebView's
  `localStorage` under a single key, `gloam.prefs.v1`, and everything read back
  out of it is checked before use — corrupt or hand-edited preferences produce
  defaults rather than undefined behaviour.
- **One decoder, in memory-safe code.** Gloam's own sounds are synthesised and
  every shape is generated, so it ships no media files. The music you choose
  is decoded by [symphonia](https://github.com/pdeljanov/Symphonia), a
  third-party decoder written in Rust and compiled into the binary, in the
  app's Rust half rather than in the WebView. No system codec and no browser
  media stack is involved, and a file that will not decode is skipped rather
  than retried. A decoder parsing files is the classic place for this kind of
  software to go wrong, which is why it is named here rather than left for you
  to find.
- **One entry outside the app, and only if you ask.** Turning on *Launch at
  login* writes a registry value under `HKCU\...\Run` on Windows or a
  `.desktop` file in `~/.config/autostart` on Linux, naming the installed
  binary. Turning it off removes it. Nothing else is written outside the app's
  own data directory.

The Tauri capability file, `src-tauri/capabilities/default.json`, is the
complete list of what the frontend is permitted to ask the system for. It is
short on purpose, and it is worth reading if you want to check the above rather
than take it on trust. The file picker is the one entry that reaches outside
the window, as `dialog:allow-open`: permission to show a picker and receive the
path chosen in it, and nothing broader. The reading itself happens in Rust, and
only for the folder that picker returned.

## Not code signed

Releases are not signed. A certificate costs more per year than this project
costs to run, so Windows raises a SmartScreen warning on first run. Every
release publishes `SHA256SUMS.txt` beside the installers, and checking a
download against it is the honest substitute — the README says how.

That also means: a Gloam installer obtained from anywhere other than
[the releases page](https://github.com/damondrc/gloam/releases) is not
something this project can vouch for.

## Supported versions

The latest release. Gloam is one person's project, and pretending to backport
fixes to older versions would be a promise nobody is in a position to keep.

## Reporting something

Use GitHub's **[private vulnerability reporting](https://github.com/damondrc/gloam/security/advisories/new)**
on this repository. It goes to the maintainer without becoming public, which is
what you want for anything that is genuinely a vulnerability.

Please do not open a public issue for one. For anything that is not sensitive —
a crash, a permission that looks wider than it needs to be, a question about
the list above — a normal issue is the right place and is welcome.

Expect an acknowledgement within a week or so. This is not a project with an
on-call rotation, and it is better to say that than to publish a response time
nobody is watching a pager for.
