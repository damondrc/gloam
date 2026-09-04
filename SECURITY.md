# Security

## What Gloam does not do

Most of a security policy is usually about what an application touches. The
short version here is that Gloam touches almost nothing, and that is a design
decision rather than an accident.

- **No network.** Gloam opens no connections of any kind. There are no
  accounts, no sync, no telemetry, no update check and no analytics. Its
  Content Security Policy is `default-src 'self'`, so the WebView cannot load
  anything remote even if something tried to.
- **No files of yours.** Gloam never opens a file picker and never reads or
  writes anything outside its own storage. Its preferences live in the
  WebView's `localStorage` under a single key, `gloam.prefs.v1`, and everything
  read back out of it is validated before use — corrupt or hand-edited
  preferences produce defaults rather than undefined behaviour.
- **No bundled media.** Every sound is synthesised and every shape is
  generated, so there are no audio or image files to decode and no third-party
  decoder in the path.
- **One entry outside the app, and only if you ask.** Turning on *Launch at
  login* writes a registry value under `HKCU\...\Run` on Windows or a
  `.desktop` file in `~/.config/autostart` on Linux, naming the installed
  binary. Turning it off removes it. Nothing else is written outside the app's
  own data directory.

The Tauri capability file, `src-tauri/capabilities/default.json`, is the
complete list of what the frontend is permitted to ask the system for. It is
short on purpose, and it is worth reading if you want to check the above rather
than take it on trust.

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
