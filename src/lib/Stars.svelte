<script lang="ts">
  /**
   * A fixed star field. Positions are generated once at module load rather than
   * per render, so the constellation stays put while its visibility fades in
   * and out with the sky.
   */
  interface Props {
    /** 0..1, driven by the sky state. */
    visible: number;
  }

  let { visible }: Props = $props();

  const STAR_COUNT = 46;

  const stars = Array.from({ length: STAR_COUNT }, () => ({
    // Kept above the horizon band.
    x: Math.random() * 100,
    y: Math.random() * 66,
    size: 0.7 + Math.random() * 1.5,
    // Stars near the top of the frame read as further away, so dimmer.
    base: 0.35 + Math.random() * 0.65,
    delay: -Math.random() * 9,
    duration: 5 + Math.random() * 7,
  }));
</script>

<div class="stars" style="opacity: {visible}" aria-hidden="true">
  {#each stars as star, i (i)}
    <span
      style="
        left: {star.x}%;
        top: {star.y}%;
        width: {star.size}px;
        height: {star.size}px;
        --base: {star.base};
        animation-delay: {star.delay}s;
        animation-duration: {star.duration}s;
      "
    ></span>
  {/each}
</div>

<style>
  .stars {
    position: absolute;
    inset: 0;
    pointer-events: none;
    transition: opacity 0.6s linear;
  }

  span {
    position: absolute;
    border-radius: 50%;
    background: #fff;
    animation-name: twinkle;
    animation-iteration-count: infinite;
    animation-timing-function: ease-in-out;
    will-change: opacity;
  }

  @keyframes twinkle {
    0%,
    100% {
      opacity: calc(var(--base) * 0.35);
    }
    50% {
      opacity: var(--base);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    span {
      animation: none;
      opacity: var(--base);
    }
  }
</style>
