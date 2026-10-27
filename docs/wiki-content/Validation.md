# Validation history and limits

Historical reports below were moved out of the README. They describe earlier tasks, not fresh evidence for later revisions. Detailed records remain in [the archived README at 6ec7328](https://github.com/KnowSky404/destiny-echo-web/blob/6ec7328/README.md) and linked [source-history PRs](Changelog.md).

| Work | Recorded local evidence | Boundary |
| --- | --- | --- |
| 2026-10-20 initial static release | 11 public files matched local SHA-256; caching/404; Chromium desktop and 320px start/pause/resume | Specific release only; no physical-device or long-session proof |
| 2026-10-21 Sanctuary / wounds | 159 Bun tests; 28 desktop and 13 touch Chromium scenarios covered; 4 targeted Firefox and 4 WebKit | Targeted cross-engine scope; no full Firefox/WebKit claim |
| 2026-10-21 crowd/fusion/shield/training | 174 Bun tests; 30 desktop and 15 touch Chromium covered, including targeted rechecks; 7 targeted cases in each Firefox/WebKit | Full Chromium run had one help-text failure, then passed its updated targeted recheck |
| 2026-10-22 wide desktop | 183 Bun tests; 33 Firefox scenarios covered in groups plus targeted rechecks | Desktop Firefox at 1920×1080 / 1366×768 only |
| 2026-10-22 lane/endless rebalance | 209 Bun tests; Chromium full run 47/52 initially, then all five failures included in 10 passing targeted rechecks | Coverage plus rechecks, not a new uninterrupted full-suite pass |
| 2026-10-22 PRE laboratory | 242 Bun tests; 24 browser cases across Chromium desktop/touch, Firefox and WebKit | Editing/storage/import/PRO isolation; no physical-device or long-term balance claim |

## 2026-10-22 game language support

The source build supports English and Simplified Chinese. Local checks passed: `docs:check`, `typecheck`, `lint`, 356 Bun tests, and both PRO/PRE static builds. Content checks cover all 51 augments, 8 trainings, 12 synergy families, enemies and stage labels; 118 healthy/wounded preview pairs retain identical numbers across languages.

The new game browser matrix passed 22 cases across Chromium desktop, 320px touch and WebKit, including language persistence, denied storage, real chest selection, all result states, endless status, complete HP display and scrolling to the third reward. Six Firefox combat cases were explicitly skipped after the installed browser could not create WebGL; its English help and graphics-error recovery check passed. Six PRE language cases passed across Chromium desktop/touch and WebKit, preserving pending values, checkboxes, profile names, imported cases and raw evidence. Additional legacy browser regression is recorded in the PR. These checks used repository Playwright because the Browser plugin was unavailable.

This is local software-browser evidence, with explicit fixtures for late-game states. It does not prove physical-device or long-session behavior. Source merge, Wiki publication and PRE/PRO deployment remain separate deliveries; this change does not deploy either game environment.

## What a passing check means

V4 completed its frozen 300/600/120 matrices and independent integrity audits: selection170 wins/130 deaths, campaign355 wins/245 deaths, endless30 clear20/90 deaths, with zero unresolved outcomes. Normal-build successful campaign medians are502–507s. Of49 depth7 entrants,30 clear20; later attrition, actual HP/shield costs and counterplay support acceptance for PRE candidate delivery. Strong defensive builds, some faster common strata and concentrated stage2 deaths remain limits. Fixed-policy results are not human win rates. Historical v1/v2/v3 rejection is preserved. Source review/merge, Wiki and environment publication are separately verified in the delivery PR; see the [v4 calibration record](https://github.com/KnowSky404/destiny-echo-web/blob/main/docs/endless-evolution-calibration-v4-2026-10-27.md).

Simulation tests include frame-rate invariance, actual offered-card campaigns/endless runs, failures and restarts, plus explicitly marked setup fixtures for particular late-game states. Fixed-policy outcomes are not human win rates. Browser captures demonstrate the rendered app and real input paths; stage jumps and fixtures do not prove natural progression. Browser plugin was unavailable in those runs, so repository Playwright with software WebGL was used. Test traces and temporary evidence were stored in `/tmp`; the documentation gallery separately preserves selected PNGs in the repository.

## Known limits

- Phaser 4 requires WebGL. Unavailable/lost contexts show a recovery state; no Canvas fallback exists.
- No audio, accounts, backend API or combat persistence. The language preference and PRE numeric drafts/versions persist locally when storage is available.
- Engine startup is roughly 1.37 MB minified / 357 KB gzip in the recorded build. Low-end devices and weak networks need further profiling; static hosting should compress assets.
- Arena geometry is selected on entry; resizing does not replan combat. Real iOS Safari/Android, temperature, battery and long-session performance still require manual acceptance.
- Local tests, public HTTP health, PRE, Wiki and PRO are independent evidence. None substitutes for authenticated acceptance or a verified environment version.

For each future release, record its own checks and deployment result in [Changelog](Changelog.md), keeping this historical context separate.
