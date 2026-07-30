<script lang="ts">
  /**
   * The resize handle. Deliberately not a button: it has no click behaviour,
   * only a drag, so it is exposed as a slider that the keyboard can also
   * drive.
   */
  interface Props {
    value: number;
    min: number;
    max: number;
    dragging: boolean;
    onBegin: (event: PointerEvent) => void;
    onMove: (event: PointerEvent) => void;
    onEnd: (event: PointerEvent) => void;
    onNudge: (delta: number) => void;
    onReset: () => void;
  }

  let {
    value,
    min,
    max,
    dragging,
    onBegin,
    onMove,
    onEnd,
    onNudge,
    onReset,
  }: Props = $props();

  function onKeydown(event: KeyboardEvent): void {
    const step = event.shiftKey ? 0.2 : 0.05;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        event.preventDefault();
        onNudge(step);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        event.preventDefault();
        onNudge(-step);
        break;
      case "Home":
        event.preventDefault();
        onReset();
        break;
    }
  }
</script>

<div
  class="grip"
  class:dragging
  role="slider"
  tabindex="0"
  aria-label="Widget size"
  aria-valuemin={min}
  aria-valuemax={max}
  aria-valuenow={value}
  aria-valuetext="{Math.round(value * 100)} percent"
  onpointerdown={onBegin}
  onpointermove={onMove}
  onpointerup={onEnd}
  onpointercancel={onEnd}
  ondblclick={onReset}
  onkeydown={onKeydown}
  title="Drag to resize · double-click to reset"
>
  <svg viewBox="0 0 14 14" aria-hidden="true">
    <path
      d="M13 5 5 13M13 9.5 9.5 13"
      fill="none"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linecap="round"
    />
  </svg>
</div>

<style>
  .grip {
    position: absolute;
    right: 4rem;
    bottom: 4rem;
    display: grid;
    place-items: center;
    width: 16rem;
    height: 16rem;
    color: rgb(var(--ink) / 0.5);
    cursor: nwse-resize;
    touch-action: none;
    transition:
      color 0.16s ease,
      transform 0.16s ease;
  }

  .grip:hover,
  .grip.dragging {
    color: rgb(var(--accent));
    transform: scale(1.12);
  }

  .grip:focus-visible {
    outline: 2px solid rgb(var(--accent) / 0.8);
    outline-offset: 1px;
    border-radius: 3px;
  }

  svg {
    width: 11rem;
    height: 11rem;
  }
</style>
