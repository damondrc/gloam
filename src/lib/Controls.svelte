<script lang="ts">
  interface Props {
    running: boolean;
    finished: boolean;
    onToggle: () => void;
    onReset: () => void;
    onSkip: () => void;
    /** Compact mode has room for one button; skip and reset stay on the
        keyboard rather than being crammed in at an unhittable size. */
    compact?: boolean;
  }

  let {
    running,
    finished,
    onToggle,
    onReset,
    onSkip,
    compact = false,
  }: Props = $props();
</script>

<div class="controls">
  <button
    class="primary"
    onclick={onToggle}
    title={running ? "Pause (Space)" : "Start (Space)"}
    aria-label={running ? "Pause" : "Start"}
  >
    {#if running}
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <rect x="4.5" y="3" width="2.5" height="10" rx="1" />
        <rect x="9" y="3" width="2.5" height="10" rx="1" />
      </svg>
    {:else}
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M5 3.4v9.2a.6.6 0 0 0 .92.5l7.2-4.6a.6.6 0 0 0 0-1l-7.2-4.6a.6.6 0 0 0-.92.5Z" />
      </svg>
    {/if}
  </button>

  {#if !compact}
    <button onclick={onSkip} disabled={finished} title="Skip segment (S)" aria-label="Skip segment">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3.5 3.6v8.8a.5.5 0 0 0 .77.42l6.4-4.4a.5.5 0 0 0 0-.84l-6.4-4.4a.5.5 0 0 0-.77.42Z" />
        <rect x="11.4" y="3.2" width="1.9" height="9.6" rx="0.9" />
      </svg>
    </button>

    <button onclick={onReset} title="Reset (R)" aria-label="Reset">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M8 3.2a4.8 4.8 0 1 1-4.53 6.36"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
        />
        <path d="M8 1.1v4.3L4.6 3.25Z" />
      </svg>
    </button>
  {/if}
</div>

<style>
  .controls {
    display: flex;
    align-items: center;
    gap: 6rem;
  }

  button {
    display: grid;
    place-items: center;
    width: 26rem;
    height: 26rem;
    padding: 0;
    border: 1px solid rgb(255 255 255 / 0.14);
    border-radius: 50%;
    background: rgb(255 255 255 / 0.07);
    color: rgb(var(--ink));
    cursor: pointer;
    backdrop-filter: blur(6px);
    transition:
      background 0.16s ease,
      border-color 0.16s ease,
      transform 0.16s ease,
      opacity 0.16s ease;
  }

  button:hover:not(:disabled) {
    background: rgb(255 255 255 / 0.16);
    border-color: rgb(255 255 255 / 0.26);
    transform: translateY(-1px);
  }

  button:active:not(:disabled) {
    transform: translateY(0) scale(0.94);
  }

  button:disabled {
    opacity: 0.3;
    cursor: default;
  }

  button:focus-visible {
    outline: 2px solid rgb(var(--accent) / 0.8);
    outline-offset: 2px;
  }

  .primary {
    width: 30rem;
    height: 30rem;
    background: rgb(var(--accent) / 0.22);
    border-color: rgb(var(--accent) / 0.45);
  }

  .primary:hover {
    background: rgb(var(--accent) / 0.34);
    border-color: rgb(var(--accent) / 0.7);
  }

  svg {
    width: 12rem;
    height: 12rem;
    fill: currentColor;
  }

  .primary svg {
    width: 13rem;
    height: 13rem;
  }
</style>
