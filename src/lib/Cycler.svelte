<script lang="ts" generics="T extends string">
  /**
   * A left/value/right row for picking one of a short list.
   *
   * Deliberately the same shape as the duration steppers. Four options laid
   * out as pills would not fit the panel's width without truncating the
   * longest label, and a native select looks borrowed from another
   * application — cycling keeps the panel's one control idiom.
   */
  interface Option {
    value: T;
    label: string;
  }

  interface Props {
    label: string;
    value: T;
    options: readonly Option[];
    onChange: (value: T) => void;
  }

  let { label, value, options, onChange }: Props = $props();

  const index = $derived(Math.max(0, options.findIndex((o) => o.value === value)));
  const current = $derived(options[index]?.label ?? "");

  function step(direction: number): void {
    // Wraps, because a four-item list has no meaningful ends.
    const next = (index + direction + options.length) % options.length;
    onChange(options[next].value);
  }
</script>

<div class="cycler">
  <span class="label">{label}</span>

  <button onclick={() => step(-1)} aria-label="Previous {label}">
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <path d="M7.4 2.6 4 6l3.4 3.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>

  <span class="value" aria-live="polite">{current}</span>

  <button onclick={() => step(1)} aria-label="Next {label}">
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <path d="M4.6 2.6 8 6l-3.4 3.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>
</div>

<style>
  .cycler {
    display: flex;
    align-items: center;
    gap: 6rem;
  }

  .label {
    flex: 1 1 auto;
    font-size: 11.5rem;
    color: rgb(var(--ink) / 0.78);
  }

  .value {
    flex: 0 0 auto;
    min-width: 56rem;
    text-align: center;
    font-size: 11rem;
    color: rgb(var(--ink));
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
      border-color 0.14s ease;
  }

  button:hover {
    background: rgb(var(--accent) / 0.26);
    border-color: rgb(var(--accent) / 0.5);
  }

  button:active {
    transform: scale(0.9);
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
