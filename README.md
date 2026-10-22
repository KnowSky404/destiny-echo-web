<p align="center">
  <img src="docs/assets/brand/echoes-mark-v2.svg" width="160" alt="Echoes of Destiny logo">
</p>
<h1 align="center">Echoes of Destiny</h1>
<p align="center"><em>Rewrite fate in the echoes.</em></p>
<p align="center">English · <a href="README.zh-CN.md">简体中文</a></p>
<p align="center">
  <a href="https://destiny-echo-web.littlecontrol.workers.dev/">Play online</a> ·
  <a href="https://destiny-echo-web-pre.littlecontrol.workers.dev/">Preview (PRE)</a> ·
  <a href="https://github.com/KnowSky404/destiny-echo-web/wiki">Wiki</a> ·
  <a href="https://github.com/KnowSky404/destiny-echo-web/wiki/Changelog">Changelog</a>
</p>

A browser defense roguelike for desktop and touch screens. Hold a fixed position, fire automatically, pick a target, and build a run from **51 augments, 12 synergy families, and 8 stat trainings**. Clear four encounters, then carry your build into endless mode.

## Core loop

- Click or tap enemies and chests to focus fire. Your ship stays in place.
- Pick one reward at a time; combat pauses while you choose. Family bonuses activate at 3 / 6 / 9 stacks.
- Defeat each boss and every remaining enemy to advance. Restarting clears the run.

The game currently uses Chinese UI. **English game UI is planned**; this update provides bilingual documentation. WebGL is required. There are no accounts or saved combat runs.

## Development

Requires **Bun 1.4.3 or newer** and a WebGL-capable browser.

```sh
bun install --frozen-lockfile
bun run dev
```

Keep local servers on loopback; use an SSH tunnel for remote access. Before committing:

```sh
bun run docs:check
bun run typecheck
bun run lint
bun test
bun run build
```

`bun run build` produces `dist/`; `bun run build:pre` produces `dist-pre/`. PRE has a browser-local balance laboratory. Preview and production are separate releases.

See the **[Wiki](https://github.com/KnowSky404/destiny-echo-web/wiki)** for illustrated controls, cards, enemies, mechanics, browser testing, deployment, validation history, and release notes. Offline: [English guide](docs/game-guide/Home.md) · [中文指南](docs/game-guide/Home-zh-CN.md). Contributor rules: [AGENTS.md](AGENTS.md).

## License

Code: [GNU AGPL v3.0 or later](LICENSE). [Third-party notices](public/THIRD_PARTY_NOTICES.txt) cover Phaser and fonts. [Brand assets and prompts](docs/assets/brand/README.md) record the documentation logo versions and their provenance.
