# Development and publishing

## Setup and checks

Use Bun 1.4.3 or newer; stable newer versions are allowed without an upper major cap. The stack is TypeScript, Phaser 4, Vite and Biome. No backend service is required.

```sh
bun install --frozen-lockfile
bun run dev
# Local PRE with balance laboratory:
bun run dev:pre
```

Keep servers on loopback. On the VPS, use an SSH tunnel to the chosen port; do not change firewall or DNS for routine work. Production output is `dist/`; PRE output is `dist-pre/`. Both must be served over HTTP(S), including assets, fonts and license files. `base: "./"` supports a subdirectory. Local `preview` is not Cloudflare PRE.

```sh
bun run docs:generate
bun run docs:check
bun run typecheck
bun run lint
bun test
bun run build
```

## Browser verification

Build before testing and install browsers matching the lockfile:

```sh
bunx --bun playwright install chromium firefox webkit
bun run test:browser
```

`test:browser` prepares the PRE build. In restricted environments, use a writable location consistently, e.g. `PLAYWRIGHT_BROWSERS_PATH=/tmp/destiny-browsers`, for installation and execution. Firefox/WebKit may require Xvfb and software WebGL on a headless Linux host. Read the current Playwright config before selecting projects. A browser launch failure is an environment failure until reproduced in the app. Automated touch is not physical-device acceptance; long sessions and real mobile browsers remain manual checks. [Historical evidence](Validation.md).

On a CPU-only software-WebGL host, the two long natural desktop controls can explicitly use `ECHOES_BROWSER_NATURAL_FPS=15`. The test route changes only Phaser scheduling to 15 FPS with `forceSetTimeOut` and disables delta smoothing; the real WebGL renderer, input, World rules, seed, rewards, 120 Hz fixed step and logical budgets stay in place. Other interface tests and the default run retain normal scheduling. A short probe verified 66.7 ms frames below the 100 ms frame cap and identical complete World snapshots at actual fixed step 240. Record this mode with the results; it does not establish 60 FPS performance or physical-device acceptance. Run each long control separately on constrained hosts, for example:

```sh
ECHOES_BROWSER_NATURAL_FPS=15 bunx --bun playwright test tests/browser/desktop.spec.ts --project=chromium --grep 'a natural offense run'
```

Use `--grep 'a natural random run'` for the failure control. Firefox can use the same commands with `--project=firefox --headed` under `xvfb-run -a` when its headless WebGL context is unavailable.

## Architecture

| Path | Responsibility |
| --- | --- |
| `src/game` | Fixed-step simulation, pools, input coordinates, state and rules |
| `src/data` | Data-defined cards, enemies, stages, synergies and numeric profiles |
| `src/game/scenes` | Phaser rendering; no rule ownership |
| `src/ui` | Native DOM controls, help, rewards and build panels |
| `scripts/game-guide.ts` | Chinese rule prose and generated bilingual guide assembly |
| `scripts/guide-catalog.en.ts` / `docs/wiki-content` | English catalog translations and maintained Wiki prose |

Simulation uses seconds and a 1/120s fixed step, independent of CSS pixels, frame rate and DPR. Arena geometry is selected at entry. Touch, safe areas, narrow rewards, background pause and keyboard focus must be preserved. Browser modules cannot import Bun/server APIs. See the [architecture source](https://github.com/KnowSky404/destiny-echo-web/blob/main/docs/architecture.md) and [combat specification](https://github.com/KnowSky404/destiny-echo-web/blob/main/docs/builds-and-stages.md).

## PRE balance laboratory

![Actual PRE player editor; it pauses combat](../assets/screenshots/balance-lab-v1.png)

Open **PRE · 数值调试** on PRE. Player/build changes last for the current run; temporary spawn rules affect later spawns in that stage. Existing enemies can be edited separately. Stage controls can keep the build, restore entry state or jump to campaign/endless stages. These are debugging actions, not natural-clear evidence.

Saved drafts and versions live in the current browser's PRE origin `localStorage`, isolated from other browsers, private contexts and PRO. Web Locks serialize writes; stale tabs refuse to overwrite newer content. Export the draft and refresh after a conflict. Storage/locking failures still allow session experiments and draft export. A running test fixes its selected version until restart; combat is not saved on refresh.

Profiles use schemaVersion 2 / baseline balance-v2, with player numbers, enemy baselines, endless tuning, per-source reward weights and up to 200 stage rules. Rules use inclusive `from`/`to`, `null` for unbounded, and precedence global → range → single stage. Equal-priority overlap is rejected. Guided rewards preserve foundation/family support; weighted rewards use weights directly, including epics, with 0 excluding a card. Eligibility and stack caps remain. Weights are not final choose-three probabilities. Exhausted pools allow a one-use no-reward continue; ineligible score-training milestones are consumed, not deferred.

The v2 evolution group contains training thresholds, base quadratic endless growth, cast/weakness timing, percentage allowances and effective firing floor. Original v1 browser storage remains available for backup; explicitly migrate a profile as a new v2 identity before testing. Migration saves a separate version without activating it or replacing the draft. Old replay fingerprints still require the old rules/code.

Live endless enemy-budget edits redistribute only unspent current/future wave credit, retaining admitted credit and completed segments. The displayed budget is clamped to admitted credit; keep-build restart uses the original requested override in full. Custom supply counts 0–12 are distributed over the first three segments by cumulative floor(N×k/3), so a segment may grant several consecutive choices; the official count three remains one per segment.

Export contains configuration only, excluding temporary battle state. Maintainers apply it in a new worktree:

```sh
bun run balance:validate /path/to/echoes-balance.json
bun run balance:apply /path/to/echoes-balance.json
bun run docs:generate
# Review both languages and run all checks before publishing.
```

See the [complete debugger contract](https://github.com/KnowSky404/destiny-echo-web/blob/main/docs/balance-debugger.md) for numeric validation, revision monotonicity, import and overrides. Applying a profile edits source; it does not deploy or publish anything.

### Balance Simulator V1

Maintainers can run the production World without rendering in Bun, using fixed seeds to compare natural reward/target strategies, logical layouts and balance profiles. The CLI provides JSON/CSV/Markdown reports, paired baseline comparisons, budgeted one-factor sweeps and deterministic single-run replay:

```sh
bun run balance:simulate --profile official --preset smoke --out artifacts/balance/smoke
```

Saved-profile JSON exported by PRE works directly as CLI input; experimental candidates use the existing profile import flow. The experiment entry validates a summary or case, displays diagnostics and prepares a fresh manual run with its profile, seed and logical width, preserving existing drafts and saved versions. A manual restart is not automatic playback; use the CLI for deterministic reproduction with the same strategy.

The tool changes neither production rules nor `official.json`, and never runs `balance:apply`, pushes or deploys automatically. Budget exhaustion, death and reaching an endless observation target are distinct outcomes; strategy statistics are not human completion rates. See the [Balance Simulator guide](https://github.com/KnowSky404/destiny-echo-web/blob/main/docs/balance-simulator.md) for complete commands, metric definitions, configuration and limitations.

## Counterplay candidate — 2026-10-27

The standard active benchmark remains policy version 2: every 0.5s it uses visible state to prefer a dangerous boss/elite charge, then an exposed boss/elite, then preparation/imminent/safe-chest logic. Its native target-selection action can confirm a deep-endless warning without a new hidden action or strategy version. Reward ranking, auto/random and legacy policies remain. Policy-1 history is not a same-policy profile comparison.

The current source combines a paired elite segment from depth 4, current-warning confirmation for primary-hit interruption, hostile-time first preparation/active charges, a post-depth-5 health tail, star-scaled ordinary-minion resistance and a deep lifesteal allowance. Winter still uses all basic-projectile hits. Each depth-4+ slam is capped at 45% player maximum HP before ordinary shields/invulnerability. See [Mechanics](Mechanics.md) and [Stages](Stages.md) for precise scope. These code rules are not additional profile form fields; importing old numeric profiles still uses the current engine.

The v1 report remains rejected for a budget-unresolved run and unproven late challenge. V2 completed 300/600/120 and passed campaign pacing, but also remains rejected for late endless auto-clearing. V3 completed its 300/600/120 matrices using masters 2026102604/05/06. Its records and campaign pacing passed, while late endless challenge failed acceptance. V4 Q was developed on observed inputs and adopted into the worktree for new validation, with 170 seeds reserved under masters 2026102701/02/03. The V4 freeze preceded selection and prospective adoption preceded both independent holdouts. All300/600/120 records and their independent audits completed without unresolved outcomes. Normal-build successful campaign medians are502–507s; sustained late pressure and counterplay support PRE candidate delivery, with strong-build, composition and stage2-attrition limits retained. Source publication and human acceptance remain separate. Preserve observed-input development separately, freeze source/profile before new-seed execution, and record prospective adoption before independent holdouts. Retain every planned group denominator, all deaths and unentered depths; error, invalid, cancelled, missing, duplicate and budget-unresolved records fail the frozen integrity gate. Engineering, calibration, browser evidence and release authorization remain separate; see the [October 27 record](https://github.com/KnowSky404/destiny-echo-web/blob/main/docs/endless-evolution-calibration-v4-2026-10-27.md).

## Contributing and bilingual documentation

Start a new worktree/branch from current `origin/main`; preserve other tasks. Follow [AGENTS.md](https://github.com/KnowSky404/destiny-echo-web/blob/main/AGENTS.md): verify, atomic Conventional Commit, push, PR, exact-current-head Codex review, rebase merge, confirm content and clean only this task's worktree/branches. Do not force push or bypass checks.

Review Chinese prose in `scripts/game-guide.ts` and English templates/catalog together. `docs/wiki-content/reviewed-rules.txt` pins the rule digest against which English prose was checked. If rules change, re-review the translations before updating that digest; this is a review marker, not an automatic translation tool. Generate both languages and keep them in the same commit. `docs:check` fails on missing/stale pages, translations or assets. Default Wiki slugs are English; Chinese counterparts end in `-zh-CN`. Page headers link to their counterpart.

Before each release, update both [Changelog](Changelog.md) sources with the date, version/tag or commit, changes, migration notes if needed, evidence and independent PRE/PRO status. Do not invent a release number or mark an environment deployed from a merge alone.

After review/merge, from the clean verified merged main:

```sh
bun run wiki:publish --dry-run
bun run wiki:publish
```

The native Wiki is a separate Git repository. Publication syncs generated pages plus versioned documentation assets, converts local links, preserves unmanaged pages, skips empty commits, normally pushes without force, and checks remote SHA. Reuse system Git/GitHub credentials. If a concurrent push rejects publication, inspect it and rerun safely. Full maintenance details: [Wiki publishing source](https://github.com/KnowSky404/destiny-echo-web/blob/main/docs/wiki-publishing.md).

## Static deployment

| Environment | Worker | URL |
| --- | --- | --- |
| PRO | `destiny-echo-web` | [Production](https://destiny-echo-web.littlecontrol.workers.dev/) |
| PRE | `destiny-echo-web-pre` | [Preview](https://destiny-echo-web-pre.littlecontrol.workers.dev/) |

Obtain the requested deployment scope, verify the existing CLI identity/account/permissions and the commit, then dry-run. PRO requires the same version to be verified in PRE first. The scripts use locked Wrangler for packaging and `cf` for prebuilt deployment; preserve those entrypoints.

```sh
bunx --bun cf auth whoami
bun run deploy:check:pre
bun run deploy:pre
# Only when PRO is authorized, after PRE verification:
bun run deploy:check
bun run deploy:pro
```

No application secrets or runtime server are required. `_headers` revalidates the home page, caches hashed assets immutably and adds security headers; missing assets should return 404. Check public HTML identity, assets, caching and real browser input after deployment. Source push, Wiki publish, local checks, PRE and PRO are separate results. This documentation update does not deploy the game.
