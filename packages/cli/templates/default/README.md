# __GAME_TITLE__

A game built with [Glyphrogue](https://github.com/Rhapsydian/glyphrogue).

## Getting started

```bash
npm install
npm run dev
```

Opens `dev.html`: the game view alongside the Glyphrogue editor (map
editor, content browser, plugin management, and more) for authoring your
game live. `npm run build` produces a production build (`index.html`
only - the editor never ships).

## Project layout

- `src/maps/templates/` - hand-placed static rooms and generator-composed
  templates. `starter-room.json` is a minimal working example.
- `src/plugins/<pluginId>/` - one folder per plugin (entity types, rules,
  generators). `bootstrap.js` at the project root lists which plugins are
  active.
- `assets/fonts/` - font sources for the game's glyph tileset.
- `bootstrap.js` - hand-authored; add/remove plugins here, or via the
  editor's Plugin management tab.

## Deploying

**GitHub Pages** - already wired up: `.github/workflows/deploy-pages.yml`
deploys `npm run build`'s output on every push to `main`, once this repo
has Pages enabled (Settings -> Pages -> Source: GitHub Actions). No
secrets or setup required.

**itch.io** - build with the itch-specific relative base path, then push
with [butler](https://itch.io/docs/butler/):

```bash
npm run build:itch
butler push dist <your-itch-username>/<your-project>:html5
```

Requires `butler` installed and authenticated (`butler login`) and a
`BUTLER_API_KEY` if you're scripting this in CI - replace
`<your-itch-username>/<your-project>` with your actual itch.io project.
