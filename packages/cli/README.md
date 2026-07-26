# create-glyphrogue-game

Scaffolding CLI for new Glyphrogue game projects.

```bash
npm create glyphrogue-game
```

Prompts for a game name, then writes a ready-to-run project into a
kebab-cased directory of that name: a two-entry Vite config (dev mode
loads `@glyphrogue/core` + `@glyphrogue/editor`, production loads core
only), one minimal starter room/plugin/font source, and a GitHub Pages
deploy workflow. See `templates/default/README.md` for what the generated
project itself looks like, and `../../docs/design/cli.md` for the design
this implements.
