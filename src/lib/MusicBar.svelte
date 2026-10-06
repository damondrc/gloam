<script lang="ts">
  /**
   * The transport, on the widget's face.
   *
   * Folder and volume live in the panel because they are chosen once. These
   * are the opposite: skipping a track is the most frequent thing anybody does
   * to a music player, and routing it through two clicks and a panel would
   * make it the most annoying.
   *
   * It lives in the top strip, which is the only part of the face with room —
   * and, as it turns out, the right place anyway. The timer's own play button
   * is in the bottom corner, and two play buttons within an inch of each other
   * would be a widget you have to read before pressing. Distance is doing more
   * work here than any icon could.
   *
   * Lighter than the timer's controls on purpose: smaller, no border, less
   * contrast. The hierarchy is the point — this is a timer that can play
   * music, and the controls should say so before anybody reads them.
   */
  interface Props {
    /** The current track, without path or extension, or null for none. */
    name: string | null;
    playing: boolean;
    onPrevious: () => void;
    onToggle: () => void;
    onNext: () => void;
  }

  let { name, playing, onPrevious, onToggle, onNext }: Props = $props();
</script>

<div class="music">
  <button onclick={onPrevious} title="Previous track" aria-label="Previous track">
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3.4" y="4" width="1.6" height="8" rx="0.8" />
      <path d="M12.6 4.5v7a.5.5 0 0 1-.78.41l-5-3.5a.5.5 0 0 1 0-.82l5-3.5a.5.5 0 0 1 .78.41Z" />
    </svg>
  </button>

  <button
    onclick={onToggle}
    title={playing ? "Pause music" : "Play music"}
    aria-label={playing ? "Pause music" : "Play music"}
  >
    {#if playing}
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <rect x="5" y="3.6" width="2" height="8.8" rx="0.8" />
        <rect x="9" y="3.6" width="2" height="8.8" rx="0.8" />
      </svg>
    {:else}
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M5.4 3.9v8.2a.5.5 0 0 0 .77.42l6.2-4.1a.5.5 0 0 0 0-.84l-6.2-4.1a.5.5 0 0 0-.77.42Z" />
      </svg>
    {/if}
  </button>

  <button onclick={onNext} title="Next track" aria-label="Next track">
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.4 4.5v7a.5.5 0 0 0 .78.41l5-3.5a.5.5 0 0 0 0-.82l-5-3.5a.5.5 0 0 0-.78.41Z" />
      <rect x="11" y="4" width="1.6" height="8" rx="0.8" />
    </svg>
  </button>

  <!-- After the buttons: the control, then what it is controlling. The title
       carries the whole name for anything the ellipsis eats. -->
  {#if name}
    <span class="name" title={name}>{name}</span>
  {/if}
</div>

<style>
  /* Between the phase label and the padlock, which is the only clear span on
     the face. Bounded on both sides rather than sized, so the name gives way
     before it can reach either of them. */
  .music {
    position: absolute;
    top: 8rem;
    left: 94rem;
    right: 34rem;
    display: flex;
    align-items: center;
    gap: 4rem;
  }

  button {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: 19rem;
    height: 19rem;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: rgb(255 255 255 / 0.07);
    color: rgb(var(--ink) / 0.8);
    cursor: pointer;
    transition:
      background 0.16s ease,
      color 0.16s ease,
      transform 0.16s ease;
  }

  button:hover {
    background: rgb(255 255 255 / 0.16);
    color: rgb(var(--ink));
  }

  button:active {
    transform: scale(0.92);
  }

  button:focus-visible {
    outline: 2px solid rgb(var(--accent) / 0.8);
    outline-offset: 2px;
  }

  svg {
    width: 11rem;
    height: 11rem;
    fill: currentColor;
  }

  /* Quieter than the phase label, which keeps the accent colour: two things
     in the same strip both asking to be read first is one too many. */
  .name {
    flex: 1 1 auto;
    min-width: 0;
    margin-left: 3rem;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 9.5rem;
    letter-spacing: 0.02em;
    color: rgb(var(--ink) / 0.62);
    text-shadow: 0 1rem 6rem rgb(0 0 0 / 0.5);
  }
</style>
