<script>
  // The shared "live preview surface" (docs/design/editor.md: "Shared
  // live-preview rendering primitive") - a thin wrapper around
  // @glyphrogue/core's paintLayer, the one generic { col, row, text, color,
  // background? } command shape every consumer (calibration grid,
  // assembled-tile authoring, palette swatch, map editor zone preview)
  // already produces via drawTileCell. This component owns nothing but
  // canvas mounting and redraw wiring - callers compute commands from
  // whatever tentative, not-yet-saved tool state they're tuning; core has
  // no idea a "preview" exists at all.
  import { cellSize, paintLayer } from '@glyphrogue/core';

  let { commands, cols, rows, metrics, fontFamily, palette } = $props();

  let canvas = $state();
  let ctx;

  // No dirty-tracking: a preview redrawing in full on every prop change
  // (every keystroke/slider move) is cheap at these sizes and isn't a live
  // game loop - renderLayers.js's layered dirty-tracking is for the actual
  // camera viewport, not this.
  $effect(() => {
    if (!canvas) return;
    ctx ??= canvas.getContext('2d');
    const size = cellSize(metrics);
    paintLayer(ctx, metrics, size, fontFamily, commands, {
      clear: true,
      viewportPixelWidth: cols * size.width,
      viewportPixelHeight: rows * size.height,
      palette,
    });
  });
</script>

<canvas bind:this={canvas} width={cols * cellSize(metrics).width} height={rows * cellSize(metrics).height}
></canvas>

<style>
  canvas {
    display: block;
    border: 1px solid #444;
  }
</style>
