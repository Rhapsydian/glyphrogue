// Export payload assembly for the map editor (docs/design/editor.md: "Map
// editor") - two shapes, both plain JSON per that section's own reasoning
// (no logic, simpler file-write mechanics, easier to hand-inspect):
// a template fragment (a ZoneDTO slice, stampTemplate-compatible later) and
// a seed+params preset. Kept as pure logic, separate from MapEditor.svelte,
// same split narrowForm.js/pluginCatalog.js already use for their own
// parse/validate logic.
const EXPORT_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;

function withinBounds(x, y, bounds) {
  return x >= bounds.x && x < bounds.x + bounds.width && y >= bounds.y && y < bounds.y + bounds.height;
}

// bounds optional - defaults to the whole zone (export what's on screen
// when nothing is pinned, reusing pin/lock's own selection rather than a
// second selection mechanism, per the plan's judgment call). Cells/
// entities/anchors are rebased to the fragment's own 0,0-local origin so
// the result is directly stampTemplate-compatible. logicalLinks is always
// [] - no built-in generator populates them, and partial-bounds link
// translation has no evidence of need yet.
export function buildTemplateFragment(zone, bounds) {
  const region = bounds ?? { x: 0, y: 0, width: zone.width, height: zone.height };

  const cells = new Array(region.width * region.height);
  for (let y = 0; y < region.height; y++) {
    for (let x = 0; x < region.width; x++) {
      cells[y * region.width + x] = zone.cells[(region.y + y) * zone.width + (region.x + x)];
    }
  }

  const entities = zone.entities
    .filter((entity) => withinBounds(entity.x, entity.y, region))
    .map((entity) => ({ ...entity, x: entity.x - region.x, y: entity.y - region.y }));

  const anchors = (zone.anchors ?? [])
    .filter((anchor) => withinBounds(anchor.x, anchor.y, region))
    .map((anchor) => ({ ...anchor, x: anchor.x - region.x, y: anchor.y - region.y }));

  return { width: region.width, height: region.height, cells, entities, anchors, logicalLinks: [] };
}

export function buildSeedPreset({ generatorId, seed, params }) {
  return { generatorId, seed, params };
}

// Mirrors devServerPlugin.js's isValidPluginId hygiene, redefined locally
// since that module is Node-only and can't be imported into browser code.
export function isValidExportName(name) {
  return typeof name === 'string' && EXPORT_NAME_PATTERN.test(name);
}

export function templatePath(name) {
  return `src/maps/templates/${name}.json`;
}

export function presetPath(name) {
  return `src/maps/presets/${name}.json`;
}
