<script lang="ts">
  /**
   * The disclosure panel.
   *
   * It sits below the horizon on purpose: the sky is the timer, the ground is
   * where the machinery lives. Controls laid over the gradient would be hard
   * to read and would break the one idea the backdrop is carrying.
   */
  import { TEST_FLOOR } from "./dev";
  import { LIMITS } from "./plan";
  import type { TimerConfig } from "./plan";
  import type { SoundSet } from "./sound";
  import type { Ambience } from "./ambience";
  import type { Horizon } from "./horizon";
  import Stepper from "./Stepper.svelte";
  import Toggle from "./Toggle.svelte";
  import Cycler from "./Cycler.svelte";
  import { folderName } from "./music";
  import { SHORTCUTS } from "./shortcuts";
  import { language } from "./i18n.svelte";

  /**
   * Four tabs, answering four questions: how long a run is, what the widget
   * is like to sit beside, what it plays, and what can be pressed.
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
  type Tab = "general" | "ambience" | "music" | "keys";

  // Music sits after Ambience because it is the same kind of question — what
  // this thing is like to sit beside — and before Keys, which stays last for
  // being the only tab that changes nothing.
  const TABS: readonly Tab[] = ["general", "ambience", "music", "keys"];

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
    /** Whether the session's startup list has an entry for Gloam. */
    atLogin: boolean;
    onAtLogin: (value: boolean) => void;
    /** False while the answer is still being read back from the platform. */
    atLoginKnown: boolean;
    /**
     * Whether there is a tray to start into, which decides what launching at
     * login actually looks like — and so what the line under it should say.
     */
    tray: boolean;
    /** The music folder, or null while none has been chosen. */
    musicFolder: string | null;
    /** How many playable files that folder turned out to hold. */
    musicCount: number;
    onPickFolder: () => void;
    musicVolume: number;
    onMusicVolume: (value: number) => void;
    shuffle: boolean;
    onShuffle: (value: boolean) => void;
    crossfade: boolean;
    onCrossfade: (value: boolean) => void;
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
    atLogin,
    onAtLogin,
    atLoginKnown,
    tray,
    musicFolder,
    musicCount,
    onPickFolder,
    musicVolume,
    onMusicVolume,
    shuffle,
    onShuffle,
    crossfade,
    onCrossfade,
    onTour,
  }: Props = $props();

  const t = $derived(language.messages);

  /**
   * What launching at login will actually do, which is not obvious and is
   * exactly the sort of thing somebody discovers by rebooting and concluding
   * the setting is broken.
   */
  const startupHint = $derived(tray ? t.panel.startsInTray : t.panel.startsOnScreen);

  // The options are the values in a fixed order; their names come from the
  // dictionary, so they follow a change of language like everything else.
  const AMBIENCE_OPTIONS = $derived(
    (["full", "calm", "light"] as const).map((value) => ({
      value,
      label: t.panel.backdrops[value],
    }))
  );

  /**
   * No hint line under this one, unlike the two above it.
   *
   * Those exist because "Calm" and "Felt" are a degree and a material, and
   * neither says on its own what it is good for. These are three nouns naming
   * three things, and a line explaining that Skyline is a skyline would be
   * furniture.
   */
  const HORIZON_OPTIONS = $derived(
    (["water", "skyline", "ridge"] as const satisfies readonly Horizon[]).map(
      (value) => ({ value, label: t.panel.horizons[value] })
    )
  );

  const SOUND_OPTIONS = $derived(
    (["bowl", "bell", "felt"] as const satisfies readonly SoundSet[]).map(
      (value) => ({ value, label: t.panel.sounds[value] })
    )
  );

  const percent = $derived(Math.round(volume * 100));
  const musicPercent = $derived(Math.round(musicVolume * 100));

  /**
   * What the folder row says under itself, which is the only place a folder
   * that has gone can be reported.
   *
   * A path stored last week is not a promise, and the difference between "this
   * folder holds nothing playable" and "this folder is no longer there" is not
   * one the widget can draw from a count of zero — so the line says both and
   * lets the person tell which.
   */
  const folderHint = $derived.by(() => {
    if (!musicFolder) return t.panel.noFolder;
    if (musicCount === 0) return t.panel.emptyFolder;
    return t.panel.tracks(musicCount);
  });

  function set(key: keyof TimerConfig, value: number): void {
    onConfig({ ...config, [key]: value });
  }
</script>

<div class="panel">
  <div class="tabs" role="tablist">
    {#each TABS as id (id)}
      <button
        role="tab"
        aria-selected={tab === id}
        class:active={tab === id}
        onclick={() => (tab = id)}
      >
        {t.panel.tabs[id]}
      </button>
    {/each}
  </div>

  {#if tab === "general"}
    <p class="section">
      {t.panel.cycle}
      {#if frozen}
        <span class="note">{t.panel.pauseToEdit}</span>
      {:else if willReset}
        <span class="note">{t.panel.changeRestarts}</span>
      {/if}
    </p>

    <div class="rows">
      <Stepper
        label={t.panel.focus}
        value={config.focusMinutes}
        {...LIMITS.focusMinutes}
        floor={TEST_FLOOR.focusMinutes}
        suffix={t.panel.minutes}
        disabled={frozen}
        onChange={(value) => set("focusMinutes", value)}
      />
      <Stepper
        label={t.panel.break}
        value={config.breakMinutes}
        {...LIMITS.breakMinutes}
        floor={TEST_FLOOR.breakMinutes}
        suffix={t.panel.minutes}
        disabled={frozen}
        onChange={(value) => set("breakMinutes", value)}
      />
      <Stepper
        label={t.panel.sessions}
        value={config.focusSessions}
        {...LIMITS.focusSessions}
        disabled={frozen}
        onChange={(value) => set("focusSessions", value)}
      />
    </div>

    <!-- A second heading rather than a fourth row under Cycle. How long a run
         is and whether the machine opens Gloam by itself are not the same
         question, and a run of controls with no seam between them invites the
         reader to assume they are. -->
    <p class="section apart">{t.panel.startup}</p>

    <div class="rows">
      <Toggle
        label={t.panel.launchAtLogin}
        checked={atLogin}
        pending={!atLoginKnown}
        onChange={onAtLogin}
      />

      <p class="hint">{startupHint}</p>
    </div>
  {:else if tab === "ambience"}
    <div class="rows">
      <label class="row">
        <span class="name">{t.panel.volume}</span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={percent}
          oninput={(event) => onVolume(Number(event.currentTarget.value) / 100)}
          aria-label={t.panel.volume}
        />
        <span class="value">{percent}%</span>
      </label>

      <!-- What it sounds like, then what it looks like, each followed by a
           line saying what the choice is for: the names are materials and
           degrees, and neither says on its own what it is good for. -->
      <Cycler
        label={t.panel.sound}
        value={sound}
        options={SOUND_OPTIONS}
        onChange={onSound}
      />

      <p class="hint">{t.panel.soundHints[sound]}</p>

      <Cycler
        label={t.panel.backdrop}
        value={ambience}
        options={AMBIENCE_OPTIONS}
        onChange={onAmbience}
      />

      <p class="hint">{t.panel.backdropHints[ambience]}</p>

      <!-- How much of the backdrop moves, then what the backdrop is of. Last
           because it is the one that changes least often: a horizon is picked
           once and lived with, where the other two get adjusted by mood. -->
      <Cycler
        label={t.panel.horizon}
        value={horizon}
        options={HORIZON_OPTIONS}
        onChange={onHorizon}
      />
    </div>
  {:else if tab === "music"}
    <div class="rows">
      <!-- The whole row is the button. A path is not a label with a control
           beside it — the path is what you press to change the path. -->
      <button class="folder" onclick={onPickFolder} title={musicFolder ?? ""}>
        <span class="name">{t.panel.folder}</span>
        <span class="path" class:empty={!musicFolder}>
          {musicFolder ? folderName(musicFolder) : t.panel.choose}
        </span>
      </button>

      <p class="hint">{folderHint}</p>

      <label class="row apart">
        <span class="name">{t.panel.volume}</span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={musicPercent}
          oninput={(event) =>
            onMusicVolume(Number(event.currentTarget.value) / 100)}
          aria-label={t.panel.musicVolume}
        />
        <span class="value">{musicPercent}%</span>
      </label>

      <!-- One line rather than two: the tab already says whose volume this
           is, and the two switches below need the room. -->
      <p class="hint">{t.panel.ducked}</p>

      <!-- Here rather than on the face. They are chosen once and lived with,
           which is what the panel is for; the face keeps only what gets
           pressed while listening. -->
      <Toggle label={t.panel.shuffle} checked={shuffle} onChange={onShuffle} />
      <Toggle label={t.panel.crossfade} checked={crossfade} onChange={onCrossfade} />
    </div>
  {:else}
    <!-- Reference rather than settings: the one tab with nothing to change.
         Which is why it can hold the way back to the tour without that
         reading as a setting either. -->
    <dl class="keys">
      {#each SHORTCUTS as row (row.id)}
        <dt>{t.shortcuts[row.id].keys}</dt>
        <dd>{t.shortcuts[row.id].does}</dd>
      {/each}
    </dl>

    <button class="again" onclick={onTour}>{t.panel.tourAgain}</button>
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

  /* A row that happens to be a button, because the path is the control: a
     folder is changed by pressing the folder, not by a Browse beside it. Only
     the path takes the colour of something pressable — the label stays a
     label, so the row still reads like the ones above it. */
  .folder {
    display: flex;
    align-items: center;
    gap: 12rem;
    width: 100%;
    padding: 0;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
  }

  .folder .path {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 11rem;
    color: rgb(var(--accent));
    border-bottom: 1px solid transparent;
    transition: border-color 0.16s ease;
  }

  .folder .path.empty {
    color: rgb(var(--ink) / 0.5);
  }

  .folder:hover .path {
    border-bottom-color: rgb(var(--accent) / 0.5);
  }

  .folder:focus-visible {
    outline: 2px solid rgb(var(--accent) / 0.8);
    outline-offset: 2px;
    border-radius: 3px;
  }

  /* The volume is a second question, not a fourth line about the folder. */
  .row.apart {
    margin-top: 10rem;
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

  /* Room above a heading that follows a group, so the seam between two groups
     is wider than the gap between the rows inside either of them. Without it
     the second heading reads as a label on the row above it. */
  .section.apart {
    margin-top: 14rem;
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
