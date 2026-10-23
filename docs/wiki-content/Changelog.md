# Changelog

## UI detail polish — 2026-10-23 (Unreleased)

- Render the defense-line marker as native DOM text with an SVG shield: 12px on desktop, 11px on mobile, with a whole-CSS-pixel anchor that follows the real FIT canvas bounds. The marker does not read DPR or intercept pointer input.
- Increase shield values to 12px desktop / 11px mobile. Keep reward changes and synergy previews at least 11px, with wrapping for narrow layouts.
- Increase build-family progress to 11px and details to 12px; strengthen small attribute/family icon strokes and add a visible keyboard focus outline to family expanders.
- Keep build attribute values at 16px with native sans-serif glyphs, tabular numerals and clear contrast. Allow the defense marker to wrap within the actual canvas width on short screens.
- Keep a readable 230px arena column on short mobile screens, using page scrolling instead of squeezing the HUD.
- Combat rules, targeting coordinates and formation geometry are unchanged.
- Verification: docs/type/lint/build checks and 402 Bun tests passed; focused Playwright checks passed on Chromium desktop/touch, Firefox and WebKit. Wiki: publish separately from clean merged main and verify the remote SHA. PRE: not deployed for this change. PRO: not deployed for this change.

## Desktop interface and clarity — 2026-10-23

- Move training and skill notices to the lower right, clear of the fixed ship.
- Integrate the current scalable Echo Compass logo, improve canvas/texture clarity and record actual asset dimensions.
- Replace Endless red boxes with star-position markers at the real active-cell bounds.
- Recalculate lanes/capacity on new runs from the current viewport; preserve formation and attack cells during a run, with live body-slot pixel measurements.
- Keep in-game Help focused on the core loop and link detailed rules to the bilingual Wiki.
- Local checks, source/PR, Wiki and PRE/PRO delivery are separate; this change does not authorize game deployment.

## Stage calibration — 2026-10-22

The official profile now calibrates opening pressure, later minion/boss endurance and action timing, plus the separate endless ramp and direct-HP slam. Numeric tables and bilingual help follow the profile. Reproducible selection, independent validation and strategy/layout sensitivity are recorded in the repository calibration report; proxy results are not human win rates. Source/PR, Wiki, PRE and PRO delivery remain separately verified.

## Unreleased — game language support

- **Game UI in English and Simplified Chinese:** switch menus, HUD, all 51 augments, 8 trainings, 12 synergy families, enemies, campaign/endless feedback, help and accessibility labels in place.
- Header language choice defaults to Chinese, persists in browser local storage when available and falls back safely when storage is blocked. Switching preserves combat, the build and reward capabilities. Game and guide share the English catalog.
- PRE balance tools also follow the selected language; profile IDs, user-entered names and exported schema stay compatible.
- Source/Wiki delivery is tracked separately from PRE and PRO; this change does not authorize either deployment.

## Unreleased — Balance Simulator V1

- Add a seeded Bun CLI that runs the production World directly, with strategy/logical-layout groups, JSON/CSV/Markdown reports, paired comparisons, bounded one-factor sweeps and deterministic single-run replay.
- Add PRE export of saved profiles, validated experiment summaries/cases and preparation for manual review with the same profile and seed. A manual restart is not automatic strategy playback; existing drafts and saved versions remain isolated.
- Production rules and `src/data/balance/official.json` remain unchanged. Candidates are saved as separate experimental profiles; the tool never applies, pushes or deploys balance changes automatically.
- The [simulator guide](https://github.com/KnowSky404/destiny-echo-web/blob/main/docs/balance-simulator.md) and [local acceptance/baseline report](https://github.com/KnowSky404/destiny-echo-web/blob/main/experiments/balance/baseline-report.md) preserve the original local-only acceptance scope. Subsequent source push, PR review/merge, Wiki publication and PRE→PRO deployment are separate deliveries under the later authorization; they do not rewrite the original experimental evidence.
- Source: feature commit `080fab5`; PR/merged commit pending verification. Release checks are tracked separately. Wiki: pending publication; PRE: pending deployment verification; PRO: pending verification of the same version in PRE, then deployment verification.

## Unreleased — documentation and identity

- English-first README and Wiki, with matching Simplified Chinese pages and language switches.
- Illustrated guide, versioned high-resolution captures, scalable documentation logo, preserved AI concept and exact prompt.
- Development, publishing and validation history moved out of the README.
- This is a documentation update: game behavior, UI language, game artwork and PRE/PRO deployments are unchanged by it.

## Next

- Continue iterating on game artwork using the recorded source dimensions and versioned masters.

## Source history

These entries summarize merged source changes, not numbered releases. No GitHub Release existed when this log was introduced on 2026-10-22. PRE and PRO history has not been re-audited here; commit dates do not prove deployment. See the linked commits/PRs for delivery records.

| Date | Source | Changes |
| --- | --- | --- |
| 2026-10-22 | [330b433](https://github.com/KnowSky404/destiny-echo-web/commit/330b433), [PR 9](https://github.com/KnowSky404/destiny-echo-web/pull/9) | Correct endless attack-cell growth; guarantee at least 30% successful minion admissions inside open attack regions |
| 2026-10-22 | [adad790](https://github.com/KnowSky404/destiny-echo-web/commit/adad790), [PR 8](https://github.com/KnowSky404/destiny-echo-web/pull/8) | PRE balance laboratory: local profiles, player/build/enemy editing, stage controls, import/export, storage conflict protection and revision fixes |
| 2026-10-22 | [189bd35](https://github.com/KnowSky404/destiny-echo-web/commit/189bd35), [PR 7](https://github.com/KnowSky404/destiny-echo-web/pull/7) | Desktop/mobile lane budgets, Giant Slayer and Erosion families, expanded attack regions, poison/wounds and endless rebalance |
| 2026-10-22 | [44dbd06](https://github.com/KnowSky404/destiny-echo-web/commit/44dbd06), [PR 6](https://github.com/KnowSky404/destiny-echo-web/pull/6) | Wide desktop arena, top build/help panels, separate run geometry, score training |
| 2026-10-21 | [8f9307e](https://github.com/KnowSky404/destiny-echo-web/commit/8f9307e), [PR 5](https://github.com/KnowSky404/destiny-echo-web/pull/5) | Physical crowd limits, population compression, fusion, active enemy skills, shield synergies and mixed boss rewards |
| 2026-10-21 | [d2f6f2b](https://github.com/KnowSky404/destiny-echo-web/commit/d2f6f2b), [d443d80](https://github.com/KnowSky404/destiny-echo-web/commit/d443d80) | Sanctuary cleansing/hostile-time freeze, epics and synchronized player guide |
| 2026-10-20 | [c380ebc](https://github.com/KnowSky404/destiny-echo-web/commit/c380ebc) | Fixed-defense combat and initial static Workers release infrastructure |

## Template for every future release

Copy into both language sources under `docs/wiki-content`, then regenerate. Keep an Unreleased section until publication is verified.

```text
## YYYY-MM-DD — vX.Y.Z or commit <SHA>
Source: <tag / PR / immutable commit link>
Added:
Changed:
Fixed:
Migration / compatibility: <only if needed>
Verification: <commands, browser/device scope, evidence links>
Wiki: <published commit or pending>
PRE: <version / commit + verified date, or not deployed>
PRO: <version / commit + verified date, or not deployed>
```

A merged PR, a Wiki update and a game deployment are independent events. Update PRE/PRO lines only after checking the actual target version. Never copy old test counts as proof for a new release.
