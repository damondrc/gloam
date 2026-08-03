<script lang="ts">
  /**
   * The disclosure panel.
   *
   * It sits below the horizon on purpose: the sky is the timer, the ground is
   * where the machinery lives. Controls laid over the gradient would be hard
   * to read and would break the one idea the backdrop is carrying.
   */
  interface Props {
    volume: number;
    onVolume: (value: number) => void;
  }

  let { volume, onVolume }: Props = $props();

  const percent = $derived(Math.round(volume * 100));
</script>

<div class="panel">
  <p class="section">Sound</p>

  <label class="row">
    <span class="name">Volume</span>
    <input
      type="range"
      min="0"
      max="100"
      step="1"
      value={percent}
      oninput={(event) => onVolume(Number(event.currentTarget.value) / 100)}
      aria-label="Volume"
    />
    <span class="value">{percent}%</span>
  </label>
</div>

<style>
  .panel {
    height: 100%;
    padding: 12rem 15rem;
    background: rgb(var(--ground));
    border-top: 1px solid rgb(var(--accent) / 0.16);
    border-radius: 0 0 var(--radius) var(--radius);
    /* Contents fade and settle into place while the container itself snaps, so
       the panel never animates against a window that resizes in one step. */
    animation: panel-in 0.26s ease both;
  }

  @keyframes panel-in {
    from {
      opacity: 0;
      transform: translateY(-6rem);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  .section {
    margin: 0 0 10rem;
    font-size: 9rem;
    font-weight: 600;
    letter-spacing: 0.2em;
    color: rgb(var(--accent) / 0.85);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 12rem;
  }

  .name {
    flex: 0 0 auto;
    min-width: 52rem;
    font-size: 11.5rem;
    color: rgb(var(--ink) / 0.78);
  }

  .value {
    flex: 0 0 auto;
    min-width: 30rem;
    text-align: right;
    font-size: 11rem;
    font-variant-numeric: tabular-nums;
    color: rgb(var(--ink) / 0.6);
  }

  input[type="range"] {
    flex: 1 1 auto;
    min-width: 0;
    height: 16rem;
    margin: 0;
    background: none;
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
  }

  input[type="range"]:focus-visible {
    outline: 2px solid rgb(var(--accent) / 0.8);
    outline-offset: 3px;
    border-radius: 3px;
  }

  /* Track and thumb have to be declared twice: the two engines do not accept
     each other's pseudo-elements, and a rule either browser cannot parse
     invalidates the whole selector list. */
  input[type="range"]::-webkit-slider-runnable-track {
    height: 3rem;
    border-radius: 2rem;
    background: rgb(var(--ink) / 0.18);
  }

  input[type="range"]::-moz-range-track {
    height: 3rem;
    border-radius: 2rem;
    background: rgb(var(--ink) / 0.18);
  }

  input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    -webkit-appearance: none;
    width: 11rem;
    height: 11rem;
    margin-top: -4rem;
    border: none;
    border-radius: 50%;
    background: rgb(var(--accent));
    box-shadow: 0 0 8rem rgb(var(--accent) / 0.55);
  }

  input[type="range"]::-moz-range-thumb {
    width: 11rem;
    height: 11rem;
    border: none;
    border-radius: 50%;
    background: rgb(var(--accent));
    box-shadow: 0 0 8rem rgb(var(--accent) / 0.55);
  }

  @media (prefers-reduced-motion: reduce) {
    .panel {
      animation: none;
    }
  }
</style>
