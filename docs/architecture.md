# How Gloam works

The README says what Gloam does. This says how, and more often why — the
decisions that are not visible in the code because what they ruled out left no
trace.

Most of what follows was in the README until 1.0, where it was the larger half
and the wrong half: someone deciding whether to download a focus timer does not
need to know how click-through is hit-tested, and someone reading the code
wants exactly that and should not have to find it between a download link and a
licence.

## The shape of it

```
src/
  main.ts             places the window, then mounts the app into it
  App.svelte          composition and layout of every visual layer
  app.css             the one rule that makes rem mean a scaled design pixel
  lib/
    plan.ts           the timer's pure logic
    timer.svelte.ts   the reactive state and the countdown
    layout.ts         how big the widget is, before the scale is applied
    dev.ts            what a development build may do and a release may not
    shortcuts.ts      what each key means, and who else claims it
    placement.ts      whether a remembered position is still reachable
    home.ts           where the widget belongs, asked once and used twice
    lock.svelte.ts    click-through and cursor hit-testing
    hitbox.ts         CSS pixels to desktop pixels, for the padlock
    scale.svelte.ts   the scale factor and its drag interaction
    sky.ts            the palette, keyframes and interpolation
    ambience.ts       what each backdrop mode switches off
    horizon.ts        the skyline and the ridge, generated from a seed
    sound.ts          instruments and phrases, all synthesised
    prefs.ts          persisted preferences, validated on the way in
    window.ts         guarded wrappers over the Tauri window API
    autostart.ts      the startup entry, asked for rather than remembered
    tour.ts           the four steps, and what each one points at
    Stars.svelte      fixed star field
    Clouds.svelte     drifting banks
    Birds.svelte      the flock, and when it flies
    birdFrames.ts     its twelve silhouettes, generated
    ShootingStar.svelte  the rarest thing in the widget
    Horizon.svelte    what the bottom of the frame is
    Grain.svelte      generated film grain
    Controls.svelte   transport buttons
    Padlock.svelte    the animated lock
    Grip.svelte       the corner resize handle
    Panel.svelte      the settings panel below the horizon
    Tour.svelte       the card the four steps are read from
    Stepper.svelte    minus/value/plus row
    Cycler.svelte     one-of-a-short-list row
    Toggle.svelte     on/off row
    *.test.ts         beside what they test, seven files
src-tauri/            Rust shell, window configuration, global shortcut
scripts/              version and changelog checks, used by CI
.github/workflows/    checks on every push, a release on every tag
docs/                 this file, the platform checklist, and what is open
```

The division that matters is not by file type. It is that anything which can be
asked a question by a function call has been moved somewhere it can be asked
one, and everything else lives in a component. That boundary is what the test
suite is drawn along, and it is explained at the bottom of this file.

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

## Where the widget lives

The first run has nothing stored, so both of its answers are decisions rather
than recollections: the bottom right of the work area — the screen minus the
taskbar or dock — and 150%. The size it is placed by is the widget *with its
panel unfolded*, because everything grows downward from wherever this puts it,
and on that particular launch what unfolds is the tour, which is the one thing
that has to be readable before anybody has learned anything at all.

Design pixels are multiplied by the user's scale to get logical ones, and by
the monitor's scale factor to get physical ones, which is what a work area is
measured in. Two multiplications, two different meanings of "scale", and mixing
them up would put the widget roughly but never exactly right.

After that the position is remembered. It is written down once the window has
been still for a moment — a drag reports every step of the pointer, and the
places it passed through are not where it was left — and applied again at the
next launch *before* anything has been drawn into the window. That ordering is
the whole trick: the window is transparent and nothing has painted yet, so
there is nothing on screen to see move.

A remembered position is a suggestion rather than an instruction. It is only
good for the arrangement of screens it was recorded on, and unplugging a
monitor is an ordinary thing to do to a laptop, so at startup it is checked
against the screens actually attached: enough of the widget has to fall on one
of them, in both directions, to be seen and grabbed. Both directions on the
*same* screen — a window in the corner between a wide monitor and a tall one
can overlap each of them generously and be visible on neither.

When the check fails nothing happens and the window opens where it always
does. Nudging it to the nearest valid spot was the alternative and is worse: a
corner you can predict beats a position arithmetic chose for you.

`Reset position` from the tray computes the same corner with the same call, so
a rescue and a fresh install cannot end up disagreeing about where Gloam
belongs. It used to centre the window, on the reasoning that a changed monitor
layout is the failure being recovered from and the middle of the display is
always there. True, and beside the point: the middle of the screen is the most
intrusive place on it, and a rescue you then have to undo is half a rescue.

Rust surfaces the window and then emits an event rather than moving it itself.
Where the widget belongs depends on the work area, the current scale and
whether it is folded, and all three are the frontend's to answer — it already
answers them on the first launch. Answering them twice, in two languages, is
how the tray entry and a fresh install would eventually stop agreeing.

## The settings panel

The chevron on the bottom edge unfolds a panel below the horizon. That
placement is deliberate: the sky is the timer, the ground is where the
machinery lives. Controls laid over the gradient would be hard to read and
would break the one idea the backdrop carries.

**Keys** is the odd tab and earned its place by being odd: it is the only one
with nothing to change. Folding a reference table in among controls would have
made it look like a setting and made the controls harder to scan, so it is kept
apart — which is also why it can hold *Show the tour again* without that
reading as a preference either.

The other two were three for a while, with sound and the backdrop apart. They
were apart because they were built at different times, not because anyone
choosing between them thinks of them as different: both answer how much of
itself the widget should make you aware of. Reuniting them left the panel
describing the widget instead of its own history — and the tab that replaced
theirs is the one that is not a setting at all.

Tabs rather than one column, because stacked the sections run past 280 design
pixels — at 180% scale, most of a laptop screen. The tab is navigation rather
than preference, so it is not remembered.

The panel is one height for every tab, sized to the tallest, because a panel
that resized as you moved between tabs would make the window jump under the
pointer that was navigating it. The cost is that the shortest tab carries the
tallest one's height, and it is a constant somebody has to keep in step by eye —
which is why the platform checklist has a row for it.

Durations are steppers rather than number fields. At this size a form input
looks borrowed from another application, and more usefully a stepper cannot
produce an invalid value — there is no empty state and nothing to mistype. They
freeze while the timer runs, so a stray click cannot discard a session; when
the run is paused part-way the panel says that applying a change will restart
it, rather than letting the cost be discovered.

### Launch at login

The one setting Gloam does not store with the others, and deliberately: it does
not belong to Gloam. It is a registry value under `Run` on Windows and a
`.desktop` file in `~/.config/autostart` on Linux, and either can be removed by
Task Manager or a startup applications dialogue while the widget is running. A
remembered copy would eventually be a switch that is confidently wrong, so the
panel asks the platform at launch — and after a change, reads back what
actually happened rather than assuming the write succeeded. A managed machine
that refuses it leaves the switch where it was.

The entry is registered with `--hidden`, and that argument is the only thing
telling one launch from another: somebody double-clicking Gloam wants to see
it, and a session manager is not a person reaching. Unless there is nowhere to
be hidden — on a desktop that could not create a tray the flag is ignored and
the widget opens on screen, because starting hidden with nothing to bring it
back is starting lost.

## Sound

Everything is synthesised. No audio files means nothing to license, nothing to
decode, no binaries in the repository, and a timbre that stays editable as code.

The module splits along one line: an *instrument* decides how a single note
sounds, a *phrase* decides which notes and in what order. That split is why
adding either is a function rather than a redesign.

What the panel offers is a *set*: an instrument, a phrase and a kit of button
sounds, picked together and named for their material. They come together
because the material has to be common — and because separate controls for the
alarm and the buttons are, in practice, a tool for breaking that. Three
settings offering forty-eight combinations is not more choice than three sets;
it is the same choice with the coherent answers hidden among the incoherent
ones. Each set answers one question instead: how it sounds when nobody has
asked for anything, what to reach for when a transition keeps being missed, and
what is left when it should barely register.

Three instruments, three phrases, three kits of buttons, and each set uses
exactly one of each.

Whatever the pattern, the two transitions are always the same material in
opposite directions: rising into focus, falling into a break. Identical notes
make them audibly a pair, opposite direction makes them impossible to confuse,
and direction was chosen over register because it survives being half-heard —
which is the condition these play under. The end of a run is a fuller chord,
marking an ending rather than a change.

Button sounds were first designed around what different speakers can reproduce,
which turned out to be the wrong question — a recommendation mistaken for a
rule. The right one is what this widget sounds like: soft attacks, some warmth,
no digital edges. Every kit keeps the same grammar, so the meaning survives
changing the material — start rises, pause falls, reset is neutral, locking
falls shut and unlocking springs open.

There is no way to silence the buttons alone, deliberately. Feedback you cannot
hear is a button you are not sure you pressed, and muting is what the volume
control is for.

Every gesture fades out whatever is still ringing before it starts. Auditioning
a setting is the reason: you are there to hear the thing you picked, not the
thing you picked over the last two.

## The backdrop

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

*Calm* is about attention. *Light* is about a laptop's battery, so it drops
what actually costs something — blurred surfaces and per-frame animation —
rather than what merely looks busy; the birds are unrendered rather than
hidden, which stops their scheduler too. A fourth mode sat between the two for
a while, with one unblurred cloud bank and nothing else, but blur is what makes
a cloud a cloud, so all it did was leave a shape on the sky. A mode has to be a
coherent thing to want rather than a point on a slider.

The sky, the horizon and the grain are never touched by any of them. They are
the widget's face rather than its ambience.

## The horizon

The horizon chooses what the bottom of the widget *is* — not something standing
on the flat band, but the band itself.

Replacing rather than covering is half of it. A silhouette drawn above the
band with the band still showing underneath reads as two pictures stacked; the
mass has to reach the bottom edge of the frame and have the silhouette for its
top edge, with no line across it, before it reads as one place.

The other half is that all of it — ground and silhouette together — stays
inside the last quarter of the frame. The sky is the clock, so the sky is what
has to dominate; a horizon reaching halfway up is a landscape with a countdown
in it rather than a countdown with a horizon. Everything else is carved out of
that quarter: how tall a tower may be, how much relief a range gets. Compact
keeps whichever horizon was picked, at the same proportion of a shorter frame,
which turns the city into a low profile rather than dropping it.

All three take the same quarter, from one number the widget publishes to the
stylesheet, so switching between them does not move the skyline up and down.
The water band used to be taller than the other two, which made it read as the
heavy option rather than as the plain one.

The shooting star's reflection belongs to the water and goes with it. A streak
crossing the sky is the sky's; the smear it leaves along the surface below is
the surface's, and a glow rising out of a rooftop is a reflection of nothing.
The streak still crosses whichever horizon is up.

The ranges are opaque, and their distance is a colour the sky mixes rather
than a transparency. Fading a far ridge instead is cheaper and looks
plausible until the moon rises behind it — a mountain you can see the moon
through is not a mountain.

The city is the one that does something. It fills in through the sunset, is at
its fullest the moment the sun has gone, and empties again through the break as
the place turns in for the night. The same clock the sky is already keeping,
read a second way, and it costs nothing: two comparisons in the stylesheet
against custom properties the sky publishes anyway. Nothing here animates,
which is why it stays even in **Light**.

An evening has two halves and they are not each other's reverse, so a window
carries a bedtime as well as a switch-on and the two are drawn independently —
the office that lit up first is not the one that goes dark first. An earlier
version had a single number and could only ever get busier, which put the city
at its most awake at the end of a break: exactly backwards.

A window switches rather than fades, at its own brightness — somebody reached
for a lamp. An earlier version eased each one in over a sixth of the run, which
looked less like a city coming on than like a dimmer being turned up on all of
it at once. About a quarter never light at all, one in eight is already on
before the sun is down, and one in six is still burning when the break ends,
because a grid that fills in completely stops being a city and becomes a
spreadsheet, and a city with every light off at dusk is one nobody lives in.
The whole facade is glazed, roof to pavement: lights gathered near the roofs
read as a strip rather than as buildings.

Neither shape is drawn. Both are generated, and each launch draws one from a
short cast of seeds that were rendered and looked at first — so "picked at
random" means one of a handful known to hold together, not whatever comes out.
Whichever it drew stays put for as long as the window is open: switching
horizons and switching back gets the same view. What changes is which city or
which range you find the next time you open Gloam, never the one you are
working in front of. That distinction is the whole of it — what breaks ambience
is not variety, it is something changing while you are looking at it.

## The first run

Gloam introduces itself once. Four steps unfold below the widget — what the sky
is for, that there is no title bar so you drag it from anywhere, how to fold it
small, and how to make it disappear. They are a ladder, and the rungs are how
far out of your way Gloam will get, each one answering the objection the last
might have raised.

Everything described can be done while it is being described, which is why the
tour unfolds *below* the widget rather than over it: a card covering the thing
it is talking about could only describe what the reader had stopped being able
to see. Locking, folding to compact or opening the settings suspends it and
returns to the same step rather than ending it — an instruction you are not
allowed to follow is worse than no instruction. Only `Skip` and the last arrow
finish it.

## What is tested, and what is not

The suite covers the parts where being wrong would be invisible: the plan
builder, the duration formatter, the settings clamp, the timer engine, the
validation applied to stored preferences, the keyboard bindings, whether a
remembered window position is still on a screen, the arithmetic that decides
whether the cursor is over the padlock, and the generated horizons — which are
checked as shapes rather than as coordinates, since there is nothing to compare
a generated skyline against by eye at review time.

A misplaced button is obvious. A seven-session run with six breaks instead of
five is not. Neither is a pause that loses forty milliseconds, a transition
that chimes twice, a hotspot six pixels out on a second monitor, or a
preferences file that quietly stops the widget opening at all.

That boundary is the point rather than a shortcut. The window, the
click-through and the layout are where every bug in this project has actually
lived, and they are also where automated tests are expensive, fragile and need
a real desktop to run against — so what gets tested is what can be asked a
question by a function call.

Some of it had to be moved before it could be asked anything. The key bindings
were a `switch` inside a component and the hit-test was four lines behind two
IPC round trips; both are now plain modules that take values and return an
answer.

The tests assert rules rather than examples, running the same checks across a
spread of configurations, so what they protect is "a plan always alternates and
never ends on a break" rather than "with these numbers it comes out like this".

What no test covers is the window itself — always-on-top, click-through,
resizing, trays, and the different opinions Windows and GTK hold about all
four. Those need a desktop and a person, so they are a written checklist
instead: [platform-testing.md](platform-testing.md). It is run before any
release that changed how the window behaves, and a row nobody ran counts as a
row that failed.

The automated ones are checked the same way anything else is: by breaking the
code on purpose and confirming they notice. That is how the pause tests were
found to be worthless — they paused on a whole number of ticks, where the tick
that had just run already held the right answer, so a pause that captured
nothing still looked correct. Fifty milliseconds off the grid, and they mean
something.

## A note on motion

The eye detects movement in peripheral vision far better than it detects detail
or colour — which is exactly the hazard for an app whose whole purpose is to not
take your attention. Ambient motion here is therefore governed by one rule:
**continuous motion must be too slow to trigger that reflex, and anything fast
must be rare.** Clouds drift slowly enough that you only notice they moved by
comparing two moments. Birds cross once every several minutes, which turns them
from noise into something you catch by chance and enjoy. Scarcity is what makes
them work.

---

Two documents sit beside this one. [platforms.md](platforms.md) is what the
checklist found, and what is claimed on each platform as a result.
[open.md](open.md) is everything the project has said it would come back to, so
that no promise gets quietly dropped.
