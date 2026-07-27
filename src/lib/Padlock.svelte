<script lang="ts">
  /**
   * The padlock is the one control that survives lock mode, so it is drawn
   * larger and brighter than the rest and sits in a corner, where it is the
   * easiest target on screen to hit.
   */
  interface Props {
    locked: boolean;
    /** True while the cursor is inside the hotspot and clicks will land. */
    hot: boolean;
    onToggle: () => void;
    /** Receives the element whose bounds define the clickable region. */
    register: (element: HTMLElement | null) => void;
    /** Shrinks the button to fit the single-row layout. */
    small?: boolean;
  }

  let { locked, hot, onToggle, register, small = false }: Props = $props();

  let element: HTMLButtonElement | null = $state(null);

  $effect(() => {
    register(element);
    return () => register(null);
  });
</script>

<button
  bind:this={element}
  class="padlock"
  class:locked
  class:hot
  class:small
  onclick={onToggle}
  title={locked ? "Unlock (Ctrl+Alt+G)" : "Lock and let clicks pass through (Ctrl+Alt+G)"}
  aria-label={locked ? "Unlock widget" : "Lock widget"}
  aria-pressed={locked}
>
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <!-- Shackle: pivots open around its right leg rather than sliding, which
         reads as a mechanism instead of a swap between two icons. -->
    <path
      class="shackle"
      d="M6.4 9.2V6.6a3.6 3.6 0 0 1 7.2 0v2.6"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
    />
    <rect class="body" x="4" y="9" width="12" height="8.4" rx="2.1" />
    <circle class="keyhole" cx="10" cy="13.2" r="1.15" />
  </svg>
</button>

<style>
  .padlock {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 1px solid rgb(255 255 255 / 0.14);
    border-radius: 50%;
    background: rgb(255 255 255 / 0.07);
    color: rgb(var(--ink));
    cursor: pointer;
    backdrop-filter: blur(6px);
    transition:
      background 0.2s ease,
      border-color 0.2s ease,
      color 0.2s ease,
      transform 0.2s ease,
      box-shadow 0.2s ease;
  }

  .padlock:hover {
    background: rgb(255 255 255 / 0.16);
    border-color: rgb(255 255 255 / 0.26);
  }

  .padlock:active {
    transform: scale(0.92);
  }

  .padlock:focus-visible {
    outline: 2px solid rgb(var(--accent) / 0.8);
    outline-offset: 2px;
  }

  .padlock.locked {
    background: rgb(var(--accent) / 0.24);
    border-color: rgb(var(--accent) / 0.5);
    color: rgb(var(--accent));
  }

  /* While the cursor is inside the hotspot the widget is momentarily
     clickable again, and the padlock says so. */
  .padlock.locked.hot {
    background: rgb(var(--accent) / 0.42);
    border-color: rgb(var(--accent) / 0.85);
    box-shadow: 0 0 12px rgb(var(--accent) / 0.5);
    transform: scale(1.08);
  }

  .padlock.small {
    width: 24px;
    height: 24px;
  }

  svg {
    width: 17px;
    height: 17px;
  }

  .padlock.small svg {
    width: 15px;
    height: 15px;
  }

  .body,
  .keyhole {
    fill: currentColor;
  }

  .keyhole {
    fill: rgb(0 0 0 / 0.45);
    transition: r 0.2s ease;
  }

  /* The shackle hinges on its right leg, where it meets the body. SVG rotates
     clockwise for positive angles, so a positive rotation is what lifts the
     free leg clear of the body — negative buries it inside. */
  .shackle {
    transform-origin: 13.6px 9.2px;
    transition: transform 0.34s cubic-bezier(0.34, 1.45, 0.5, 1);
  }

  /* Open: the free leg swings well above the body, leaving a visible gap so
     the state reads at 15px without needing a second glance. */
  .padlock:not(.locked) .shackle {
    transform: rotate(34deg) translateY(-0.6px);
  }

  .padlock.locked .shackle {
    transform: rotate(0deg) translateY(0);
  }

  @media (prefers-reduced-motion: reduce) {
    .shackle {
      transition: none;
    }
  }
</style>
