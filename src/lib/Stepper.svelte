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
    suffix = "",
    disabled = false,
    onChange,
  }: Props = $props();

  const canGoDown = $derived(!disabled && value > min);
  const canGoUp = $derived(!disabled && value < max);

  function nudge(direction: number): void {
    onChange(Math.min(max, Math.max(min, value + direction * step)));
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
    aria-valuemin={min}
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
