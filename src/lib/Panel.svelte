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
  import type { AlarmPattern, ButtonSet, Timbre } from "./sound";
  import type { Ambience } from "./ambience";
  import Stepper from "./Stepper.svelte";
  import Cycler from "./Cycler.svelte";

  /**
   * Tabs rather than one long column. Stacked, the sections had grown past
   * 280 design pixels, which at 180% scale is most of a laptop screen — and
   * the scene editor still has to fit somewhere. Tabs also group by question:
   * how long, how it sounds, how alive the backdrop is.
   */
  type Tab = "general" | "sound" | "ambience";

  const TABS: readonly { id: Tab; label: string }[] = [
    { id: "general", label: "General" },
    { id: "sound", label: "Sound" },
    { id: "ambience", label: "Backdrop" },
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
    timbre: Timbre;
    onTimbre: (value: Timbre) => void;
    pattern: AlarmPattern;
    onPattern: (value: AlarmPattern) => void;
    buttons: ButtonSet;
    onButtons: (value: ButtonSet) => void;
    ambience: Ambience;
    onAmbience: (value: Ambience) => void;
  }

  let {
    config,
    onConfig,
    frozen,
    willReset,
    volume,
    onVolume,
    timbre,
    onTimbre,
    pattern,
    onPattern,
    buttons,
    onButtons,
    ambience,
    onAmbience,
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

  const TIMBRE_OPTIONS = [
    { value: "bowl", label: "Bowl" },
    { value: "bell", label: "Bell" },
    { value: "marimba", label: "Marimba" },
    { value: "pulse", label: "Pulse" },
  ] as const satisfies readonly { value: Timbre; label: string }[];

  const PATTERN_OPTIONS = [
    { value: "fifth", label: "Fifth" },
    { value: "triad", label: "Triad" },
    { value: "echo", label: "Echo" },
  ] as const satisfies readonly { value: AlarmPattern; label: string }[];

  const BUTTON_OPTIONS = [
    { value: "bowl", label: "Bowl" },
    { value: "felt", label: "Felt" },
    { value: "string", label: "String" },
    { value: "drop", label: "Drop" },
  ] as const satisfies readonly { value: ButtonSet; label: string }[];

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
  {:else if tab === "sound"}
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

      <Cycler
        label="Alarm"
        value={timbre}
        options={TIMBRE_OPTIONS}
        onChange={onTimbre}
      />

      <Cycler
        label="Pattern"
        value={pattern}
        options={PATTERN_OPTIONS}
        onChange={onPattern}
      />

      <Cycler
        label="Buttons"
        value={buttons}
        options={BUTTON_OPTIONS}
        onChange={onButtons}
      />
    </div>
  {:else}
    <div class="rows">
      <Cycler
        label="Ambience"
        value={ambience}
        options={AMBIENCE_OPTIONS}
        onChange={onAmbience}
      />
      <p class="hint">{AMBIENCE_HINTS[ambience]}</p>
    </div>
  {/if}
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

  .hint {
    margin: 2rem 0 0;
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
