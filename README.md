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

The game supports **English and Simplified Chinese**. Choose **English / 中文** in the header; the browser remembers your choice when local storage is available. Chinese is the default. Switching language keeps the current run and reward choices. WebGL is required. There are no accounts or saved combat runs.

## Community

Chinese and English are both welcome. Use [Issues](https://github.com/KnowSky404/destiny-echo-web/issues/new/choose) for reproducible bugs and specific feature requests, and [Discussions](https://github.com/KnowSky404/destiny-echo-web/discussions) for questions, ideas, and play experiences. The [Wiki](https://github.com/KnowSky404/destiny-echo-web/wiki) covers controls, cards, and mechanics.

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

## Balance experiments

The developer-only [Balance Simulator V1](docs/balance-simulator.md) runs the real fixed-step World in Bun. PRE profile exports are direct inputs; experiments never apply balance changes or deploy. Adopted stage values are maintained in the official profile; see the [calibration method and evidence](docs/balance-calibration-2026-10-22.md) and [resolved stage tables](docs/game-guide/Stages.md).

```sh
bun run balance:simulate --profile official --preset smoke --out artifacts/balance/smoke
bun run balance:simulate --profile official --preset standard --out artifacts/balance/baseline
bun run balance:compare --baseline official --candidate experiments/balance/example-candidate.json --preset smoke --out artifacts/balance/comparison
bun run balance:sweep --experiment experiments/balance/sweep.json --out artifacts/balance/sweep
bun run balance:replay --case artifacts/balance/smoke/cases/death.json
```

Use a new output directory for each run. Standard evaluates 100 seeds per strategy × layout (600 runs per profile); these are test-agent results, not human win rates. See the [recorded baseline experiment](experiments/balance/baseline-report.md) for actual evidence and limitations.
