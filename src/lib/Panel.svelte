<script lang="ts">
  /**
   * The disclosure panel.
   *
   * It sits below the horizon on purpose: the sky is the timer, the ground is
   * where the machinery lives. Controls laid over the gradient would be hard
   * to read and would break the one idea the backdrop is carrying.
   */
  import { tick } from "svelte";
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
  import { LANGUAGE_NAMES, LANGUAGE_PREFERENCES, language } from "./i18n.svelte";
  import type { LanguagePreference, Locale } from "./i18n.svelte";

  /**
   * Three tabs, split by how often each is reached for.
   *
   * Cycle is the one opened before a session, so it holds the three durations
   * and nothing else: no heading, since the tab already says what it is, and
   * nothing to scroll past on the way to a number. Music is the other thing
   * touched while working, and big enough to keep its own tab. Everything that
   * is set once and lived with goes behind Settings.
   *
   * There were four tabs before, General, Ambience, Music and Keys, and
   * General also carried the startup switch. That made the most frequent page
   * carry the least frequent setting, and it left no room for a fifth thing
   * without every tab growing by the height of it, because the panel is one
   * height for all of them.
   *
   * Note for anyone reading further down: `ambience` in the code below means
   * the backdrop's liveliness specifically, which is what it meant before the
   * word was borrowed for a group of settings. Its row is labelled Backdrop for
   * that reason.
   */
  type Tab = "cycle" | "music" | "settings";

  const TABS: readonly Tab[] = ["cycle", "music", "settings"];

  /**
   * Settings is an index, and each line opens a page of its own.
   *
   * Chosen over one long scrolling list and over sections that fold open in
   * place, after the three were drawn side by side. The index fits the panel
   * without scrolling and shows what each group is currently set to, so most
   * visits end there: the answer is read off the line without opening it.
   * The cost is one more click to change anything, which suits settings that
   * change rarely.
   *
   * Keys is a page here rather than a tab. It is still the only one with
   * nothing to change, and as the last line of an index it no longer sits
   * among controls, which is what earned it a tab of its own before.
   *
   * Neither the tab nor the page is remembered. Both are navigation, not
   * preference, and the panel is unmounted when it closes, so it always opens
   * on Cycle.
   */
  type Page = "ambience" | "language" | "startup" | "keys";

  // Language after Ambience and before Startup: the two most likely to be
  // looked for come first, and Keys stays last for changing nothing.
  const PAGES: readonly Page[] = ["ambience", "language", "startup", "keys"];

  let tab = $state<Tab>("cycle");
  let page = $state<Page | null>(null);

  function openTab(next: Tab): void {
    tab = next;
    page = null;
  }

  /**
   * Moves the focus along with the page, so somebody on the keyboard is not
   * dropped on the document when the button they pressed disappears. It lands
   * on the way back out of the page, and on the line they came from when they
   * return.
   */
  let backButton = $state<HTMLButtonElement | null>(null);
  const entries: Partial<Record<Page, HTMLButtonElement>> = $state({});

  async function openPage(next: Page | null): Promise<void> {
    const from = page;
    page = next;
    await tick();
    if (next) backButton?.focus({ preventScroll: true });
    else if (from) entries[from]?.focus({ preventScroll: true });
  }

  /**
   * Fades whichever edge of a scrolling page has more behind it, so the page
   * says it goes on without a scrollbar having to be noticed first.
   *
   * An action rather than a handler on the element, because the answer also
   * changes when the content does: a hint line that grows as a sound is picked
   * can make a page that fitted stop fitting.
   */
  function edges(node: HTMLElement) {
    const update = (): void => {
      node.classList.toggle("more-above", node.scrollTop > 1);
      node.classList.toggle(
        "more-below",
        node.scrollTop + node.clientHeight < node.scrollHeight - 1
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(node);
    for (const child of node.children) observer.observe(child);
    node.addEventListener("scroll", update, { passive: true });
    update();
    return {
      destroy(): void {
        observer.disconnect();
        node.removeEventListener("scroll", update);
      },
    };
  }

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
    /** "system", or the language chosen here. */
    languagePreference: LanguagePreference;
    /** What the system alone would pick, so "System" can say what it means. */
    systemLanguage: Locale;
    onLanguage: (value: LanguagePreference) => void;
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
    languagePreference,
    systemLanguage,
    onLanguage,
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

  /**
   * Every language under its own name, whatever the interface is speaking;
   * see `LANGUAGE_NAMES`. Only "System" is translated, since it is the one
   * option that is a word rather than a language.
   */
  const languageLabel = (value: LanguagePreference): string =>
    value === "system" ? t.panel.system : LANGUAGE_NAMES[value];

  const LANGUAGE_OPTIONS = $derived(
    LANGUAGE_PREFERENCES.map((value) => ({ value, label: languageLabel(value) }))
  );

  /**
   * "System" on its own leaves open which language that is, so the line
   * under it answers. A language picked by hand gets a line saying it will
   * stay, because the difference between the two is exactly what somebody
   * will wonder about the next time the system changes.
   */
  const languageHint = $derived(
    languagePreference === "system"
      ? t.panel.followsSystem(LANGUAGE_NAMES[systemLanguage])
      : t.panel.keepsLanguage
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

  /**
   * What each line of the index says it is set to, which is most of the
   * reason for an index: the answer without opening the page. Keys has
   * nothing to report. Startup says nothing until the platform has answered,
   * rather than guessing and then correcting itself.
   */
  const summaries = $derived<Record<Page, string>>({
    ambience: [
      t.panel.sounds[sound],
      t.panel.backdrops[ambience],
      t.panel.horizons[horizon],
    ].join(" · "),
    language: languageLabel(languagePreference),
    startup: atLoginKnown ? (atLogin ? t.panel.on : t.panel.off) : "",
    keys: "",
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
        onclick={() => openTab(id)}
      >
        {t.panel.tabs[id]}
      </button>
    {/each}
  </div>

  {#if tab === "cycle"}
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

      <!-- Under the rows rather than beside a heading, now that there is no
           heading. It says what a change is about to cost, rather than
           letting somebody discover it by losing a session. -->
      {#if frozen}
        <p class="hint note">{t.panel.pauseToEdit}</p>
      {:else if willReset}
        <p class="hint note">{t.panel.changeRestarts}</p>
      {/if}
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
    <!-- The one part of the panel that may be taller than the panel. Keyed
         on the page so each one starts at the top and the fades are worked
         out again for what it holds. -->
    <div class="body">
      {#key page}
        <div class="scroll" use:edges>
          {#if page === null}
            <div class="index">
              {#each PAGES as id (id)}
                <button
                  class="entry"
                  bind:this={entries[id]}
                  onclick={() => openPage(id)}
                >
                  <span class="entry-name">{t.panel.pages[id]}</span>
                  <span class="entry-value">{summaries[id]}</span>
                  <svg viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M4.6 2.6 8 6l-3.4 3.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
              {/each}
            </div>
          {:else}
            <!-- The page's own name is the way back, where a heading would
                 otherwise be: one element doing both jobs instead of two
                 competing for the top line. -->
            <button
              class="back"
              bind:this={backButton}
              onclick={() => openPage(null)}
              aria-label={t.panel.back}
            >
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="M7.4 2.6 4 6l3.4 3.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              {t.panel.pages[page]}
            </button>

            {#if page === "ambience"}
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

                <!-- What it sounds like, then what it looks like, each
                     followed by a line saying what the choice is for: the
                     names are materials and degrees, and neither says on its
                     own what it is good for. -->
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

                <!-- How much of the backdrop moves, then what the backdrop is
                     of. Last because it is the one that changes least often:
                     a horizon is picked once and lived with, where the other
                     two get adjusted by mood. -->
                <Cycler
                  label={t.panel.horizon}
                  value={horizon}
                  options={HORIZON_OPTIONS}
                  onChange={onHorizon}
                />
              </div>
            {:else if page === "language"}
              <!-- Changes the moment it is cycled, this page included, so the
                   choice is judged by reading it rather than by trusting a
                   name. -->
              <div class="rows">
                <Cycler
                  label={t.panel.pages.language}
                  value={languagePreference}
                  options={LANGUAGE_OPTIONS}
                  onChange={onLanguage}
                />

                <p class="hint">{languageHint}</p>
              </div>
            {:else if page === "startup"}
              <div class="rows">
                <Toggle
                  label={t.panel.launchAtLogin}
                  checked={atLogin}
                  pending={!atLoginKnown}
                  onChange={onAtLogin}
                />

                <p class="hint">{startupHint}</p>
              </div>
            {:else}
              <!-- Reference rather than settings: the one page with nothing to
                   change. Which is why it can hold the way back to the tour
                   without that reading as a setting either. -->
              <dl class="keys">
                {#each SHORTCUTS as row (row.id)}
                  <dt>{t.shortcuts[row.id].keys}</dt>
                  <dd>{t.shortcuts[row.id].does}</dd>
                {/each}
              </dl>

              <button class="again" onclick={onTour}>{t.panel.tourAgain}</button>
            {/if}
          {/if}
        </div>
      {/key}
    </div>
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

  /* Not pulled up like the other hints: it belongs to all three rows, not to
     the one above it. */
  .hint.note {
    margin-top: 2rem;
  }

  /* --- settings: a scrolling body inside the fixed height --------------- */

  .body {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
  }

  /* The scrollbar sits in the panel's right padding rather than eating into
     the rows, so a page that scrolls is laid out exactly like one that
     does not. */
  .scroll {
    position: absolute;
    inset: 0;
    margin-right: -9rem;
    padding-right: 9rem;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: rgb(var(--ink) / 0.22) transparent;
  }

  .scroll::-webkit-scrollbar {
    width: 4rem;
  }

  .scroll::-webkit-scrollbar-thumb {
    border-radius: 2rem;
    background: rgb(var(--ink) / 0.22);
  }

  /* Prefixed and unprefixed: WebKitGTK still wants the prefix. See `edges`. */
  .scroll:global(.more-below) {
    -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 18rem), transparent);
    mask-image: linear-gradient(to bottom, #000 calc(100% - 18rem), transparent);
  }

  .scroll:global(.more-above) {
    -webkit-mask-image: linear-gradient(to bottom, transparent, #000 18rem);
    mask-image: linear-gradient(to bottom, transparent, #000 18rem);
  }

  .scroll:global(.more-above.more-below) {
    -webkit-mask-image: linear-gradient(
      to bottom,
      transparent,
      #000 18rem,
      #000 calc(100% - 18rem),
      transparent
    );
    mask-image: linear-gradient(
      to bottom,
      transparent,
      #000 18rem,
      #000 calc(100% - 18rem),
      transparent
    );
  }

  .scroll > :last-child {
    margin-bottom: 4rem;
  }

  .index {
    display: flex;
    flex-direction: column;
  }

  /* A line of the index: the name, what it is set to, and an arrow saying it
     opens. Ruled apart rather than spaced apart, so the four read as one list
     and not as four controls. */
  .entry {
    display: flex;
    align-items: center;
    gap: 8rem;
    width: 100%;
    padding: 7rem 0;
    border: none;
    border-top: 1px solid rgb(var(--ink) / 0.08);
    background: none;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
  }

  .entry:first-child {
    border-top: none;
    padding-top: 0;
  }

  .entry-name {
    flex: 0 0 auto;
    font-size: 11.5rem;
    color: rgb(var(--ink) / 0.85);
    transition: color 0.16s ease;
  }

  .entry-value {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    text-align: right;
    font-size: 10.5rem;
    color: rgb(var(--ink) / 0.45);
  }

  .entry svg,
  .back svg {
    flex: 0 0 auto;
    width: 10rem;
    height: 10rem;
    color: rgb(var(--ink) / 0.5);
  }

  .entry:hover .entry-name {
    color: rgb(var(--accent));
  }

  .entry:focus-visible,
  .back:focus-visible {
    outline: 2px solid rgb(var(--accent) / 0.8);
    outline-offset: 2px;
    border-radius: 3px;
  }

  /* The page's name, set like the headings the panel used to have, and the
     way back to the index at the same time. */
  .back {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 4rem;
    margin: 0 0 9rem;
    padding: 0;
    border: none;
    background: none;
    font-family: inherit;
    font-size: 9rem;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgb(var(--accent) / 0.85);
    cursor: pointer;
    transition: color 0.16s ease;
  }

  .back svg {
    color: currentColor;
  }

  .back:hover {
    color: rgb(var(--accent));
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
