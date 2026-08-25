<script lang="ts">
  /**
   * A minus/value/plus row.
   *
   * Chosen over a number field on purpose. At this size a form input looks
   * borrowed from another application, and more usefully a stepper cannot
   * produce an invalid value at all — there is no empty state and nothing to
   * mistype. The engine still guards its inputs, but the interface stops
   * being a source of them.
   */
  interface Props {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    /**
     * One extra stop below `min`, or nothing.
     *
     * Not a lower minimum: the range keeps its own grid and this sits under
     * it, so the first press down from `min` lands here and the first press up
     * from here lands back on `min`. Nothing in between is reachable, which is
     * what stops an unusual low value from knocking every ordinary one off its
     * step on the way back up.
     */
    floor?: number;
    suffix?: string;
    disabled?: boolean;
    onChange: (value: number) => void;
  }

  let {
    label,
    value,
    min,
    max,
    step,
    floor,
    suffix = "",
    disabled = false,
    onChange,
  }: Props = $props();

  /** The lowest reachable value, which is the extra stop when there is one. */
  const bottom = $derived(floor !== undefined && floor < min ? floor : min);

  const canGoDown = $derived(!disabled && value > bottom);
  const canGoUp = $derived(!disabled && value < max);

  function nudge(direction: number): void {
    if (direction < 0) {
      // Off the bottom of the grid lands on the extra stop rather than
      // stopping at the minimum; there is nowhere below that.
      onChange(value > min ? Math.max(min, value - step) : bottom);
      return;
    }
    // And back up from the extra stop lands on the minimum rather than a step
    // above it, which would leave every later value half a step off.
    onChange(value < min ? min : Math.min(max, value + step));
  }
</script>

<div class="stepper" class:disabled>
  <span class="label">{label}</span>

  <button
    onclick={() => nudge(-1)}
    disabled={!canGoDown}
    aria-label="Decrease {label}"
  >
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.6 6h6.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
  </button>

  <span
    class="value"
    role="spinbutton"
    tabindex="-1"
    aria-label={label}
    aria-valuenow={value}
    aria-valuemin={bottom}
    aria-valuemax={max}
  >
    {value}{suffix}
  </span>

  <button
    onclick={() => nudge(1)}
    disabled={!canGoUp}
    aria-label="Increase {label}"
  >
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <path d="M6 2.6v6.8M2.6 6h6.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
  </button>
</div>

<style>
  .stepper {
    display: flex;
    align-items: center;
    gap: 6rem;
  }

  .label {
    flex: 1 1 auto;
    font-size: 11.5rem;
    color: rgb(var(--ink) / 0.78);
    transition: color 0.2s ease;
  }

  .stepper.disabled .label {
    color: rgb(var(--ink) / 0.34);
  }

  .value {
    flex: 0 0 auto;
    min-width: 42rem;
    text-align: center;
    font-size: 12rem;
    font-variant-numeric: tabular-nums;
    color: rgb(var(--ink));
    transition: color 0.2s ease;
  }

  .stepper.disabled .value {
    color: rgb(var(--ink) / 0.38);
  }

  button {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: 18rem;
    height: 18rem;
    padding: 0;
    border: 1px solid rgb(255 255 255 / 0.14);
    border-radius: 50%;
    background: rgb(255 255 255 / 0.06);
    color: rgb(var(--ink) / 0.9);
    cursor: pointer;
    transition:
      background 0.14s ease,
      border-color 0.14s ease,
      opacity 0.14s ease;
  }

  button:hover:not(:disabled) {
    background: rgb(var(--accent) / 0.26);
    border-color: rgb(var(--accent) / 0.5);
  }

  button:active:not(:disabled) {
    transform: scale(0.9);
  }

  button:disabled {
    opacity: 0.25;
    cursor: default;
  }

  button:focus-visible {
    outline: 2px solid rgb(var(--accent) / 0.8);
    outline-offset: 2px;
  }

  svg {
    width: 10rem;
    height: 10rem;
  }
</style>
