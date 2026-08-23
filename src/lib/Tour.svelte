<script lang="ts">
  /**
   * The first-run tour, unfolded below the horizon.
   *
   * Same place and same mechanism as the settings panel, for a reason that is
   * not tidiness: the widget stays fully visible above it, so a step about the
   * padlock can light the padlock up while you read about it. A card laid over
   * the widget would be describing things it had just hidden.
   *
   * It is also why the tour is allowed to exist at all in an app whose whole
   * argument is not getting in the way. It appears once, it never covers
   * anything, and one click ends it.
   */
  import { TOUR } from "./tour";

  interface Props {
    step: number;
    onStep: (next: number) => void;
    onDone: () => void;
  }

  let { step, onStep, onDone }: Props = $props();

  const current = $derived(TOUR[step] ?? TOUR[0]);
  const first = $derived(step === 0);
  const last = $derived(step === TOUR.length - 1);
</script>

<div class="tour">
  <p class="say">{current.text}</p>

  <div class="foot">
    <!-- Where you are, without a number. Four dots is a length you can feel. -->
    <div class="dots" aria-label="Step {step + 1} of {TOUR.length}">
      {#each TOUR as _, i (i)}
        <i class:here={i === step}></i>
      {/each}
    </div>

    <!-- Ends the whole thing rather than stepping past it. Somebody who wants
         out wants out, not three more clicks of wanting out. -->
    <button class="skip" onclick={onDone}>Skip</button>

    <button
      class="arrow"
      onclick={() => onStep(step - 1)}
      disabled={first}
      aria-label="Previous"
    >
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <path d="M7.4 2.6 4 6l3.4 3.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <!-- The last step's forward arrow finishes, so the tour never needs a
         separate "done" button competing with Skip for the same corner. -->
    <button
      class="arrow"
      onclick={() => (last ? onDone() : onStep(step + 1))}
      aria-label={last ? "Finish" : "Next"}
    >
      {#if last}
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.6 6.4 5 8.8l4.4-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      {:else}
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M4.6 2.6 8 6l-3.4 3.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      {/if}
    </button>
  </div>
</div>

<style>
  .tour {
    height: 100%;
    padding: 12rem 15rem;
    display: flex;
    flex-direction: column;
    background: rgb(var(--ground));
    border-top: 1px solid rgb(var(--accent) / 0.16);
    border-radius: 0 0 var(--radius) var(--radius);
    animation: tour-in 0.26s ease both;
  }

  @keyframes tour-in {
    from {
      opacity: 0;
      transform: translateY(-6rem);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  .say {
    margin: 0;
    font-size: 11rem;
    line-height: 1.55;
    color: rgb(var(--ink) / 0.82);
  }

  /* Pushed to the bottom edge, so the controls sit in the same place on every
     step however long the sentence above them runs. A footer that moved would
     make the arrows something to look for each time. */
  .foot {
    margin-top: auto;
    padding-top: 10rem;
    display: flex;
    align-items: center;
    gap: 6rem;
  }

  .dots {
    display: flex;
    gap: 4rem;
    margin-right: auto;
  }

  .dots i {
    width: 4rem;
    height: 4rem;
    border-radius: 50%;
    background: rgb(var(--ink) / 0.22);
    transition: background 0.3s ease;
  }

  .dots i.here {
    background: rgb(var(--accent));
  }

  .skip {
    padding: 2rem 4rem;
    border: none;
    background: none;
    font-family: inherit;
    font-size: 9.5rem;
    letter-spacing: 0.06em;
    color: rgb(var(--ink) / 0.45);
    cursor: pointer;
    transition: color 0.16s ease;
  }

  .skip:hover {
    color: rgb(var(--ink) / 0.75);
  }

  .arrow {
    display: grid;
    place-items: center;
    width: 20rem;
    height: 18rem;
    padding: 0;
    border: none;
    border-radius: 6rem;
    background: rgb(255 255 255 / 0.08);
    color: rgb(var(--ink) / 0.8);
    cursor: pointer;
    transition:
      background 0.16s ease,
      opacity 0.16s ease;
  }

  .arrow:hover:not(:disabled) {
    background: rgb(255 255 255 / 0.18);
  }

  .arrow:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .arrow svg {
    width: 12rem;
    height: 12rem;
  }

  .skip:focus-visible,
  .arrow:focus-visible {
    outline: 2px solid rgb(var(--accent) / 0.8);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .tour {
      animation: none;
    }
  }
</style>
