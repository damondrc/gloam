<script lang="ts">
  import { Timer } from "./lib/timer.svelte";
  import { LockController } from "./lib/lock.svelte";
  import { MAX_SCALE, MIN_SCALE, SCALE_STEP, ScaleController } from "./lib/scale.svelte";
  import { skyFor, skyVars } from "./lib/sky";
  import * as sound from "./lib/sound";
  import * as music from "./lib/music";
  import {
    dismissWindow,
    hasTray,
    onBackendEvent,
    onWindowMoved,
    setWindowSize,
    startDragging,
  } from "./lib/window";
  import { loadPrefs, savePrefs } from "./lib/prefs";
  import { resolveShortcut } from "./lib/shortcuts";
  import type { Action } from "./lib/shortcuts";
  import { ambienceSettings } from "./lib/ambience";
  import Horizon from "./lib/Horizon.svelte";
  import { HORIZON_SHARE } from "./lib/horizon";
  import { launchesAtLogin, setLaunchAtLogin } from "./lib/autostart";
  import { goHome } from "./lib/home";
  import Stars from "./lib/Stars.svelte";
  import Clouds from "./lib/Clouds.svelte";
  import Birds from "./lib/Birds.svelte";
  import ShootingStar from "./lib/ShootingStar.svelte";
  import Grain from "./lib/Grain.svelte";
  import Controls from "./lib/Controls.svelte";
  import Padlock from "./lib/Padlock.svelte";
  import MusicBar from "./lib/MusicBar.svelte";
  import Grip from "./lib/Grip.svelte";
  import Panel from "./lib/Panel.svelte";
  import Tour from "./lib/Tour.svelte";
  import { TOUR } from "./lib/tour";
  import {
    COMPACT_SIZE,
    NORMAL_SIZE,
    PANEL_HEIGHT,
    TOUR_HEIGHT,
  } from "./lib/layout";

  const timer = new Timer();
  const lock = new LockController();
  const scale = new ScaleController();

  // Named for the segment that is starting rather than the one that ended.
  // They are the same instant, but "a break is beginning" is what the listener
  // needs to act on, and it keeps the sound vocabulary and the phrase names
  // describing the same thing.
  timer.onSegmentEnd = (_done, next) => {
    if (!next) {
      sound.runComplete();
      endMusicWithRun();
    } else if (next.phase === "focus") sound.enterFocus();
    else sound.enterBreak();
  };

  // Asked once. What the close button does depends on it, and the button has
  // to say which of the two it is going to do before it is pressed rather
  // than after.
  let tray = $state(false);
  void hasTray().then((present) => (tray = present));

  /**
   * Whether Gloam is in the session's startup list — asked, never remembered.
   *
   * It is the one setting that lives outside `gloam.prefs.v1`, because it
   * lives outside Gloam: it is a registry value or a file in an autostart
   * directory, and it can be removed by Task Manager or a startup applications
   * dialogue while the widget is running. Storing our own copy would mean
   * showing a switch that is confidently wrong.
   *
   * Read once at launch rather than every time the panel opens, which is the
   * compromise: a change made from outside during a single run is rare enough
   * to live with, and polling for it would be a background task in an app that
   * has no others.
   */
  let atLogin = $state(false);
  let atLoginKnown = $state(false);
  void launchesAtLogin().then((value) => {
    atLogin = value;
    atLoginKnown = true;
  });

  /**
   * Trusts what the platform reports afterwards rather than what was asked
   * for. Writing to a registry or a config directory is exactly the kind of
   * thing a managed machine declines, and a switch that flips itself on when
   * nothing happened is a lie told in the one place the user goes to check.
   */
  async function setAtLogin(value: boolean): Promise<void> {
    atLoginKnown = false;
    atLogin = await setLaunchAtLogin(value);
    atLoginKnown = true;
  }

  const stored = loadPrefs();
  let compact = $state(stored.compact);
  let hovering = $state(false);
  let panelOpen = $state(false);
  let volume = $state(stored.volume);
  let soundSet = $state(stored.sound);
  let ambience = $state(stored.ambience);
  let horizon = $state(stored.horizon);

  // The folder as a preference, and the queue as whatever Rust made of it.
  // Kept apart because they can disagree: a path that was good last week can
  // name a folder that is gone, and the honest thing to show then is the
  // folder somebody chose alongside a count of nothing, rather than quietly
  // forgetting the choice.
  let musicFolder = $state(stored.music.folder);
  let musicVolume = $state(stored.music.volume);
  let musicShuffle = $state(stored.music.shuffle);
  let musicCrossfade = $state(stored.music.crossfade);

  $effect(() => {
    void music.setShuffle(musicShuffle);
  });

  $effect(() => {
    void music.setCrossfade(musicCrossfade);
  });

  // The whole snapshot rather than the parts of it this file happens to need
  // today. Rust owns what is playing and says so on one event; keeping a field
  // here per question would be several copies to hold in agreement, and they
  // would first disagree the moment a track ended while nobody was watching.
  let player = $state<music.MusicState>(music.EMPTY);

  /**
   * Whether the music is paused because the timer was, rather than because
   * somebody paused the music.
   *
   * The music follows the person's own interruptions. Pausing the timer is
   * stepping out of the session, and the music steps out with it; resuming
   * brings it back. But only music the timer took away — pause the album by
   * hand, then pause and resume the run, and the album stays where you left
   * it. Without this one flag the timer would be overruling the other button.
   *
   * Breaks and skips do not touch it. A break is part of a session, not an
   * interruption of one, and starting the timer never starts music nobody
   * started. Plain `let`: nothing on screen depends on it.
   */
  let heldByTimer = false;

  function holdMusic(): void {
    if (!player.playing) return;
    heldByTimer = true;
    void music.pause();
  }

  function releaseMusic(): void {
    if (!heldByTimer) return;
    heldByTimer = false;
    void music.play();
  }

  /**
   * The run is over, and so is the soundtrack to it.
   *
   * The alarm ducks the music as every phrase does; this changes how that duck
   * ends, fading to nothing rather than back up, and leaves the player paused
   * where it was. Carrying on is a decision for whoever is sitting there, and
   * it is one button away — the same one that would carry on anywhere else.
   */
  function endMusicWithRun(): void {
    heldByTimer = false;
    void music.finish();
  }

  /** Touching the music directly takes it back from the timer. */
  function byHand(act: () => Promise<void>): void {
    heldByTimer = false;
    void act();
  }

  // Every route to a different track ends in Rust announcing the new one — a
  // button, a folder being opened, or a file simply running out. Subscribing
  // is how the last of those three gets here at all.
  $effect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;

    void music.onTrack((state) => (player = state)).then((fn) => {
      if (cancelled) fn();
      else stop = fn;
    });

    return () => {
      cancelled = true;
      stop?.();
    };
  });

  $effect(() => {
    void music.setVolume(musicVolume);
  });

  // Gloam speaking is the one thing allowed to interrupt the music, and it
  // interrupts by leaning on it rather than by stopping it. Wired here rather
  // than inside sound.ts, because what should happen to other sound while the
  // widget talks is a question about the app: synthesis has no opinion about
  // whether there is an album underneath. Buttons never reach this — a tick
  // that ducked on every click would make both unbearable.
  $effect(() => {
    sound.onSpeak((seconds) => void music.duck(seconds));
    return () => sound.onSpeak(null);
  });

  // Reopened once, so the queue is ready and the panel can say how much is in
  // it. Nothing starts playing: a widget that begins the day with music
  // nobody asked for is a widget that gets closed.
  $effect(() => {
    if (!musicFolder) return;
    let cancelled = false;

    void music.openFolder(musicFolder).then((state) => {
      if (!cancelled) player = state;
    });

    return () => {
      cancelled = true;
    };
  });

  /**
   * Opens the picker, and writes the answer down only if there was one.
   *
   * Cancelling leaves everything alone — including a folder chosen earlier,
   * which is the whole reason this does not clear anything before asking.
   */
  async function chooseMusicFolder(): Promise<void> {
    const picked = await music.pickFolder();
    if (!picked) return;

    musicFolder = picked;
    player = await music.openFolder(picked);
  }
  let position = $state(stored.position);

  const backdrop = $derived(ambienceSettings(ambience));

  $effect(() => {
    sound.setVolume(volume);
  });

  $effect(() => {
    sound.setSoundSet(soundSet);
  });

  /** How long the escape-hatch hint stays up after locking. */
  const HINT_MS = 4500;

  let showLockHint = $state(false);

  // Null when the tour is not running; otherwise which step is up. Starts on
  // the first step for anyone who has never seen it, and can be started again
  // from the panel by anyone who has.
  let seenIntro = $state(stored.seenIntro);
  let tourStep = $state<number | null>(stored.seenIntro ? null : 0);
  let tourFolded = $state(false);

  // Suspended rather than ended, three ways over: locked, folded by the
  // chevron, or folded into compact — where at 180 pixels wide the text would
  // run to ten lines. All three are things the tour itself invites you to try,
  // and an instruction you are not allowed to follow is worse than none. So
  // it waits and picks up on the same step, and only Skip and the last arrow
  // actually end it.
  const tourOpen = $derived(
    tourStep !== null && !lock.locked && !tourFolded && !compact
  );
  const spotlight = $derived(
    tourOpen && tourStep !== null ? TOUR[tourStep].spotlight : "none"
  );

  function startTour(): void {
    panelOpen = false;
    tourFolded = false;
    tourStep = 0;
  }

  // Marked as seen only when the tour is dismissed, so quitting half way
  // through does not spend the one time it offers itself.
  function endTour(): void {
    tourStep = null;
    tourFolded = false;
    seenIntro = true;
  }

  // Locking is a request for the widget to stop being in the way, and a panel
  // standing open is the least out-of-the-way it ever is: it is the one part
  // of the widget that is opaque, so while everything else recedes to 44% the
  // settings sit there at full strength looking like the only thing on screen.
  // Entering compact mode already closes it, for the same reason.
  $effect(() => {
    if (lock.locked) panelOpen = false;
  });

  // Locking hides the close button and stops the window accepting clicks
  // anywhere but the padlock, so the way out has to be stated rather than
  // discovered. Shown on every lock, not just the first: it costs nothing to
  // repeat and being stranded costs a lot.
  $effect(() => {
    if (!lock.locked) {
      showLockHint = false;
      return;
    }
    showLockHint = true;
    const timer = setTimeout(() => (showLockHint = false), HINT_MS);
    return () => clearTimeout(timer);
  });

  scale.set(stored.scale);
  timer.applyConfig(stored.config);

  const sky = $derived(skyFor(timer.phase, timer.progress, timer.finished));
  const baseSize = $derived(compact ? COMPACT_SIZE : NORMAL_SIZE);

  /** How much of the sun's light on the water the moon gives back. */
  const MOONLIGHT = 0.34;

  /**
   * The sun's reflection in the water — or the moon's, which is the same
   * element in a different colour.
   *
   * Light hanging from the waterline directly under the body, brightest
   * where it meets the line and dissolving downward. It strengthens as the
   * body comes down toward the water, because a low sun reflects hardest, and
   * it is gone once the body has gone under — nothing left above the line
   * means nothing to mirror.
   *
   * The first version placed a mirrored disc half the body's height below
   * the line, which is geometrically right and looked wrong on screen: a
   * dark gap between horizon and reflection made it read as an object
   * floating under the water rather than as light on top of it. A reflection
   * seen from a shore starts at the waterline, so this one does too.
   *
   * The moon gets the same light at a third of the strength, because it has
   * a fraction of the sun's to give. It matters more than it sounds: the moon
   * opens every break already low over the water, so without the difference
   * the brightest reflection in the widget would arrive at the start of the
   * one segment meant to be dimmer. It fades as the moon climbs, the same way
   * the sun's grows as it sinks.
   *
   * Short and diffuse rather than a column. The longer shapes read as a
   * feature of the scene; this reads as light, which is all it should be.
   * Worked out here rather than in CSS because it needs the waterline and
   * the body's radius together, and a calc() holding both would be harder to
   * read than the arithmetic it replaced.
   */
  const reflection = $derived.by(() => {
    const clamp = (x: number): number => Math.min(1, Math.max(0, x));
    // The body is the moon for the whole of a break and after the run, which
    // is exactly how skyFor chooses between the two.
    const light = timer.finished || timer.phase === "break" ? MOONLIGHT : 1;
    const stage = baseSize.height;
    // Compact draws the sun smaller; see `.frame.compact .celestial`.
    const r = sky.bodyR * (compact ? 0.72 : 1);
    const above = (1 - HORIZON_SHARE) * stage - sky.bodyY * stage;
    const d = above / r;

    const strength = clamp((d + 1) / 0.9) * (0.5 + 0.5 * clamp((3.4 - d) / 2.4));
    const width = r * 2.6;
    const height = r * 1.6;
    // A touch above the line, so the brightest part is under the lip rather
    // than starting a pixel below it; the water's own clip takes the rest.
    const top = -r * 0.15;

    // The waterline's own light, peaking as the body touches the water.
    // Without it the sun's glow ends in a hard edge against the sea, now that
    // the sea is opaque — the halo is drawn in the sky, and the sky stops at
    // the water. This is what sews the two together.
    const touch = clamp(1 - Math.abs(d - 0.2) / 2.6);

    return {
      width,
      height,
      top,
      strength: strength * 0.6 * light,
      touch: touch * light,
      lip: r * (3.4 + 1.2 * touch),  // size follows position, not brightness
      lipHeight: r * 0.34,
      bloom: r * 4.2,
    };
  });

  /** The stage is the timer; the panel grows the window beneath it. */
  const stageHeight = $derived(baseSize.height);
  const panelHeight = $derived(
    tourOpen ? TOUR_HEIGHT : panelOpen ? PANEL_HEIGHT : 0
  );
  const frameHeight = $derived(baseSize.height + panelHeight);

  // The layout's own dimensions travel to CSS as custom properties so the
  // numbers live in one place. Because 1rem is one scaled design pixel, the
  // frame written as `calc(var(--frame-w) * 1rem)` is exactly the size the
  // window is being asked for — without CSS having to know the constants.
  const vars = $derived(
    [
      skyVars(sky),
      // Distant detail is damped rather than scaled one to one: enlarging the
      // widget should reveal more sky, not bigger birds. A square root is a
      // middle ground — at 180% the widget grows by four fifths and the flock
      // by a third.
      `--ambient: ${Math.sqrt(scale.value).toFixed(3)}`,
      `--frame-w: ${baseSize.width}`,
      `--frame-h: ${frameHeight}`,
      `--stage-h: ${stageHeight}`,
      // How much of the frame the horizon gets, whichever one is picked. The
      // water band, the silhouettes and the reflection all read it, so the
      // three cannot drift out of tune with one another — and a proportion
      // rather than a length is what carries all of it into compact.
      `--horizon: ${(HORIZON_SHARE * 100).toFixed(3)}%`,
    ].join("; ")
  );

  // One number drives every size in the stylesheet; see app.css.
  $effect(() => {
    document.documentElement.style.setProperty("--scale", String(scale.value));
  });

  // While the grip is being dragged the window is parked at the largest size
  // the drag could reach and then left alone. Resizing an undecorated,
  // transparent window at pointer-move rate makes its edges shimmer: the
  // compositor resizes the surface on a different beat from the WebView's
  // repaint, so for a frame the surface is already its new size while the
  // content is still the old one. No amount of CSS fixes that, because it
  // happens underneath CSS.
  //
  // The widget is sized in CSS, so it still follows the drag exactly. Only its
  // container stops moving, and the surplus is transparent. Reading dragging
  // first also means scale.value is not a dependency mid-drag, so the effect
  // fires twice per resize instead of once per pointer event.
  $effect(() => {
    const factor = scale.dragging ? MAX_SCALE : scale.value;
    void setWindowSize(
      Math.round(baseSize.width * factor),
      Math.round(frameHeight * factor)
    );
  });

  // Reading `dragging` first, and bailing out on it, is the same trick the
  // resize effect above uses: while the grip is held, scale.value is never
  // read, so it is not a dependency and this does not re-run per pointer
  // event. Serialising the whole preference object into storage at that rate
  // is work nobody asked for, and the intermediate values are not worth
  // keeping — the effect re-runs the moment the drag ends, which is when the
  // one that is worth keeping exists.
  $effect(() => {
    if (scale.dragging) return;

    savePrefs({
      compact,
      scale: scale.value,
      volume,
      sound: soundSet,
      ambience,
      horizon,
      config: timer.config,
      music: {
        folder: musicFolder,
        volume: musicVolume,
        shuffle: musicShuffle,
        crossfade: musicCrossfade,
      },
      position,
      seenIntro,
    });
  });

  /** How still the window has to be before its position is worth writing down. */
  const MOVE_SETTLE_MS = 400;

  // A drag emits a move event per step of the pointer, and the intermediate
  // positions are not places the widget was left — they are places it passed
  // through. Only where it comes to rest is worth keeping, so the state is
  // committed once the moving stops, and the same debounce covers the tray's
  // `Reset position` for free.
  $effect(() => {
    let dispose: (() => void) | null = null;
    let settle: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    void onWindowMoved((next) => {
      if (settle !== null) clearTimeout(settle);
      settle = setTimeout(() => (position = next), MOVE_SETTLE_MS);
    }).then((fn) => {
      if (cancelled) fn();
      else dispose = fn;
    });

    return () => {
      cancelled = true;
      if (settle !== null) clearTimeout(settle);
      dispose?.();
    };
  });

  // No reactive reads, so this registers cleanup once and never re-runs.
  $effect(() => () => lock.destroy());

  // A minimised window has its timers throttled, so the tick that should have
  // ended a segment can arrive a minute late. The engine straightens itself
  // out whenever it does arrive; this only means the widget is already right
  // when you look at it, rather than a moment afterwards.
  $effect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") timer.catchUp();
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  });

  /**
   * The two ways in from outside the window.
   *
   * The shortcut is the way back if hit-testing the padlock ever fails. The
   * other is the tray asking for the widget to be fetched home — Rust surfaces
   * it and says so, and the answer to *where* is computed here, because it
   * depends on the work area, the current scale and whether the widget is
   * folded. The same call the very first launch makes, so a rescue and a fresh
   * install cannot end up disagreeing about where Gloam lives.
   */
  $effect(() => {
    let dispose: (() => void)[] = [];
    let cancelled = false;

    const subscribe = (name: string, handler: () => void): void => {
      void onBackendEvent(name, handler).then((fn) => {
        if (cancelled) fn();
        else dispose.push(fn);
      });
    };

    subscribe("gloam://toggle-lock", () => toggleLock());
    subscribe("gloam://recover", () => void goHome(scale.value, compact));

    return () => {
      cancelled = true;
      for (const fn of dispose) fn();
    };
  });

  function toggleTimer(): void {
    // The first click doubles as the user gesture that unlocks WebAudio, so the
    // end-of-segment sounds are guaranteed to be audible later.
    sound.unlockAudio();
    const pausing = timer.running;
    sound.press(pausing ? "pause" : "start");
    timer.toggle();
    if (pausing) holdMusic();
    else releaseMusic();
  }

  // Manual actions get the faint interface tick, never a transition phrase.
  // The phrases mean "the timer moved on by itself"; when you moved it, you
  // already know.
  function resetTimer(): void {
    sound.press("reset");
    timer.reset();
    // An interruption like pausing, and undone the same way: starting again.
    holdMusic();
  }

  function skipSegment(): void {
    sound.press("reset");
    timer.skip();
  }

  // Every route into lock mode goes through here — the padlock, the L key and
  // the global shortcut — so the feedback cannot depend on which one was used.
  function toggleLock(): void {
    sound.unlockAudio();
    sound.press(lock.locked ? "unlock" : "lock");
    lock.toggle();
  }

  function onDoubleClick(): void {
    if (lock.locked) return;
    // Compact has no room for the panel, so entering it closes what is open
    // rather than leaving a panel attached to a strip.
    if (!compact) panelOpen = false;
    compact = !compact;
  }

  function togglePanel(): void {
    if (lock.locked || compact) return;
    sound.press("reset");

    // The chevron means "fold what is below away, and bring it back", and
    // during the tour what is below is the tour. So it folds the tour rather
    // than opening the settings underneath it — the gesture gets demonstrated
    // on the thing that is actually there, and the introduction survives
    // being experimented with, which is the entire point of a step that
    // invites you to press something.
    if (tourStep !== null) {
      tourFolded = !tourFolded;
      return;
    }

    panelOpen = !panelOpen;
  }

  function onDragStart(event: MouseEvent): void {
    // Only a plain first press with the primary button starts a drag. Bailing
    // out on detail >= 2 leaves the second press of a double-click alone, so
    // the compact toggle is not competing with a drag.
    if (event.button !== 0 || event.detail >= 2) return;
    void startDragging();
  }

  /**
   * Elements the spacebar activates, and which therefore own it.
   *
   * Answering this needs the DOM, which is why it is here and the rules are in
   * shortcuts.ts.
   */
  const SPACE_CLAIMS = "button, input, select, textarea, a[href], summary";

  /**
   * `:focus-visible` is the browser's own answer to "did the user arrive here
   * with the keyboard", and it is already what decides whether a focus ring is
   * drawn. Reusing it here means a button only claims the space bar while the
   * user is actually driving with the keyboard: click the padlock and the
   * focus stays on it, but it is residue rather than intent, and space goes
   * back to meaning start.
   */
  function ownsSpace(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    const control = target.closest(SPACE_CLAIMS);
    return control !== null && control.matches(":focus-visible");
  }

  /**
   * What each intention does. Naming them apart from the keys that trigger
   * them is what lets the bindings be a table rather than a control flow, and
   * the table be checked without a browser.
   */
  const ACTIONS: Record<Action, () => void> = {
    toggleTimer,
    toggleCompact: onDoubleClick,
    togglePanel,
    scaleUp: () => scale.nudge(SCALE_STEP),
    scaleDown: () => scale.nudge(-SCALE_STEP),
  };

  function onKeydown(event: KeyboardEvent): void {
    if (event.repeat) return;

    const shortcut = resolveShortcut(event.key, {
      ownsSpace: ownsSpace(event.target),
    });
    if (!shortcut) return;

    if (shortcut.preventDefault) event.preventDefault();
    ACTIONS[shortcut.action]();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<main
  class="frame"
  class:locked={lock.locked}
  class:compact
  class:hovering
  class:open={panelOpen || tourOpen}
  class:spot-controls={spotlight === "controls"}
  class:spot-away={spotlight === "away"}
  style={vars}
  onmouseenter={() => (hovering = true)}
  onmouseleave={() => (hovering = false)}
>
  <div class="widget">
   <div class="stage">
    <!-- Everything that should recede when the widget is locked lives in here,
         so the padlock can stay at full strength outside it. -->
    <div class="canvas">
      <div class="sky"></div>

      <Stars visible={sky.stars} twinkle={backdrop.twinkle} />

      <div class="celestial"></div>

      <!-- After the sun, so a bank crossing it dims it. -->
      <Clouds
        visible={sky.clouds}
        banks={backdrop.cloudBanks}
        blur={backdrop.cloudBlur}
      />

      <!-- Not rendered rather than hidden: that stops the scheduler and the
           twelve animations each bird carries, which is the point of the
           lighter modes. -->
      {#if backdrop.birds}
        <Birds visible={sky.birds} />
      {/if}

      {#if backdrop.haze}
        <div class="haze haze-a"></div>
        <div class="haze haze-b"></div>
      {/if}

      <!-- Water. The other horizons are not drawn on top of this: they take
           its place, so the bottom of the frame is one mass with a silhouette
           for a top edge rather than a band with something standing on it. -->
      {#if horizon === "water"}
        <!-- Outside the water, because it is light in the sky: anchored to
             the waterline from below and fading upward into the halo. -->
        {#if reflection.touch > 0.005}
          <i
            class="bloom"
            style="width: {reflection.bloom.toFixed(2)}rem; --touch: {reflection.touch.toFixed(3)};"
          ></i>
        {/if}
        <div class="ground">
          {#if reflection.touch > 0.005}
            <i
              class="lip"
              style="width: {reflection.lip.toFixed(2)}rem; height: {reflection.lipHeight.toFixed(2)}rem; --touch: {reflection.touch.toFixed(3)};"
            ></i>
          {/if}
          {#if reflection.strength > 0.005}
            <i
              class="reflection"
              style="
                width: {reflection.width.toFixed(2)}rem;
                height: {reflection.height.toFixed(2)}rem;
                top: {reflection.top.toFixed(2)}rem;
                --strength: {reflection.strength.toFixed(3)};
              "
            ></i>
          {/if}
        </div>
      {/if}

      <!-- After the ground, because its reflection has to land on the water
           rather than behind it, and before the grain so it shares the same
           texture as everything else. Compact has fifty pixels of sky and no
           water to speak of, so it does not fall there. -->
      {#if backdrop.meteor && !compact}
        <ShootingStar
          night={sky.stars}
          width={baseSize.width}
          height={baseSize.height}
          water={horizon === "water" ? HORIZON_SHARE : 0}
        />
      {/if}

      <!-- Last of the backdrop, which is how the occlusion comes out right for
           free: where a city or a ridge has replaced the water there is
           nothing left for a reflection to fall into, and drawing the mass
           over it hides the glint while leaving the streak climbing out from
           behind the skyline.

           In compact too. It is sized as a proportion of the frame, so it
           follows the widget down to a low profile rather than being dropped —
           a setting that silently stops applying in one of the two modes is
           worse than one that was never offered. -->
      <Horizon kind={horizon} />

      <Grain />

      <div class="progress">
        <i style="transform: scaleX({timer.progress})"></i>
      </div>
    </div>

    <div class="content">
      <span class="label">{timer.label}</span>

      <span class="time" class:idle={!timer.running && !timer.finished}>
        {timer.display}
      </span>

      <div class="dots" aria-label="Session {timer.focusIndex} of {timer.config.focusSessions}">
        {#each { length: timer.config.focusSessions } as _, i (i)}
          <i class:filled={i < timer.focusIndex}></i>
        {/each}
      </div>
    </div>

    <!-- Only while a step is pointing at something. The first two steps
         describe the sky and the widget as a whole, and darkening the sky
         while explaining the sky would work against the sentence. -->
    {#if spotlight !== "none"}
      <div class="shade"></div>
    {/if}

    <!-- Transparent layer that makes the whole widget a window drag handle.
         Tauri only starts a drag when the event target itself carries the
         attribute, so interactive elements must sit above this. -->
    <!-- Dragging and the compact toggle both live here rather than on the
         frame, so they only fire on the widget's background: buttons and the
         grip sit in layers above this one.

         The drag is started by hand instead of with data-tauri-drag-region,
         which additionally implements "double-click a title bar to maximise"
         and would fight the compact toggle for the same gesture. -->
    {#if !lock.locked}
      <div
        class="drag"
        role="button"
        tabindex="-1"
        aria-label="Widget background. Drag to move, double-click to toggle compact mode."
        onmousedown={onDragStart}
        ondblclick={onDoubleClick}
      ></div>
    {/if}

    <!-- With the panel out the widget is in use, so the controls stay up even
         if the pointer wanders off. -->
    <!-- Held up for the length of the tour, so the step describing the
         chevron and the corner has something to point at. -->
    <div
      class="ui"
      class:show={(hovering || panelOpen || tourOpen) && !lock.locked}
    >
      <!-- Says which of the two things it is about to do. With a tray the run
           keeps going and the icon is the way back; without one there is
           nothing to hide into, so it quits. -->
      <button
        class="close"
        onclick={dismissWindow}
        title={tray ? "Hide — Gloam keeps running in the tray" : "Quit Gloam"}
        aria-label={tray ? "Hide" : "Quit"}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M4.4 4.4 11.6 11.6M11.6 4.4 4.4 11.6"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          />
        </svg>
      </button>

      <!-- Only once there is something to play. An empty transport is three
           buttons that do nothing and a blank where a name should be, which is
           furniture rather than an interface. Not in compact either: the strip
           it lives in does not exist there. -->
      {#if !compact && player.count > 0}
        <MusicBar
          name={player.name}
          playing={player.playing}
          onPrevious={() => byHand(music.previous)}
          onToggle={() => byHand(player.playing ? music.pause : music.play)}
          onNext={() => byHand(music.next)}
        />
      {/if}

      <div class="dock">
        <Controls
          running={timer.running}
          finished={timer.finished}
          onToggle={toggleTimer}
          onReset={resetTimer}
          onSkip={skipSegment}
          {compact}
        />
      </div>

      {#if !compact}
        <Grip
          value={scale.value}
          min={MIN_SCALE}
          max={MAX_SCALE}
          dragging={scale.dragging}
          onBegin={(event) => scale.begin(event, baseSize.width, baseSize.height)}
          onMove={(event) => scale.move(event)}
          onEnd={(event) => scale.end(event)}
          onNudge={(delta) => scale.nudge(delta)}
          onReset={() => scale.reset()}
        />

        <button
          class="disclose"
          onclick={togglePanel}
          title={panelOpen ? "Close settings" : "Open settings"}
          aria-label={panelOpen ? "Close settings" : "Open settings"}
          aria-expanded={panelOpen}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M3.6 6.4 8 10.4l4.4-4"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      {/if}
    </div>

    {#if showLockHint}
      <div class="hint">Ctrl<span>+</span>Alt<span>+</span>G to unlock</div>
    {/if}

    <!-- Outside .ui: the padlock has to stay reachable when everything else
         has faded out and stopped accepting clicks. -->
    <div class="lock-slot" class:show={hovering || lock.locked || tourOpen}>
      <Padlock
        locked={lock.locked}
        hot={lock.hot}
        onToggle={toggleLock}
        register={(el) => lock.attach(el)}
        small={compact}
      />
    </div>
   </div>

   {#if tourOpen && tourStep !== null}
     <Tour
       step={tourStep}
       onStep={(next) => (tourStep = next)}
       onDone={endTour}
     />
   {:else if panelOpen}
     <Panel
       config={timer.config}
       onConfig={(next) => timer.applyConfig(next)}
       frozen={timer.running}
       willReset={!timer.atStart}
       {volume}
       onVolume={(next) => (volume = next)}
       sound={soundSet}
       onSound={(next) => {
         soundSet = next;
         // Judge it the moment you choose it, rather than at the end of the
         // next session. Applied by hand rather than waiting for the effect,
         // because the preview has to be played on the set just picked.
         sound.setSoundSet(next);
         sound.preview();
       }}
       {ambience}
       onAmbience={(next) => (ambience = next)}
       {horizon}
       onHorizon={(next) => (horizon = next)}
       {atLogin}
       {atLoginKnown}
       {tray}
       onAtLogin={setAtLogin}
       {musicFolder}
       musicCount={player.count}
       onPickFolder={chooseMusicFolder}
       {musicVolume}
       onMusicVolume={(next) => (musicVolume = next)}
       shuffle={musicShuffle}
       onShuffle={(next) => (musicShuffle = next)}
       crossfade={musicCrossfade}
       onCrossfade={(next) => (musicCrossfade = next)}
       onTour={startTour}
     />
   {/if}
  </div>
</main>

<style>
  /* Sizes are in rem, where 1rem is one design pixel at the current scale.
     See the note in app.css. */

  /* The frame carries its own dimensions rather than stretching to fill the
     window. That decouples the two: the widget is always drawn at exactly the
     size it means to be, whether the window around it is momentarily larger
     because a drag is in progress, or a few pixels off because the window
     manager rounded the request its own way. */
  .frame {
    position: absolute;
    top: 0;
    left: 0;
    width: calc(var(--frame-w) * 1rem);
    height: calc(var(--frame-h) * 1rem);
  }

  /* Two stacked zones: the stage holds the timer and its sky, the panel grows
     beneath it. The stage keeps a fixed height so opening the panel adds space
     rather than squeezing the clock. */
  .widget {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    border-radius: var(--radius);
    overflow: hidden;
    border: 1px solid rgb(255 255 255 / 0.1);
    transition: border-color 0.45s ease;
  }

  .stage {
    position: relative;
    flex: 0 0 calc(var(--stage-h) * 1rem);
  }

  .canvas {
    position: absolute;
    inset: 0;
    /* The horizon band and the progress bar sit flush against the bottom edge,
       and the haze layers overflow the frame by design. All of them get their
       own compositing layer because of the blend modes above, and WebKitGTK
       does not reliably clip composited layers to a rounded overflow
       container — which left the bottom corners square on Linux while Windows
       looked correct. An explicit clip-path is honoured by both.

       It lives here rather than on .widget so it cannot clip the drop shadow,
       which is painted outside the border box. */
    border-radius: var(--radius);
    overflow: hidden;
    clip-path: inset(0 round var(--radius));
    isolation: isolate;
    transition: opacity 0.45s ease;
  }

  /* With the panel out, the bottom corners belong to the panel instead. */
  .frame.open .canvas {
    border-radius: var(--radius) var(--radius) 0 0;
    clip-path: inset(0 round var(--radius) var(--radius) 0 0);
  }

  /* Locked: recede so the document underneath stays readable through it. */
  .frame.locked .canvas {
    opacity: 0.44;
  }

  .frame.locked .widget {
    border-color: rgb(255 255 255 / 0.05);
  }

  .frame.locked .content {
    opacity: 0.44;
    transition: opacity 0.45s ease;
  }

  /* --- backdrop layers ------------------------------------------------ */

  .sky {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      rgb(var(--sky-top)) 0%,
      rgb(var(--sky-mid)) 54%,
      rgb(var(--sky-bottom)) 100%
    );
  }

  /* The sun during focus, the moon during a break. Its vertical position is
     the progress indicator: light draining out of the frame reads as time
     running out, and it reverses during breaks. */
  .celestial {
    position: absolute;
    left: 75%;
    top: var(--body-y);
    width: calc(var(--body-r) * 2);
    height: calc(var(--body-r) * 2);
    margin-left: calc(var(--body-r) * -1);
    margin-top: calc(var(--body-r) * -1);
    border-radius: 50%;
    background: rgb(var(--body));
    box-shadow:
      0 0 calc(var(--body-r) * 1.4) rgb(var(--body) / calc(var(--glow) * 0.85)),
      0 0 calc(var(--body-r) * 3.6) rgb(var(--body) / calc(var(--glow) * 0.42)),
      0 0 calc(var(--body-r) * 7) rgb(var(--body) / calc(var(--glow) * 0.18));
    transition:
      top 0.2s linear,
      width 0.4s linear,
      height 0.4s linear,
      opacity 0.22s ease;
  }

  /* Slow drifting atmosphere. Long, mismatched durations keep the two layers
     from ever visibly looping together. */
  .haze {
    position: absolute;
    inset: -35%;
    pointer-events: none;
    mix-blend-mode: screen;
    will-change: transform;
  }

  .haze-a {
    background: radial-gradient(
      ellipse 44% 24% at 32% 56%,
      rgb(var(--body) / 0.42),
      transparent 70%
    );
    animation: drift-a 53s ease-in-out infinite alternate;
  }

  .haze-b {
    background: radial-gradient(
      ellipse 36% 18% at 68% 40%,
      rgb(var(--accent) / 0.34),
      transparent 72%
    );
    animation: drift-b 79s ease-in-out infinite alternate;
  }

  @keyframes drift-a {
    from {
      transform: translate3d(-5%, 1.5%, 0) scale(1);
    }
    to {
      transform: translate3d(7%, -2.5%, 0) scale(1.14);
    }
  }

  @keyframes drift-b {
    from {
      transform: translate3d(6%, -1%, 0) scale(1.1);
    }
    to {
      transform: translate3d(-6%, 2%, 0) scale(1);
    }
  }

  /* The horizon the sun sets behind, when the horizon is water.
     Its height is `--horizon`, the same share of the frame the silhouettes
     take, so switching between the three does not move the skyline up and
     down. It used to be 30% against their 25%, which made water read as the
     heavy one. Compact needs no rule of its own for the same reason. */
  .ground {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: var(--horizon);
    overflow: hidden;
    /* Opaque from the waterline down. It used to start at 72% and let the
       sky show through the top of the sea, which also let the sun show
       through it: a sun that sets into water and stays visible under the
       surface is not setting. The ridge learnt the same lesson first —
       a mountain you can see the moon through is not a mountain.

       The sky still tints the top of the water, which is what the
       transparency had been for. It is mixed in rather than shown through:
       --ground-mid is the ground already carried a quarter of the way toward
       the sky's own colour, so the band keeps its lighter lip without being
       a window onto whatever is behind it. */
    background: linear-gradient(
      to bottom,
      rgb(var(--ground-mid)),
      rgb(var(--ground)) 62%
    );
    border-top: 1px solid rgb(var(--accent) / 0.2);
  }

  /* Why the first version looked dry, and what answers each part.

     Its falloff was a straight line from centre to edge, and a linear ramp
     shows the shape it is ramping over: you could see the oval. These stops
     trace a bell instead — dropping fast from the centre and trailing a long
     way before they reach nothing — which is what makes an edge stop being an
     edge.

     It was painted over the water, and a sun's colour at part opacity over
     dark purple is grey. Light does not cover what it lands on, it adds to
     it; `screen` lightens the water toward the sun's colour instead of mixing
     the two into mud.

     And it has a blur again, which the first version had removed on account
     of the clouds. The clouds' seams came from a box with no size, clipped
     exactly where the picture was. Here the gradient is already at zero by
     the time it reaches its own edge, so wherever WebKitGTK decides to cut
     the blur off, it is cutting through nothing. */
  .reflection {
    position: absolute;
    left: 75%;
    transform: translateX(-50%);
    background: radial-gradient(
      ellipse 50% 100% at 50% 0%,
      rgb(var(--body) / 0.9) 0%,
      rgb(var(--body) / 0.62) 22%,
      rgb(var(--body) / 0.32) 45%,
      rgb(var(--body) / 0.12) 66%,
      rgb(var(--body) / 0.03) 82%,
      rgb(var(--body) / 0) 92%
    );
    mix-blend-mode: screen;
    filter: blur(3rem);
    opacity: calc(var(--strength) * var(--dim, 1));
    pointer-events: none;
    transition: opacity 0.4s linear;
  }

  /* A thread of light on the surface where the body meets it. Centred on the
     waterline rather than hung below it, and with the same bell of a falloff
     as the reflection, so it reads as a glint rather than a ruled line. A
     little whiter than the body at its core, the way a highlight is. */
  .lip {
    position: absolute;
    left: 75%;
    top: 0;
    transform: translate(-50%, -50%);
    background: radial-gradient(
      ellipse 50% 50% at 50% 50%,
      rgb(255 236 210 / 0.95) 0%,
      rgb(var(--body) / 0.55) 30%,
      rgb(var(--body) / 0.18) 60%,
      rgb(var(--body) / 0) 100%
    );
    mix-blend-mode: screen;
    opacity: calc(var(--touch) * 0.6 * var(--dim, 1));
    pointer-events: none;
  }

  /* And the same light caught in the air just above it, low and wide. */
  .bloom {
    position: absolute;
    bottom: var(--horizon);
    left: 75%;
    height: 14rem;
    transform: translateX(-50%);
    border-radius: 50%;
    background: radial-gradient(
      ellipse at 50% 100%,
      rgb(var(--body) / 0.35),
      rgb(var(--body) / 0) 70%
    );
    opacity: calc(var(--touch) * 0.9 * var(--dim, 1));
    pointer-events: none;
  }

  /* All three follow the sun in compact: moved in, and stepping back on hover
     with it, so a reflection is never brighter than the thing it reflects. */
  .frame.compact :is(.reflection, .lip, .bloom) {
    left: 58%;
  }

  .frame.compact.hovering :is(.reflection, .lip, .bloom) {
    --dim: 0.3;
  }

  /* --- readout --------------------------------------------------------- */

  /* The readout sits above the horizon rather than across it.
     `margin-top: auto` on the time pushes this group to the bottom, so the
     bottom padding is what lifts it: at 13rem the digits straddled the line
     between sky and ground and read as misaligned, while the shorter compact
     layout never had the problem. */
  .content {
    position: absolute;
    inset: 0;
    padding: 11rem 15rem 30rem;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    pointer-events: none;
  }

  .label {
    /* Clears the close button's corner so the two never sit on top of
       each other, hovered or not. */
    margin-left: 21rem;
    font-size: 9.5rem;
    font-weight: 600;
    letter-spacing: 0.2em;
    color: rgb(var(--accent));
    text-shadow: 0 1rem 6rem rgb(0 0 0 / 0.4);
    transition: opacity 0.25s ease;
  }

  .time {
    margin-top: auto;
    font-size: 40rem;
    line-height: 1;
    font-weight: 200;
    letter-spacing: -0.015em;
    font-variant-numeric: tabular-nums;
    font-feature-settings: "tnum" 1;
    color: rgb(var(--ink));
    text-shadow: 0 2rem 14rem rgb(0 0 0 / 0.45);
    transition:
      opacity 0.3s ease,
      font-size 0.25s ease;
  }

  .time.idle {
    opacity: 0.72;
  }

  .dots {
    display: flex;
    gap: 5rem;
    margin-top: 8rem;
    transition: opacity 0.25s ease;
  }

  .dots i {
    width: 5rem;
    height: 5rem;
    border-radius: 50%;
    background: rgb(var(--ink) / 0.22);
    box-shadow: inset 0 0 0 1px rgb(var(--ink) / 0.18);
    transition: background 0.4s ease;
  }

  .dots i.filled {
    background: rgb(var(--accent));
    box-shadow: 0 0 6rem rgb(var(--accent) / 0.7);
  }

  /* Compact mode is a single row: readout on the left, the play control and
     the padlock on the right. Anything that would not fit at a size worth
     aiming at is dropped rather than shrunk — skip, reset and close stay
     available on the keyboard, and double-clicking restores the full widget. */
  .frame.compact .content {
    padding: 0 0 0 14rem;
    justify-content: center;
  }

  /* The dots follow the readout up, so the pair stays one group. */
  .dots {
    margin-bottom: 0;
  }

  .frame.compact .label,
  .frame.compact .dots {
    display: none;
  }

  .frame.compact .time {
    margin-top: 0;
    font-size: 28rem;
  }

  /* Pull the sun off the right edge so it clears the readout without sitting
     centred under the controls. */
  .frame.compact .celestial {
    left: 58%;
    transform: scale(0.72);
  }

  /* Compact is too narrow for the sun and the controls to coexist legibly —
     but the controls only exist while the pointer is on the widget, so the
     conflict is a moment rather than a state. The sun steps back for that
     moment and returns when you withdraw, which keeps the piece that gives the
     widget its character instead of deleting it to satisfy a hover. */
  .frame.compact.hovering .celestial {
    opacity: 0.3;
  }

  /* --- interaction ----------------------------------------------------- */

  .drag {
    position: absolute;
    inset: 0;
    cursor: grab;
  }

  .drag:active {
    cursor: grabbing;
  }

  .ui {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.22s ease;
  }

  .ui.show {
    opacity: 1;
  }

  .ui.show :global(button),
  .ui.show :global(.grip) {
    pointer-events: auto;
  }

  /* The controls fade rather than leave the document, so they keep their place
     in the tab order while invisible — which meant tabbing through the widget
     moved a focus ring nobody could see. Focus has to be able to summon what
     hover summons, or the keyboard path is a guess.

     `:has(:focus-visible)` rather than `:focus-within`, so that this answers
     the same question the keyboard handler asks: was this reached with the
     keyboard, or is it focus left lying around by a click? A button keeps the
     focus after being clicked, and with the plain version the controls stayed
     lit after the pointer had gone — which is the opposite of a widget that
     reads as scenery.

     The `:global` inside `:has` is load-bearing. Svelte scopes the selector
     within a `:has` too, so the plain version compiled to "focus on something
     App.svelte itself rendered" — which is the close button and the chevron,
     and not the transport controls or the grip, since those are components
     with a scope of their own. Tabbing to play revealed nothing at all.

     Not while locked, though. That is the one state where the controls are
     meant to be gone rather than merely hidden, and the padlock stays
     reachable on its own below. */
  .frame:not(.locked) .ui:has(:global(:focus-visible)) {
    opacity: 1;
  }

  .frame:not(.locked) .ui:has(:global(:focus-visible)) :global(button),
  .frame:not(.locked) .ui:has(:global(:focus-visible)) :global(.grip) {
    pointer-events: auto;
  }

  /* Offset from the right edge to leave the corner to the resize grip. */
  .dock {
    position: absolute;
    right: 26rem;
    bottom: 11rem;
  }

  /* One row, vertically centred, with the padlock outermost so it keeps the
     corner position it needs to stay easy to hit while locked. */
  .frame.compact .dock {
    top: 50%;
    right: 44rem;
    bottom: auto;
    transform: translateY(-50%);
  }

  .frame.compact .close {
    display: none;
  }

  /* Centred on the bottom edge: the classic "there is more below" affordance,
     and the one spot on that edge not already claimed by the dots or the dock. */
  .disclose {
    position: absolute;
    left: 50%;
    bottom: 5rem;
    transform: translateX(-50%);
    display: grid;
    place-items: center;
    width: 26rem;
    height: 18rem;
    padding: 0;
    border: none;
    border-radius: 9rem;
    background: rgb(255 255 255 / 0.08);
    color: rgb(var(--ink) / 0.75);
    cursor: pointer;
    backdrop-filter: blur(6px);
    transition:
      background 0.16s ease,
      color 0.16s ease;
  }

  .disclose:hover {
    background: rgb(255 255 255 / 0.18);
    color: rgb(var(--ink));
  }

  .disclose:focus-visible {
    outline: 2px solid rgb(var(--accent) / 0.8);
    outline-offset: 2px;
  }

  .disclose svg {
    width: 13rem;
    height: 13rem;
    transition: transform 0.26s ease;
  }

  .frame.open .disclose svg {
    transform: rotate(180deg);
  }

  /* Close sits in the opposite corner from the padlock on purpose. They are
     the two highest-consequence buttons in the widget, and putting them
     side by side would mean a mis-aimed click on lock could quit the app. */
  .close {
    position: absolute;
    top: 8rem;
    left: 8rem;
    display: grid;
    place-items: center;
    width: 20rem;
    height: 20rem;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: rgb(255 255 255 / 0.08);
    color: rgb(var(--ink) / 0.8);
    cursor: pointer;
    transition:
      background 0.16s ease,
      color 0.16s ease;
  }

  .close:hover {
    background: rgb(232 90 90 / 0.55);
    color: #fff;
  }

  .close svg {
    width: 11rem;
    height: 11rem;
  }

  /* The padlock lives in the corner — the easiest target to hit — and stays
     at full strength while the rest of the widget fades. */
  .lock-slot {
    position: absolute;
    top: 8rem;
    right: 8rem;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s ease;
  }

  /* Same reason as above, and here it was not merely narrowed but dropped:
     everything inside this slot belongs to the padlock component, so with the
     selector scoped there was nothing left for it to match and Svelte removed
     the rule. */
  .lock-slot.show,
  .lock-slot:has(:global(:focus-visible)) {
    opacity: 1;
    pointer-events: auto;
  }

  .frame.compact .lock-slot {
    top: 50%;
    right: 12rem;
    transform: translateY(-50%);
  }

  /* Sits above the dimmed canvas rather than inside it, so it stays legible
     while everything behind it recedes. */
  .hint {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 9rem;
    text-align: center;
    font-size: 9rem;
    font-weight: 500;
    letter-spacing: 0.09em;
    color: rgb(var(--ink) / 0.66);
    text-shadow: 0 1rem 5rem rgb(0 0 0 / 0.65);
    pointer-events: none;
    animation: hint-in 0.3s ease both;
  }

  .hint span {
    opacity: 0.45;
    margin: 0 1rem;
  }

  @keyframes hint-in {
    from {
      opacity: 0;
      transform: translateY(3rem);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  /* --- the tour's spotlight ------------------------------------------- */

  /* A dark layer laid over the backdrop, not opacity applied to it.
     The window is transparent, so fading the backdrop out does not darken it
     — it reveals the desktop underneath, and over a bright wallpaper the
     widget washes out instead of stepping back. Opacity is the right tool for
     lock, which genuinely wants to be see-through; this wants the opposite.

     Below the controls in the stacking order, so the thing being pointed at
     stays at full strength while everything behind it goes down. */
  .shade {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: rgb(8 6 16 / 0.42);
    /* The tour always has the panel slot open, so the bottom corners belong
       to what is below and only the top pair are rounded. */
    border-radius: var(--radius) var(--radius) 0 0;
    animation: shade-in 0.35s ease both;
  }

  @keyframes shade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* A slow breath rather than a flash. The rule about motion applies to a
     tutorial as much as to the sky: anything quick in the corner of the eye
     costs attention, and this is meant to say "over here" to somebody who is
     already reading about it. */
  @keyframes spotlight {
    0%,
    100% {
      box-shadow: 0 0 0 0 rgb(var(--accent) / 0);
    }
    50% {
      box-shadow: 0 0 0 5rem rgb(var(--accent) / 0.3);
    }
  }

  .frame.spot-controls .disclose,
  .frame.spot-controls :global(.grip),
  .frame.spot-away .lock-slot :global(button),
  .frame.spot-away .close {
    animation: spotlight 2.4s ease-in-out infinite;
  }

  .progress {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2rem;
    background: rgb(0 0 0 / 0.28);
    pointer-events: none;
  }

  .progress i {
    display: block;
    height: 100%;
    background: rgb(var(--accent));
    box-shadow: 0 0 8rem rgb(var(--accent) / 0.8);
    transform-origin: left center;
    transition: transform 0.2s linear;
  }

  @media (prefers-reduced-motion: reduce) {
    .haze {
      animation: none;
    }

    /* Still marked, just not moving. Losing the pulse must not lose the
       pointing, or the step stops making sense. */
    .frame.spot-controls .disclose,
    .frame.spot-controls :global(.grip),
    .frame.spot-away .lock-slot :global(button),
    .frame.spot-away .close {
      animation: none;
      box-shadow: 0 0 0 4rem rgb(var(--accent) / 0.3);
    }
  }
</style>
