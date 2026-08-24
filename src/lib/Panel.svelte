<script lang="ts">
  /**
   * The disclosure panel.
   *
   * It sits below the horizon on purpose: the sky is the timer, the ground is
   * where the machinery lives. Controls laid over the gradient would be hard
   * to read and would break the one idea the backdrop is carrying.
   */
  import { LIMITS } from "./plan";
  import type { TimerConfig } from "./plan";
  import type { SoundSet } from "./sound";
  import type { Ambience } from "./ambience";
  import type { Horizon } from "./horizon";
  import Stepper from "./Stepper.svelte";
  import Cycler from "./Cycler.svelte";
  import { SHORTCUTS } from "./shortcuts";

  /**
   * Three tabs, answering three questions: how long a run is, what the widget
   * is like to sit beside, and what can be pressed.
   *
   * Sound and the backdrop were once apart and are now together, because they
   * were separated by the order they were built in rather than by anything a
   * person choosing between them would notice — both answer "how much of
   * itself should this thing make me aware of".
   *
   * Keys went the other way and earned a tab of its own, because it is not a
   * setting at all. It is the only tab with nothing to change, and folding a
   * reference table into a page of controls would have made both worse.
   *
   * Tabs at all, rather than one column, because stacked the sections run past
   * 280 design pixels, which at 180% scale is most of a laptop screen.
   *
   * Note for anyone reading further down: `ambience` in the code below means
   * the backdrop's liveliness specifically, which is what it meant before this
   * tab took the broader name. Its row is labelled Backdrop for that reason.
   */
  type Tab = "general" | "ambience" | "keys";

  const TABS: readonly { id: Tab; label: string }[] = [
    { id: "general", label: "General" },
    { id: "ambience", label: "Ambience" },
    { id: "keys", label: "Keys" },
  ];

  let tab = $state<Tab>("general");

  interface Props {
    config: TimerConfig;
    onConfig: (next: TimerConfig) => void;
    /** True while the timer is running: durations are frozen. */
    frozen: boolean;
    /** True when applying a change would discard progress already made. */
    willReset: boolean;
    volume: number;
    onVolume: (value: number) => void;
    sound: SoundSet;
    onSound: (value: SoundSet) => void;
    ambience: Ambience;
    onAmbience: (value: Ambience) => void;
    horizon: Horizon;
    onHorizon: (value: Horizon) => void;
    /** Starts the first-run tour again, for anyone who wants it back. */
    onTour: () => void;
  }

  let {
    config,
    onConfig,
    frozen,
    willReset,
    volume,
    onVolume,
    sound,
    onSound,
    ambience,
    onAmbience,
    horizon,
    onHorizon,
    onTour,
  }: Props = $props();

  const AMBIENCE_OPTIONS = [
    { value: "full", label: "Full" },
    { value: "calm", label: "Calm" },
    { value: "light", label: "Light" },
  ] as const satisfies readonly { value: Ambience; label: string }[];

  /** Says what each mode is for, since the names alone do not. */
  const AMBIENCE_HINTS: Record<Ambience, string> = {
    full: "Clouds and the occasional flock.",
    calm: "Clouds only. Nothing crosses quickly.",
    light: "A flat sky, for a modest machine.",
  };

  /**
   * No hint line under this one, unlike the two above it.
   *
   * Those exist because "Calm" and "Felt" are a degree and a material, and
   * neither says on its own what it is good for. These are three nouns naming
   * three things, and a line explaining that Skyline is a skyline would be
   * furniture.
   */
  const HORIZON_OPTIONS = [
    { value: "water", label: "Water" },
    { value: "skyline", label: "Skyline" },
    { value: "ridge", label: "Ridge" },
  ] as const satisfies readonly { value: Horizon; label: string }[];

  const SOUND_OPTIONS = [
    { value: "bowl", label: "Bowl" },
    { value: "bell", label: "Bell" },
    { value: "felt", label: "Felt" },
  ] as const satisfies readonly { value: SoundSet; label: string }[];

  /** Says what each set is for, since the material alone does not. */
  const SOUND_HINTS: Record<SoundSet, string> = {
    bowl: "The widget's own voice. Warm, and slow to fade.",
    bell: "Metal, announced in three notes. Hard to miss.",
    felt: "Wood and felt, fading into itself. Barely there.",
  };

  const percent = $derived(Math.round(volume * 100));

  function set(key: keyof TimerConfig, value: number): void {
    onConfig({ ...config, [key]: value });
  }
</script>

<div class="panel">
  <div class="tabs" role="tablist">
    {#each TABS as item (item.id)}
      <button
        role="tab"
        aria-selected={tab === item.id}
        class:active={tab === item.id}
        onclick={() => (tab = item.id)}
      >
        {item.label}
      </button>
    {/each}
  </div>

  {#if tab === "general"}
    <p class="section">
      Cycle
      {#if frozen}
        <span class="note">pause to edit</span>
      {:else if willReset}
        <span class="note">changing restarts the run</span>
      {/if}
    </p>

    <div class="rows">
      <Stepper
        label="Focus"
        value={config.focusMinutes}
        {...LIMITS.focusMinutes}
        suffix=" min"
        disabled={frozen}
        onChange={(value) => set("focusMinutes", value)}
      />
      <Stepper
        label="Break"
        value={config.breakMinutes}
        {...LIMITS.breakMinutes}
        suffix=" min"
        disabled={frozen}
        onChange={(value) => set("breakMinutes", value)}
      />
      <Stepper
        label="Sessions"
        value={config.focusSessions}
        {...LIMITS.focusSessions}
        disabled={frozen}
        onChange={(value) => set("focusSessions", value)}
      />
    </div>
  {:else if tab === "ambience"}
    <div class="rows">
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

      <!-- What it sounds like, then what it looks like, each followed by a
           line saying what the choice is for: the names are materials and
           degrees, and neither says on its own what it is good for. -->
      <Cycler
        label="Sound"
        value={sound}
        options={SOUND_OPTIONS}
        onChange={onSound}
      />

      <p class="hint">{SOUND_HINTS[sound]}</p>

      <Cycler
        label="Backdrop"
        value={ambience}
        options={AMBIENCE_OPTIONS}
        onChange={onAmbience}
      />

      <p class="hint">{AMBIENCE_HINTS[ambience]}</p>

      <!-- How much of the backdrop moves, then what the backdrop is of. Last
           because it is the one that changes least often: a horizon is picked
           once and lived with, where the other two get adjusted by mood. -->
      <Cycler
        label="Horizon"
        value={horizon}
        options={HORIZON_OPTIONS}
        onChange={onHorizon}
      />
    </div>
  {:else}
    <!-- Reference rather than settings: the one tab with nothing to change.
         Which is why it can hold the way back to the tour without that
         reading as a setting either. -->
    <dl class="keys">
      {#each SHORTCUTS as row (row.keys)}
        <dt>{row.keys}</dt>
        <dd>{row.does}</dd>
      {/each}
    </dl>

    <button class="again" onclick={onTour}>Show the tour again</button>
  {/if}
</div>

<style>
  .panel {
    height: 100%;
    display: flex;
    flex-direction: column;
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

  .tabs {
    display: flex;
    gap: 4rem;
    margin: 0 0 12rem;
    border-bottom: 1px solid rgb(var(--ink) / 0.1);
  }

  .tabs button {
    padding: 0 8rem 6rem;
    border: none;
    border-bottom: 1.5px solid transparent;
    background: none;
    font-size: 9.5rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgb(var(--ink) / 0.4);
    cursor: pointer;
    transition:
      color 0.16s ease,
      border-color 0.16s ease;
  }

  .tabs button:hover {
    color: rgb(var(--ink) / 0.7);
  }

  .tabs button.active {
    color: rgb(var(--accent));
    border-bottom-color: rgb(var(--accent));
  }

  .tabs button:focus-visible {
    outline: 2px solid rgb(var(--accent) / 0.8);
    outline-offset: 2px;
  }

  /* Pulled up against the row it explains. With the list's own gap on both
     sides a hint sits equidistant between two rows and reads as belonging to
     neither, which matters now that there are two of them. */
  .keys {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 3rem 12rem;
    margin: 0;
    font-size: 10rem;
  }

  .keys dt {
    color: rgb(var(--accent) / 0.85);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .keys dd {
    margin: 0;
    color: rgb(var(--ink) / 0.7);
  }

  /* A line of text rather than a button with a box around it. Nothing here is
     a setting, and a filled control would look like one. */
  .again {
    align-self: flex-start;
    margin-top: 10rem;
    padding: 0;
    border: none;
    background: none;
    font-family: inherit;
    font-size: 9.5rem;
    letter-spacing: 0.04em;
    color: rgb(var(--ink) / 0.45);
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 3px;
    transition: color 0.16s ease;
  }

  .again:hover {
    color: rgb(var(--ink) / 0.8);
  }

  .again:focus-visible {
    outline: 2px solid rgb(var(--accent) / 0.8);
    outline-offset: 2px;
  }

  .hint {
    margin: -3rem 0 0;
    font-size: 9.5rem;
    line-height: 1.4;
    color: rgb(var(--ink) / 0.45);
  }

  .section {
    display: flex;
    align-items: baseline;
    gap: 8rem;
    margin: 0 0 9rem;
    font-size: 9rem;
    font-weight: 600;
    letter-spacing: 0.2em;
    color: rgb(var(--accent) / 0.85);
  }

  /* Says out loud what a change is about to cost, rather than letting the user
     discover it by losing a session. */
  .note {
    font-size: 8.5rem;
    font-weight: 400;
    letter-spacing: 0.04em;
    text-transform: none;
    color: rgb(var(--ink) / 0.45);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: 7rem;
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
