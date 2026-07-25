<script lang="ts">
  /**
   * Film grain.
   *
   * This is the single cheapest thing that separates "lofi" from "sterile flat
   * design". A pure CSS gradient reads as a UI panel; the same gradient under a
   * faint layer of noise reads as an image. Generated once into a data URL and
   * tiled, so it costs one 128x128 canvas at startup and nothing after that.
   */
  const TILE = 128;

  function makeNoise(): string {
    const canvas = document.createElement("canvas");
    canvas.width = TILE;
    canvas.height = TILE;

    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    const image = ctx.createImageData(TILE, TILE);
    const { data } = image;

    for (let i = 0; i < data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }

    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  }

  let url = $state("");

  $effect(() => {
    url = makeNoise();
  });
</script>

{#if url}
  <div
    class="grain"
    style="background-image: url({url}); background-size: {TILE}px {TILE}px;"
    aria-hidden="true"
  ></div>
{/if}

<style>
  .grain {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.09;
    mix-blend-mode: overlay;
  }
</style>
