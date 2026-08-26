<script lang="ts">
  /**
   * A switch, for the one kind of setting the panel did not have a shape for.
   *
   * The steppers and the cyclers both answer "which of these", and a cycler
   * with On and Off in it would technically do — at the cost of making the
   * reader step through a list to find out which of two states they are in.
   * A switch says it at a glance, which is the whole difference.
   *
   * Laid out like the rows beside it: label to the left, control to the right,
   * on the same baseline, so a third idiom does not read as a third design.
   */
  interface Props {
    label: string;
    checked: boolean;
    /** True while the answer is still being asked for. */
    pending?: boolean;
    onChange: (value: boolean) => void;
  }

  let { label, checked, pending = false, onChange }: Props = $props();
</script>

<label class="toggle" class:pending>
  <span class="name">{label}</span>

  <input
    type="checkbox"
    role="switch"
    {checked}
    disabled={pending}
    onchange={(event) => onChange(event.currentTarget.checked)}
  />

  <span class="track" aria-hidden="true"><i></i></span>
</label>

<style>
  .toggle {
    display: flex;
    align-items: center;
    gap: 12rem;
    cursor: pointer;
  }

  .toggle.pending {
    cursor: default;
  }

  .name {
    flex: 1 1 auto;
    font-size: 11.5rem;
    color: rgb(var(--ink) / 0.78);
    transition: color 0.2s ease;
  }

  .toggle.pending .name {
    color: rgb(var(--ink) / 0.34);
  }

  /* The input carries the state, the focus and the whole of the keyboard;
     the track beside it is what gets looked at. Hidden from sight rather than
     from the accessibility tree, which `display: none` would also do. */
  input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  .track {
    flex: 0 0 auto;
    position: relative;
    width: 30rem;
    height: 17rem;
    border-radius: 9rem;
    border: 1px solid rgb(255 255 255 / 0.14);
    background: rgb(255 255 255 / 0.06);
    transition:
      background 0.18s ease,
      border-color 0.18s ease;
  }

  .track i {
    position: absolute;
    top: 2rem;
    left: 2rem;
    width: 11rem;
    height: 11rem;
    border-radius: 50%;
    background: rgb(var(--ink) / 0.55);
    transition:
      transform 0.18s ease,
      background 0.18s ease;
  }

  .toggle:hover .track {
    border-color: rgb(var(--accent) / 0.5);
  }

  input:checked ~ .track {
    background: rgb(var(--accent) / 0.3);
    border-color: rgb(var(--accent) / 0.6);
  }

  input:checked ~ .track i {
    background: rgb(var(--accent));
    transform: translateX(13rem);
  }

  input:focus-visible ~ .track {
    outline: 2px solid rgb(var(--accent) / 0.8);
    outline-offset: 2px;
  }

  .toggle.pending .track,
  .toggle.pending .track i {
    opacity: 0.4;
  }

  @media (prefers-reduced-motion: reduce) {
    .track,
    .track i {
      transition: none;
    }
  }
</style>
