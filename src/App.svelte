<script lang="ts">
  import { Timer } from "./lib/timer.svelte";
  import { LockController } from "./lib/lock.svelte";
  import { skyFor, skyVars } from "./lib/sky";
  import { chime, unlockAudio } from "./lib/chime";
  import { closeWindow, onBackendEvent, setWindowSize } from "./lib/window";
  import { loadPrefs, savePrefs } from "./lib/prefs";
  import Stars from "./lib/Stars.svelte";
  import Grain from "./lib/Grain.svelte";
  import Controls from "./lib/Controls.svelte";
  import Padlock from "./lib/Padlock.svelte";

  const NORMAL_SIZE = { width: 336, height: 148 };
  // Wide enough that the readout and the two surviving buttons sit on one row
  // without crowding each other.
  const COMPACT_SIZE = { width: 196, height: 74 };

  const timer = new Timer();
  const lock = new LockController();

  timer.onSegmentEnd = (done, next) => {
    if (!next) chime("done");
    else if (done.phase === "focus") chime("focus-end");
    else chime("break-end");
  };

  const stored = loadPrefs();
  let compact = $state(stored.compact);
  let hovering = $state(false);

  const sky = $derived(skyFor(timer.phase, timer.progress, timer.finished));
  const vars = $derived(skyVars(sky));

  // Restore the saved window size before anything is visible, then keep the
  // window in step with the mode.
  $effect(() => {
    const size = compact ? COMPACT_SIZE : NORMAL_SIZE;
    void setWindowSize(size.width, size.height);
  });

  $effect(() => {
    savePrefs({ locked: lock.locked, compact });
  });

  $effect(() => {
    if (stored.locked) lock.lock();
    return () => lock.destroy();
  });

  // The global shortcut is the way back in if hit-testing ever fails.
  $effect(() => {
    let dispose: (() => void) | null = null;
    let cancelled = false;

    void onBackendEvent("gloam://toggle-lock", () => lock.toggle()).then((fn) => {
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
    // end-of-segment chime is guaranteed to be audible later.
    unlockAudio();
    timer.toggle();
  }

  function onDoubleClick(): void {
    if (lock.locked) return;
    compact = !compact;
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.repeat) return;

    switch (event.key) {
      case " ":
        event.preventDefault();
        toggleTimer();
        break;
      case "r":
      case "R":
        timer.reset();
        break;
      case "s":
      case "S":
        timer.skip();
        break;
      case "l":
      case "L":
        lock.toggle();
        break;
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<main
  class="frame"
  class:locked={lock.locked}
  class:compact
  style={vars}
  onmouseenter={() => (hovering = true)}
  onmouseleave={() => (hovering = false)}
  ondblclick={onDoubleClick}
>
  <div class="widget">
    <!-- Everything that should recede when the widget is locked lives in here,
         so the padlock can stay at full strength outside it. -->
    <div class="canvas">
      <div class="sky"></div>

      <Stars visible={sky.stars} />

      <div class="celestial"></div>

      <div class="haze haze-a"></div>
      <div class="haze haze-b"></div>

      <div class="ground"></div>

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
    {#if !lock.locked}
      <div class="drag" data-tauri-drag-region></div>
    {/if}

    <div class="ui" class:show={hovering && !lock.locked}>
      <button class="close" onclick={closeWindow} title="Close" aria-label="Close">
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
          onReset={() => timer.reset()}
          onSkip={() => timer.skip()}
          {compact}
        />
      </div>
    </div>

    <!-- Outside .ui: the padlock has to stay reachable when everything else
         has faded out and stopped accepting clicks. -->
    <div class="lock-slot" class:show={hovering || lock.locked}>
      <Padlock
        locked={lock.locked}
        hot={lock.hot}
        onToggle={() => lock.toggle()}
        register={(el) => lock.attach(el)}
        small={compact}
      />
    </div>
  </div>
</main>

<style>
  .frame {
    position: absolute;
    inset: 0;
    padding: 8px;
  }

  .widget {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: var(--radius);
    overflow: hidden;
    border: 1px solid rgb(255 255 255 / 0.1);
    box-shadow:
      0 6px 22px rgb(0 0 0 / 0.42),
      0 1px 3px rgb(0 0 0 / 0.3);
    isolation: isolate;
    transition:
      border-color 0.45s ease,
      box-shadow 0.45s ease;
  }

  .canvas {
    position: absolute;
    inset: 0;
    transition: opacity 0.45s ease;
  }

  /* Locked: recede so the document underneath stays readable through it. */
  .frame.locked .canvas {
    opacity: 0.44;
  }

  .frame.locked .widget {
    border-color: rgb(255 255 255 / 0.05);
    box-shadow: none;
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
      height 0.4s linear;
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

  .content {
    position: absolute;
    inset: 0;
    padding: 11px 15px 13px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    pointer-events: none;
  }

  .label {
    /* Clears the close button's corner so the two never sit on top of
       each other, hovered or not. */
    margin-left: 21px;
    font-size: 9.5px;
    font-weight: 600;
    letter-spacing: 0.2em;
    color: rgb(var(--accent));
    text-shadow: 0 1px 6px rgb(0 0 0 / 0.4);
    transition: opacity 0.25s ease;
  }

  .time {
    margin-top: auto;
    font-size: 40px;
    line-height: 1;
    font-weight: 200;
    letter-spacing: -0.015em;
    font-variant-numeric: tabular-nums;
    font-feature-settings: "tnum" 1;
    color: rgb(var(--ink));
    text-shadow: 0 2px 14px rgb(0 0 0 / 0.45);
    transition:
      opacity 0.3s ease,
      font-size 0.25s ease;
  }

  .time.idle {
    opacity: 0.72;
  }

  .dots {
    display: flex;
    gap: 5px;
    margin-top: 8px;
    transition: opacity 0.25s ease;
  }

  .dots i {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: rgb(var(--ink) / 0.22);
    box-shadow: inset 0 0 0 1px rgb(var(--ink) / 0.18);
    transition: background 0.4s ease;
  }

  .dots i.filled {
    background: rgb(var(--accent));
    box-shadow: 0 0 6px rgb(var(--accent) / 0.7);
  }

  /* Compact mode is a single row: readout on the left, the play control and
     the padlock on the right. Anything that would not fit at a size worth
     aiming at is dropped rather than shrunk — skip, reset and close stay
     available on the keyboard, and double-clicking restores the full widget. */
  .frame.compact .content {
    padding: 0 0 0 14px;
    justify-content: center;
  }

  .frame.compact .label,
  .frame.compact .dots {
    display: none;
  }

  .frame.compact .time {
    margin-top: 0;
    font-size: 28px;
  }

  .frame.compact .ground {
    height: 26%;
  }

  /* Pull the sun off the right edge so it is not sitting directly behind the
     buttons. */
  .frame.compact .celestial {
    left: 58%;
    transform: scale(0.72);
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

  .ui.show :global(button) {
    pointer-events: auto;
  }

  .dock {
    position: absolute;
    right: 12px;
    bottom: 11px;
  }

  /* One row, vertically centred, with the padlock outermost so it keeps the
     corner position it needs to stay easy to hit while locked. */
  .frame.compact .dock {
    top: 50%;
    right: 44px;
    bottom: auto;
    transform: translateY(-50%);
  }

  .frame.compact .close {
    display: none;
  }

  /* Close sits in the opposite corner from the padlock on purpose. They are
     the two highest-consequence buttons in the widget, and putting them
     side by side would mean a mis-aimed click on lock could quit the app. */
  .close {
    position: absolute;
    top: 8px;
    left: 8px;
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
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
    width: 11px;
    height: 11px;
  }

  /* The padlock lives in the corner — the easiest target to hit — and stays
     at full strength while the rest of the widget fades. */
  .lock-slot {
    position: absolute;
    top: 8px;
    right: 8px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s ease;
  }

  .lock-slot.show {
    opacity: 1;
    pointer-events: auto;
  }

  .frame.compact .lock-slot {
    top: 50%;
    right: 12px;
    transform: translateY(-50%);
  }

  .progress {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2px;
    background: rgb(0 0 0 / 0.28);
    pointer-events: none;
  }

  .progress i {
    display: block;
    height: 100%;
    background: rgb(var(--accent));
    box-shadow: 0 0 8px rgb(var(--accent) / 0.8);
    transform-origin: left center;
    transition: transform 0.2s linear;
  }

  @media (prefers-reduced-motion: reduce) {
    .haze {
      animation: none;
    }
  }
</style>
