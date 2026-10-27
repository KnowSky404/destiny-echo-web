# Changelog

## Unreleased — counterplay candidate, 2026-10-27

- Preserve the rejected v1/v2/v3 reports. V3 completed 300/600/120 and passed recording integrity and campaign pacing, but late endless challenge still failed; V4 now has calibration acceptance for PRE candidate delivery, with publication and human acceptance verified separately.
- From endless depth 4, put the existing Colossus and Wizard in one elite segment between the two waves. Keep the original leader/initial-escort totals, three supplies, training credit and bounded capacity.
- Each deep-endless warning needs fresh target selection for primary-hit interruption, including reselecting the current target with F or tapping it again. Confirmation is allowed during forming; interruption accumulation starts afterward. The damage route remains available without confirmation.
- Make first permitted leader preparation and active charges independent of ordinary slow/stun from depth 4, while retaining later recovery control and Sanctuary/pause freezes. Keep all-basic-projectile Winter procs.
- Add a post-depth-5 health tail, star-scaled percentage/control resistance for ordinary minions, and a depth-4 lifesteal time allowance before healing bonuses/wounds/overheal. Other healing does not spend that lifesteal-specific allowance; depth 7 adds the shared limits below. Campaign rules remain.
- Cap each depth-4+ slam at 45% player maximum HP before shield and hit invulnerability; this is not a guarantee against combined damage.
- V4 adds mixed packs of two from depth 7 and three from depth 13, preserving the mean wave admission interval. From depth 7, minion percentage damage and actual combat HP/shield recovery use separate depth-scaled quarter-second allowances, future combat shields have a capacity ceiling, and ordinary melee/projectile hits are individually capped at 35% maximum HP. Existing excess shields and instant card effects retain their paths.
- Q has been adopted into the worktree for fresh validation; 170 new seeds were reserved before the V4 freeze. All300/600/120 outcomes and independent audits passed, with prospective adoption before holdouts; normal-build campaign success medians are502–507s. PRE candidate acceptance retains strong-build, composition and stage2-attrition limits. Development fixtures and historical engineering/browser checks cannot replace fresh validation. Source review/merge, Wiki and PRE/PRO remain separate.

## Unreleased — calibration candidate revision 2, 2026-10-26

- Retain the rejected v1 evidence: one of 600 campaign outcomes remained budget-unresolved, and late endless interaction was not demonstrated. No historical result is rewritten.
- Rebalance second-stage pressure and campaign Boss arrival timing; numeric stage tables follow the current official profile. Endless health uses G(d)=1+0.3d+0.2d², retaining G(1)=1.5.
- Keep Winter's all-basic-projectile hit counting. Endless bosses/elites accept one effective stun, reject refreshes during it and for 0.4s afterward; pause/Sanctuary freeze the recovery timer. Campaign/minions, slow, damage and cast interruption keep their rules.
- Endless leaders keep ordinary preparation and the full 2.4s warning but drop the additional 2.8s initial cooldown before their first cast.
- The visible active benchmark policy 2 prioritizes dangerous leader charges, then exposed leaders. It is a strategy improvement, not a World weak-point bug fix.
- The v2 300/600/120 matrices later completed, with no unresolved results and passing ordinary-build campaign pacing. Late endless challenge still failed acceptance: depth-20 casts were all interrupted and surviving builds cleared later enemies faster. The historical report remains rejected; these results do not validate the October 27 candidate.

## Unreleased — endless evolution and training economy

- Replace the waiting loop with waves, Colossus/Wizard elites and a main boss; use both elite kinds in a shared segment from endless layer four. Award supplies after the first three completed segments.
- Introduce native star weights and 1/3/9 budget costs, shared quadratic health growth from the resolved finale, and boss HP derived from the strongest enhanced three-star tank.
- Separate display score from finite-budget training credit. Automatic thresholds start at 5,000 then add 1,500 to each next requirement; HP clearance bonuses and excess reinforcements cannot feed training.
- Add telegraphed, interruptible casts with weakness/recovery; slam respects shield and hit invulnerability. Enemy-HP damage shares main/elite per-target allowances, while ordinary damage and final execution retain their paths.
- Guided epic rates become 10/15/20/25% across the campaign and 30% in endless, including the final boss card slot. Nine-stack builds gain continuation/complement/free choices.
- Show attack paths, mark pulses and 0.5/0.6/0.8s death echoes, with a 0.8s visual-only clearance afterglow. v2 profiles require explicit migration copies from retained v1 data.
- The 8–12 minute normal campaign rhythm is a calibration target. Evidence, PR review/merge, Wiki publication and PRE/PRO rollout remain separately verified; these notes do not assert completion.


## UI detail polish — 2026-10-23

- Render the defense-line marker as native DOM text with an SVG shield: 12px on desktop, 11px on mobile, with a whole-CSS-pixel anchor that follows the real FIT canvas bounds. The marker does not read DPR or intercept pointer input.
- Increase shield values to 12px desktop / 11px mobile. Keep reward changes and synergy previews at least 11px, with wrapping for narrow layouts.
- Increase build-family progress to 11px and details to 12px; strengthen small attribute/family icon strokes and add a visible keyboard focus outline to family expanders.
- Keep build attribute values at 16px with native sans-serif glyphs, tabular numerals and clear contrast. Allow the defense marker to wrap within the actual canvas width on short screens.
- Keep a readable 230px arena column on short mobile screens, using page scrolling instead of squeezing the HUD.
- Combat rules, targeting coordinates and formation geometry are unchanged.
- Source: [PR #17](https://github.com/KnowSky404/destiny-echo-web/pull/17), game commit `bfa6f299e8c373982acd966547210920c2bcfac7`. The user explicitly directed merge while remote Codex review was still running; no completed remote review is claimed.
- Verification: docs/type/lint/build checks and 402 Bun tests passed; focused local Playwright checks covered Chromium desktop/touch, Firefox and WebKit. Live PRE and PRO acceptance passed with Firefox 1920×1080 and Chromium 320×568 touch: natural timer advancement, pause/resume, native defense text, both languages, Build and Help. Chromium desktop software-rendering screenshot timeouts were retained and not counted as passing; this is not physical-device or long-session proof.
- PRE: [play preview](https://destiny-echo-web-pre.littlecontrol.workers.dev/), version `7c75cb2e-d4e2-44c6-9d4b-d8d894eb90c0`, verified at 100% traffic; 15 public files matched the build SHA-256, with cache/security headers and missing-file 404 verified.
- PRO: [play production](https://destiny-echo-web.littlecontrol.workers.dev/), version `d51ac3d9-3ee9-4519-9aa9-583d51fd1e21`, verified at 100% traffic after PRE acceptance; 12 public files matched the build SHA-256, with the same HTTP checks. Both environments deploy the same game commit, using their existing separate build modes.
- Wiki content is generated from these bilingual sources and published independently of the game Workers.

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
