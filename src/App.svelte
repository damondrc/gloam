<script lang="ts">
  import { Timer } from "./lib/timer.svelte";
  import { LockController } from "./lib/lock.svelte";
  import { MAX_SCALE, MIN_SCALE, SCALE_STEP, ScaleController } from "./lib/scale.svelte";
  import { skyFor, skyVars } from "./lib/sky";
  import * as sound from "./lib/sound";
  import {
    dismissWindow,
    hasTray,
    onBackendEvent,
    setWindowSize,
    startDragging,
  } from "./lib/window";
  import { loadPrefs, savePrefs } from "./lib/prefs";
  import { resolveShortcut } from "./lib/shortcuts";
  import type { Action } from "./lib/shortcuts";
  import { ambienceSettings } from "./lib/ambience";
  import Stars from "./lib/Stars.svelte";
  import Clouds from "./lib/Clouds.svelte";
  import Birds from "./lib/Birds.svelte";
  import ShootingStar from "./lib/ShootingStar.svelte";
  import Grain from "./lib/Grain.svelte";
  import Controls from "./lib/Controls.svelte";
  import Padlock from "./lib/Padlock.svelte";
  import Grip from "./lib/Grip.svelte";
  import Panel from "./lib/Panel.svelte";

  /**
   * Layout sizes at scale 1. The window is these multiplied by the scale.
   *
   * There is no margin around the widget any more: it existed only to give a
   * drop shadow room to fade out, and without one it was a band of invisible
   * window that caught the pointer without showing anything.
   */
  const NORMAL_SIZE = { width: 320, height: 132 };
  const COMPACT_SIZE = { width: 180, height: 58 };

  /**
   * How much taller the window gets when the panel is open.
   *
   * One height for every tab, sized to the tallest — a panel that resized as
   * you moved between tabs would make the window jump under the pointer that
   * was navigating it. Ambience is now the tall one: a slider, two choices and
   * the line under each explaining what it is for.
   */
  const PANEL_HEIGHT = 164;

  const timer = new Timer();
  const lock = new LockController();
  const scale = new ScaleController();

  // Named for the segment that is starting rather than the one that ended.
  // They are the same instant, but "a break is beginning" is what the listener
  // needs to act on, and it keeps the sound vocabulary and the phrase names
  // describing the same thing.
  timer.onSegmentEnd = (_done, next) => {
    if (!next) sound.runComplete();
    else if (next.phase === "focus") sound.enterFocus();
    else sound.enterBreak();
  };

  // Asked once. What the close button does depends on it, and the button has
  // to say which of the two it is going to do before it is pressed rather
  // than after.
  let tray = $state(false);
  void hasTray().then((present) => (tray = present));

  const stored = loadPrefs();
  let compact = $state(stored.compact);
  let hovering = $state(false);
  let panelOpen = $state(false);
  let volume = $state(stored.volume);
  let soundSet = $state(stored.sound);
  let ambience = $state(stored.ambience);

  const backdrop = $derived(ambienceSettings(ambience));

  $effect(() => {
    sound.setVolume(volume);
  });

  $effect(() => {
    sound.setSoundSet(soundSet);
  });

  /** How long the escape-hatch hint stays up after locking. */
  const HINT_MS = 4500;
  let showHint = $state(false);

  // Locking hides the close button and stops the window accepting clicks
  // anywhere but the padlock, so the way out has to be stated rather than
  // discovered. Shown on every lock, not just the first: it costs nothing to
  // repeat and being stranded costs a lot.
  $effect(() => {
    if (!lock.locked) {
      showHint = false;
      return;
    }
    showHint = true;
    const timer = setTimeout(() => (showHint = false), HINT_MS);
    return () => clearTimeout(timer);
  });

  scale.set(stored.scale);
  timer.applyConfig(stored.config);

  const sky = $derived(skyFor(timer.phase, timer.progress, timer.finished));
  const baseSize = $derived(compact ? COMPACT_SIZE : NORMAL_SIZE);

  /** The stage is the timer; the panel grows the window beneath it. */
  const stageHeight = $derived(baseSize.height);
  const panelHeight = $derived(panelOpen ? PANEL_HEIGHT : 0);
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
      config: timer.config,
    });
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

  // The global shortcut is the way back in if hit-testing ever fails.
  $effect(() => {
    let dispose: (() => void) | null = null;
    let cancelled = false;

    void onBackendEvent("gloam://toggle-lock", () => toggleLock()).then((fn) => {
      if (cancelled) fn();
      else dispose = fn;
    });

    return () => {
      cancelled = true;
      dispose?.();
    };
  });

  function toggleTimer(): void {
    // The first click doubles as the user gesture that unlocks WebAudio, so the
    // end-of-segment sounds are guaranteed to be audible later.
    sound.unlockAudio();
    sound.press(timer.running ? "pause" : "start");
    timer.toggle();
  }

  // Manual actions get the faint interface tick, never a transition phrase.
  // The phrases mean "the timer moved on by itself"; when you moved it, you
  // already know.
  function resetTimer(): void {
    sound.press("reset");
    timer.reset();
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
  class:open={panelOpen}
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

      <div class="ground"></div>

      <!-- After the ground, because its reflection has to land on the water
           rather than behind it, and before the grain so it shares the same
           texture as everything else. Compact has fifty pixels of sky and no
           water to speak of, so it does not fall there. -->
      {#if backdrop.meteor && !compact}
        <ShootingStar
          night={sky.stars}
          width={baseSize.width}
          height={baseSize.height}
        />
      {/if}

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
    <div class="ui" class:show={(hovering || panelOpen) && !lock.locked}>
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

    {#if showHint}
      <div class="hint">Ctrl<span>+</span>Alt<span>+</span>G to unlock</div>
    {/if}

    <!-- Outside .ui: the padlock has to stay reachable when everything else
         has faded out and stopped accepting clicks. -->
    <div class="lock-slot" class:show={hovering || lock.locked}>
      <Padlock
        locked={lock.locked}
        hot={lock.hot}
        onToggle={toggleLock}
        register={(el) => lock.attach(el)}
        small={compact}
      />
    </div>
   </div>

   {#if panelOpen}
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

  /* The horizon the sun sets behind. */
  .ground {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 30%;
    background: linear-gradient(
      to bottom,
      rgb(var(--ground) / 0.72),
      rgb(var(--ground)) 62%
    );
    border-top: 1px solid rgb(var(--accent) / 0.2);
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

  .frame.compact .ground {
    height: 26%;
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
  }
</style>
