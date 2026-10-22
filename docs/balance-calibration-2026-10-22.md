# Stage calibration — 2026-10-22

This calibration uses the latest repository Balance Simulator V1, directly driving production `World` at 1/120s. The fixed before profile, experiment protocol and commands live in [experiments/balance/calibration](../experiments/balance/calibration/README.md). The adopted numeric profile is [official.json](../src/data/balance/official.json); generated bilingual stage tables describe its resolved values.

## Method and design intent

[Riot's balance framework](https://www.leagueoflegends.com/en-us/news/dev/dev-balance-framework-update/) supports measurable criteria separated by audience and explicitly retains designer judgment. [Autonomous-agent balance research](https://arxiv.org/abs/2304.08699) compares game versions and treats simulation as supplementary testing. [EA's production testing experience](https://www.ea.com/seed/news/cog23-challenges-deploying-rl-agents-game-testing) also distinguishes automated coverage from the final product. These are methodological references; they do not prescribe a universal PvE completion percentage.

The predeclared design intent was an accessible first encounter, meaningful later build checks and an escalating optional endless mode. Compare random reward choice, build-aware automatic targeting and build-aware active targeting separately in portrait and desktop layouts. Keep both successes and failures. Selection used master seed 20261022; the completed independent validation used prospectively reserved master 20261028 with 300 game seeds per strategy/layout, after the fifth candidate was frozen. The earlier 20261023, 20261026 and 20261027 validation phases belong to rejected revisions. Strategy seed sensitivity and desktop width bounds use a third seed set. Endless observations start from new characters and carry only naturally earned campaign builds.

No samples use injected cards, debug stage jumps, manual/injected healing or reward skips. Runtime errors, invalid/missing/cancelled outcomes and exhausted budgets must be absent in adoption evidence. Confidence intervals and per-stage entry counts accompany rates. A first-stage survivor subset is not a representative sample of every possible later-stage build. The last hit alone does not explain failure; damage sources, actual hostile actions, shield absorption and build history provide context.

## Problems identified

The original profile placed nearly all failure pressure in the opening encounter, often before the first boss. Survivors then frequently erased later enemies before any attack. Increasing only enemy damage cannot affect enemies killed before attacking. Raising only starting player damage also changes chest/reward timing and seeded outcomes; an earlier +10% trial was not a reliable solution.

Endless combined a different roster, active-region spawns, poison/wounds, fusion, faster actions and direct-HP slams at once. Its original first boss had 267,701 HP versus 11,000 in the campaign finale. Health growth also enters population compression, so higher-layer HP growth is stronger than the nominal growth factor alone.

## Layout interpretation

Campaign layouts retain the existing lane compensation: initial damage scales with lane count, routine population scales with lane count, and campaign boss HP does not. At widths 450/1600 this is initial damage 12/18 and four/six lanes, while the opening boss remains 2,000 HP. The wider layout also offers more kill score toward the same 5,000-point training threshold. The softer opening exposes these structural economy and boss-output differences. Reward timing and subsequent random draws diverge, so matching game seeds across widths does not hold the acquired build constant.

The selected sample's random-policy opening-clearance gap exceeds the predeclared 20-point investigation line. This requires interpretation alongside campaign completion, carry-over health, training and build history; it is not evidence that both layouts provide identical intermediate difficulty. Build policies and independent width/strategy-seed checks are reported separately. These observations do not isolate a causal effect of any single card.

## Parameter rationale

- First-stage minion HP, incoming damage and attack timing create room to earn the restricted offensive build. Starting HP/output, card effects, first-stage eligibility and random streams retain their existing rules.
- Later minion and boss HP extend encounters for weaker surviving builds; movement, attack timing and interruption requirements follow each encounter's growing output. Strong completed builds can still clear quickly. Fixed boss arrival times, roster composition and reward cadence preserve the encounter structure.
- Counts still use the authored 40/60/90/135 budgets and 4/6/9/14 escorts, scaled by lanes and physical capacity. Increasing an already-clamped active cap would not create additional portrait capacity, so the calibrated profile retains geometry and bounded pools.
- Endless has separately calibrated growth, incoming damage, action timing and direct-HP slam damage. Campaign stage patches do not alter its authored finale baseline; the generated guide explicitly documents this distinction. The strongest enhanced three-star tank bound, overflow protection, fusion, poison, wound strength, spawn quota and attack-region expansion retain their existing mechanics.
- Boss fans, charge times, special-shot damage, support interval, reward pools/weights, score-training conversion, player caps and object-pool limits were reviewed as part of their actual encounters. Retained values remain visible in the full profile and generated tables; fields are not changed merely to make every number different.

## Rejected candidates and independent validation

The initial 125,000-HP finale candidate failed the original 650-second adoption gate: selection seed 553415033 at width 1600 under `build-auto` exhausted its budget. It stayed alive and continued damaging the boss. An explicitly excluded diagnostic extension reproduced the first 650 seconds and naturally won at 703.70 seconds; boss HP decreased throughout, so this was a finite combat tail rather than a soft lock. Several other groups also had one-to-three-minute boss tails.

The revised candidate changes only finale boss HP to 80,000. This preserves the 36,000→80,000 stage-three/finale increase, minion pressure, incoming damage and action timing. The isolated problematic run then finished at 620.20 seconds. Changing escort intervals did not reliably improve pacing because it also changed score-training and arc opportunities; those changes were rejected. This single-run diagnosis is exploratory, not adoption proof. The unchanged 650-second protocol requires a fresh complete selection matrix before independent validation. The rejected profile is retained in `experiments/balance/calibration/rejected-v1.json`.

The 80,000-HP revision then resolved all 1,200 selection runs, but failed independent validation master seed 20261023. At width 450, `build-auto` seed 10880895 still had three ordinary enemies alive at 650 seconds. The boss had died at 580.22 seconds. An excluded extension, with identical original-time reward/event prefixes and first three stages, naturally cleared at 655.09 seconds. The remaining enemies were targetable and taking damage; no unreachable-position or targeting failure was observed. The original budget-exhausted record remains rejected.

This is a pacing issue worth investigating across the distribution: several independent strategy/layout groups had 60–75-second post-boss cleanup tails. Subsequent tuning may use these now-inspected seeds as exploratory data only. A new independent validation master seed, 20261026, was reserved before selecting the next candidate, with the same 100 seeds, six strategy/layout cells, paired baseline and unchanged 650-second/78,000-step gate. No budget extension can replace an unresolved adoption record.

The third revision lowers only finale minion HP from 32.4× to 21.6×, retaining the 80,000-HP boss. This keeps a 2× minion-HP increase and 1.5× routine population increase from stage three. An exploratory scan compared four HP settings across 17 known tail cases spanning every policy/layout group. At 21.6×, all 17 resolved within the unchanged budget; all 16 previously cleared controls became faster (median improvement 22.85 seconds). The previously unresolved validation case finished at 630.71 seconds. These deliberately selected difficult cases are diagnostic evidence, not a representative win-rate sample or independent validation. Its full selection passed, followed by another rejected independent validation.

The third revision also failed its fresh 20261026 validation: `random-auto` width 450, seed 1393308403, remained alive with an undefeated final boss at 650 seconds. Its third stage alone took 208.86 seconds. The recorded 6,769.4 HP loss and 6,829.4 healing show a sustained, low-output combat tail. The other 1,199 records resolved, and active-desktop completion reached 85%, above the soft observation band; both findings remain in the rejected audit.

A new validation master, 20261027, was reserved with 300 seeds per strategy/layout (3,600 paired records), preserving the 650-second/78,000-step limit. Subsequent diagnosis jointly examines stage-three/four minion HP, boss HP and incoming damage, aiming to shorten successful combat with a meaningful time margin while preserving actual hostile pressure. Simply making a slow build die sooner is not evidence of improved successful pacing. The complete prior phases remain rejected rather than pooled into the final independent sample.

The fourth candidate selects diagnostic variant A: stage-three minion HP 8.1× and boss HP 28,000; finale minion HP 16.2× and boss HP 56,000. Incoming damage remains 1.3×/1.5×. The 200-run diagnostic compared four variants on 50 deliberately selected known cases, including all three previous budget failures, slower and typical victories, and deaths across all six strategy/layout groups. A naturally resolved all three failures and preserved all 37 previously winning controls. Its 40 successful runs finished within 511.83 seconds; six common wins became slower, so improvement is not universal. Actual late-stage attacks occurred in 37/50 cases, with hostile HP/shield injury represented in all six groups.

Variant B increased damage but did not expand that attack/pressure coverage, added one prior-win-to-death case, and killed one previous budget case instead of demonstrating successful pacing. The diagnostic does not establish a representative win rate or justify targeting the earlier 85% subgroup. A was selected as the bounded pacing correction; at that point, fresh full selection and expanded independent validation were still required. All 200 outcomes and selection criteria are retained in `v4-joint-probes.json`.

The fourth revision then failed its expanded independent 20261027 validation: one of 1,800 candidate attempts (`random-auto`, width 1600, seed 1632591434) remained alive at the unchanged 650-second budget. The other 3,599 paired records resolved. Its finale boss died at 599.01 seconds; cleanup remained unfinished for at least 50.99 seconds. Stage three had already taken 195.97 seconds. The final stage recorded 3,931.5 HP loss and matching natural healing, supporting a high-sustain cleanup-tail diagnosis. The original record does not contain a final per-enemy snapshot, so its eventual completion time is not established by that record. This complete phase remains rejected.

A separately excluded diagnostic extended that fourth-revision case under a 1,800-second budget and naturally cleared at 655.20 seconds. Its complete first-three-stage summaries, retained reward/event prefixes through 650 seconds, and saved player/time/counter boundary match the rejected original. The original run did not retain a complete per-frame World trace. New read-only boundary observations found six arrived, targetable ordinary enemies at 650 seconds with 4,280.13 total HP. They cleared through normal combat; nine further attacks caused 69 HP loss, recovered by natural healing. These entity observations come from the diagnostic wrapper, since the original record has no entity snapshot. The extension supports finite cleanup pacing diagnosis and does not replace the rejected 650-second outcome.

A fifth-revision validation master, 20261028, was reserved with the same 300 seeds per group and the unchanged hard gates before choosing another candidate. External diagnosis compares more gradual stage-two-to-three HP steps and preserves the stage-three-to-four 2× HP/Boss progression. The prospective diagnostic maximum is 475 seconds, leaving 175 seconds under the formal budget; this is a design target for known cases, not independent adoption evidence or a guarantee about unseen builds.

The fifth candidate selects diagnostic variant F: stage-three minion HP 4.5× / boss 16,000, then finale minion HP 9× / boss 32,000. This makes the stage-two-to-three minion-HP step 1.5× and the boss step 1.86×, followed by a 2× finale HP step; routine counts and incoming damage retain their existing progression. Across 80 deliberately selected known cases, F preserves all 61 previous victories, naturally clears all four historical budget configurations, and finishes all successful campaigns within 470.05 seconds. Four common wins become slower (maximum 19.86 seconds). The higher-durability E misses the prospective 475-second diagnostic target and loses one old winner; the lower-durability G meets it but reduces late attack/injury coverage. F retains actual late attacks in 45/67 entrants and hostile HP-plus-shield injury in 41/67, compared with G's 38/67 and 35/67. These biased cases do not estimate population win rates or establish independent acceptance.

The separate 36-run natural endless diagnostic uses the same 12 previously chosen known configurations for E/F/G. Every configuration clears the campaign naturally. For F, all six high-sustain weak controls die in the first endless layer, while all six strong zero-late-injury controls clear two layers. G rescues one weak control; none of these probes has an error or exhausted budget. The first endless boss remains 195,039 HP versus F's 32,000-HP finale, a 6.095× jump, so a smoother transition is not established. Natural continuation also applies the existing stage recovery and readiness events at the campaign boundary; the original full-summary/event mismatch flags remain preserved, with an annex explaining the exact event prefix and recovery-only differences. These observations are diagnostic only. The subsequent complete formal phases, including independent master 20261028, are reported below; these selected diagnostic cases contribute zero formal samples.

## Resolved candidate parameter tables

Four-lane portrait baseline; HP multipliers are before wave/star/summon adjustments. Active caps include the boss and respect physical geometry.

| Stage | Minion HP × | Move × | Damage × | Attack timing × | Boss HP | Interrupt |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 0.6000 | 1 | 0.5500 | 1.2000 | 2000 | 90 |
| 2 | 3 | 1.1000 | 1.1000 | 1 | 8600 | 260 |
| 3 | 4.5000 | 1.5000 | 1.3000 | 0.8500 | 16000 | 650 |
| 4 | 9 | 1.6500 | 1.5000 | 0.7500 | 32000 | 1800 |

| Stage | Routine count / active cap | Spawn / s | Boss at / s | Fan / ordinary interval / s | Charge / s | Charged-shot base | Escorts / interval / s |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 40 / 14 | 1.2800 | 52 | 3 / 3.2400 | 2 | 26 | 4 / 2 |
| 2 | 60 / 18 | 0.7867 | 48 | 5 / 2.7000 | 2.1 | 28 | 6 / 2 |
| 3 | 90 / 21 | 0.5022 | 46 | 3 / 1.8360 | 1.9 | 30 | 9 / 2 |
| 4 | 135 / 25 | 0.3496 | 48 | 5 / 1.6200 | 1.8 | 34 | 14 / 2 |

| Endless layer | Routine / escort | HP × including compression | Boss HP | Stage damage × before compression | Timing × | Direct slam HP |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 230 / 12 | 11.4750 | 1.9504e+5 | 2.1465 | 0.8000 | 90 |
| 2 | 360 / 12 | 34.1652 | 5.8070e+5 | 2.2753 | 0.7840 | 98 |
| 4 | 360 / 12 | 334.9714 | 5.6935e+6 | 2.5565 | 0.7530 | 113 |
| 8 | 360 / 12 | 25091.7995 | 4.2648e+8 | 3.2275 | 0.6945 | 143 |
| 16 | 360 / 12 | 123189472.0293 | 2.0938e+12 | 5.1442 | 0.5909 | 203 |
| 32 | 360 / 12 | 2917394880859663.5000 | 4.9587e+19 | 12 | 0.4277 | 323 |

Direct slam HP loss is rounded to the nearest integer, for example 90/98/105/113 for the first four layers. The first endless boss is 195039 HP. Minion HP including compression changes with both nominal growth and budget overflow; it is not merely ×1.7 per layer. The unlimited tail remains an escalating optional challenge, with finite arithmetic and capped live entity counts.

## Evidence and verification

The frozen fifth candidate completed all four required formal phases, two exact CLI replays and local verification. The independent full-matrix peer review passed, and the root design decision adopts F while explicitly retaining the soft-band deviations and limitations below. [Candidate evidence](../experiments/balance/calibration/evidence/) contains the compact delivery record; raw manifests, full run JSONL, per-stage CSV and deterministic replay cases stay under ignored `artifacts/balance/`. The final evidence index is assembled separately from the reviewed source records.

### Complete formal experiment matrix

The strict phase records are [selection](../experiments/balance/calibration/evidence/selection.json), [independent validation](../experiments/balance/calibration/evidence/validation.json), [natural endless](../experiments/balance/calibration/evidence/endless.json) and [sensitivity](../experiments/balance/calibration/evidence/sensitivity.json).

All four strict collections use simulator V1, Bun 1.4.3 and 1/120-second fixed steps. The matrix contains 1,200 selection + 3,600 independent validation + 360 natural endless + 288 width/strategy-seed checks = **5,448 complete runs**, with no missing, cancelled, erroneous, invalid or budget-exhausted outcomes. The rejected earlier selection/validation revisions and diagnostic extensions are excluded.

Candidate profile SHA-256: `e33fe7cbc2c26362482762303b3b93aa6d2fed0dcc4b776cdef0d883543df102`. Simulation content fingerprint: `359b7c2478e4e28cc99996b7a6b6cdab9993e901493c95a9e4c67ff7089226e0`. Git metadata records the pre-commit working tree; matching content hashes, archived profiles and raw record digests establish the frozen simulation identity independently of a later commit SHA. A clean merged-main source comparison remains a separate release check.

Phase JSON includes manifest/run/profile digests identifying the original raw inputs; normalized committed copies must retain those embedded digests. Full raw records remain in ignored local artifacts. The simulator paired-comparison raw cohort is `selection` in both comparison phases; the separate canonical seed set and phase identify the independent validation.

### Campaign completion and confidence intervals

Selection rows contain 100 game seeds per profile; validation rows contain 300. Parentheses give Wilson 95% intervals for the completion proportion, not an interval for the paired improvement and not a human win-rate estimate.

**Selection**

| Policy, logical width | Before / 100 (95% CI) | Calibrated / 100 (95% CI) |
| --- | --- | --- |
| `random-auto`, 450 | 1/100 (0.2–5.4%) | 28/100 (20.1–37.5%) |
| `random-auto`, 1600 | 5/100 (2.2–11.2%) | 20/100 (13.3–28.9%) |
| `build-auto`, 450 | 41/100 (31.9–50.8%) | 77/100 (67.8–84.2%) |
| `build-auto`, 1600 | 37/100 (28.2–46.8%) | 79/100 (70.0–85.8%) |
| `build-active`, 450 | 45/100 (35.6–54.8%) | 77/100 (67.8–84.2%) |
| `build-active`, 1600 | 39/100 (30.0–48.8%) | 76/100 (66.8–83.3%) |

Conditional stage clearance (cleared / observed entrants; survivor populations differ by stage):

| Policy, width | Stage 1 | Stage 2 | Stage 3 | Stage 4 |
| --- | --- | --- | --- | --- |
| `random-auto`, 450 | 35/100 | 28/35 | 28/28 | 28/28 |
| `random-auto`, 1600 | 67/100 | 20/67 | 20/20 | 20/20 |
| `build-auto`, 450 | 86/100 | 77/86 | 77/77 | 77/77 |
| `build-auto`, 1600 | 99/100 | 79/99 | 79/79 | 79/79 |
| `build-active`, 450 | 89/100 | 77/89 | 77/77 | 77/77 |
| `build-active`, 1600 | 95/100 | 76/95 | 76/76 | 76/76 |

Actual hostile-action coverage (runs with enemy attacks / observed entrants):

| Policy, width | Stage 2 | Stage 3 | Stage 4 |
| --- | --- | --- | --- |
| `random-auto`, 450 | 18/35 | 5/28 | 4/28 |
| `random-auto`, 1600 | 59/67 | 9/20 | 8/20 |
| `build-auto`, 450 | 29/86 | 11/77 | 18/77 |
| `build-auto`, 1600 | 46/99 | 26/79 | 22/79 |
| `build-active`, 450 | 32/89 | 15/77 | 17/77 |
| `build-active`, 1600 | 43/95 | 17/76 | 17/76 |

**Validation**

| Policy, logical width | Before / 300 (95% CI) | Calibrated / 300 (95% CI) |
| --- | --- | --- |
| `random-auto`, 450 | 11/300 (2.1–6.4%) | 66/300 (17.7–27.0%) |
| `random-auto`, 1600 | 6/300 (0.9–4.3%) | 84/300 (23.2–33.3%) |
| `build-auto`, 450 | 114/300 (32.7–43.6%) | 220/300 (68.1–78.0%) |
| `build-auto`, 1600 | 137/300 (40.1–51.3%) | 237/300 (74.0–83.2%) |
| `build-active`, 450 | 119/300 (34.3–45.3%) | 217/300 (67.0–77.1%) |
| `build-active`, 1600 | 143/300 (42.1–53.3%) | 241/300 (75.5–84.4%) |

Conditional stage clearance (cleared / observed entrants; survivor populations differ by stage):

| Policy, width | Stage 1 | Stage 2 | Stage 3 | Stage 4 |
| --- | --- | --- | --- | --- |
| `random-auto`, 450 | 119/300 | 66/119 | 66/66 | 66/66 |
| `random-auto`, 1600 | 193/300 | 85/193 | 84/85 | 84/84 |
| `build-auto`, 450 | 255/300 | 226/255 | 220/226 | 220/220 |
| `build-auto`, 1600 | 296/300 | 237/296 | 237/237 | 237/237 |
| `build-active`, 450 | 253/300 | 218/253 | 217/218 | 217/217 |
| `build-active`, 1600 | 292/300 | 241/292 | 241/241 | 241/241 |

Actual hostile-action coverage (runs with enemy attacks / observed entrants):

| Policy, width | Stage 2 | Stage 3 | Stage 4 |
| --- | --- | --- | --- |
| `random-auto`, 450 | 90/119 | 26/66 | 19/66 |
| `random-auto`, 1600 | 147/193 | 34/85 | 26/84 |
| `build-auto`, 450 | 109/255 | 58/226 | 58/220 |
| `build-auto`, 1600 | 122/296 | 58/237 | 65/237 |
| `build-active`, 450 | 104/253 | 46/218 | 51/217 |
| `build-active`, 1600 | 121/292 | 70/241 | 59/241 |

The evidence also separates hostile HP loss, sacrifice self-damage and shield absorption. An enemy action can miss or meet a shield; neither action counts nor total damage alone establishes difficulty. Strong surviving builds can legitimately take no HP injury. Stage-specific confidence intervals and all pressure totals are in the phase JSON.

### Natural endless continuation

Each group starts 60 new characters and must earn its campaign build naturally before entering endless. Death during the campaign remains part of the attempt denominator. Completing two endless layers stops observation; a newly entered zero-second next layer is right-censored and excluded from pressure denominators.

| Policy, width | Campaign clears / attempts | Endless 1 clears / entrants | Endless 2 clears / entrants | Two-layer target / attempts (95% CI) |
| --- | --- | --- | --- | --- |
| `random-auto`, 450 | 17/60 | 14/17 | 14/14 | 14/60 (14.4–35.4%) |
| `random-auto`, 1600 | 17/60 | 15/17 | 14/15 | 14/60 (14.4–35.4%) |
| `build-auto`, 450 | 44/60 | 40/44 | 40/40 | 40/60 (54.1–77.3%) |
| `build-auto`, 1600 | 46/60 | 42/46 | 42/42 | 42/60 (57.5–80.1%) |
| `build-active`, 450 | 42/60 | 40/42 | 40/40 | 40/60 (54.1–77.3%) |
| `build-active`, 1600 | 44/60 | 41/44 | 41/41 | 41/60 (55.8–78.7%) |

### Policy seed and width sensitivity

These are 18 cells of 16 game seeds at widths 800/2400 and policy seeds 1/17/97. Show every cell rather than treating repeated game seeds across policy settings as independent observations. Default build policies break ties deterministically; repeated policy seeds can therefore be consistency controls instead of independent build-diversity samples. The random policy uses its policy RNG. This small sensitivity scan does not certify every intermediate width or every possible build.

| Policy | Policy seed | Width | Campaign clears / 16 (95% CI) |
| --- | --- | --- | --- |
| random-auto | 1 | 800 | 10/16 (38.6–81.5%) |
| random-auto | 1 | 2400 | 4/16 (10.2–49.5%) |
| build-auto | 1 | 800 | 12/16 (50.5–89.8%) |
| build-auto | 1 | 2400 | 8/16 (28.0–72.0%) |
| build-active | 1 | 800 | 13/16 (57.0–93.4%) |
| build-active | 1 | 2400 | 10/16 (38.6–81.5%) |
| random-auto | 17 | 800 | 0/16 (0.0–19.4%) |
| random-auto | 17 | 2400 | 1/16 (1.1–28.3%) |
| build-auto | 17 | 800 | 12/16 (50.5–89.8%) |
| build-auto | 17 | 2400 | 8/16 (28.0–72.0%) |
| build-active | 17 | 800 | 13/16 (57.0–93.4%) |
| build-active | 17 | 2400 | 10/16 (38.6–81.5%) |
| random-auto | 97 | 800 | 9/16 (33.2–76.9%) |
| random-auto | 97 | 2400 | 6/16 (18.5–61.4%) |
| build-auto | 97 | 800 | 12/16 (50.5–89.8%) |
| build-auto | 97 | 2400 | 8/16 (28.0–72.0%) |
| build-active | 97 | 800 | 13/16 (57.0–93.4%) |
| build-active | 97 | 2400 | 10/16 (38.6–81.5%) |

### Historical third-revision selection interpretation

The rejected third revision's selection sample had 11 design warnings across both profiles: six baseline stage-clearance drops, two candidate random-policy drops and three candidate build-concentration flags. It also retains all 19 baseline-win/candidate-death pairs, alongside 201 pairs improved to victory. Build-auto desktop first clearance is 99%, above the 65–95% soft observation band; three build-policy campaign rates (77%, 76%, 76%) exceed the 25–75% soft band. Their confidence intervals and the deliberately accessible opening support continuing to independent validation, without reclassifying these observations as universal balance standards or removing the warnings.

All final-stage entrants in that historical selection cleared it. For the four build-policy groups, median finale hostile HP-plus-shield loss is zero and median boss survival is 3.69–4.14 seconds. Runs with actual finale hostile HP/shield injury are 24/75, 38/77, 25/76 and 32/76 (automatic portrait/desktop, active portrait/desktop). Strong campaign survivors can therefore retain a fast, low-injury finale. This calibration redistributes build checks and shortens extreme tails; it does not establish uniformly sustained pressure in every later encounter.

Against the previous candidate, 349 common winning trajectories include 221 faster runs, 126 slower runs and two unchanged runs; the greatest slowdown is 33.61 seconds. Natural score, reward and target histories make timing non-monotonic. Six-group finale cleanup maxima are 29.03/6.98/27.73/19.57/21.91/13.56 seconds; the longest complete campaign is 601.15 seconds. Baseline full results and all candidate stage-one-to-three summaries/reward/event prefixes match across all 600 paired runs, confirming the third revision's intended scope. These are historical selection observations and remain separate from the independent validation.

### Historical fourth-revision selection interpretation

The fourth revision resolves all 1,200 selection runs: 600 baseline and 600 candidate attempts. Candidate campaign completion is 27/20/75/79/77/75%, ordered random portrait/desktop, build-auto portrait/desktop, then build-active portrait/desktop. There are 12 retained warnings: six baseline stage-clearance drops, two candidate random-policy drops and four candidate build-concentration flags. Build-auto desktop first clearance is 99%; its campaign completion is 79%, and active portrait is 77%, exceeding the predeclared soft observation bands. Confidence intervals do not prove that the true policy rate lies inside those bands.

All 353 finale entrants clear it. Every group's finale hostile HP-plus-shield-loss median is zero; actual injury occurs in 8/27, 9/20, 18/75, 34/79, 22/77 and 24/75 attempts. The calibrated campaign retains a fast, low-injury finale for many successful builds. It supports bounded pacing and pressure for a minority of survivors, rather than demonstrating a typically difficult final encounter.

Against the original baseline, 203 paired attempts improve to victory and 18 change from victory to death; all seeds are retained in the audit. Against revision three, four attempts are rescued and one previous win becomes a third-stage death (`build-active`, width 1600, seed 3682834787). Among 349 common wins, 239 become faster and 110 slower, with a maximum slowdown of 54.84 seconds. The longest successful campaign is 511.83 seconds, leaving 138.17 seconds under the unchanged budget. The six-group post-boss cleanup maxima are 13.57/11.66/40.23/27.71/24.18/15.42 seconds. Lower HP does not make every seeded trajectory monotonically easier or faster.

All 600 baseline results and all 600 candidate first-two-stage summaries, reward prefixes and event prefixes match revision three exactly. This supports the intended stage-three/four scope. The complete selection audit and the decision saved before independent validation are committed under [rejected V4 evidence](../experiments/balance/calibration/rejected-v4-evidence/); the subsequent independent validation failed as recorded above, and V4 was not adopted.

### Fifth-revision selection interpretation

All 1,200 paired records resolve under the unchanged budget: 600 baseline and 600 candidate attempts, with no errors, invalid metrics, cancellations or missing records. Candidate completion is 28/20/77/79/77/76%, ordered random portrait/desktop, build-auto portrait/desktop, then build-active portrait/desktop. All four build-policy point estimates exceed the predeclared 25–75% soft observation band; build-auto desktop first clearance is 99%, above 65–95%. Confidence intervals containing a boundary do not satisfy that point-estimate observation. All 12 original warnings remain: six baseline stage-clearance drops, two candidate random-policy drops and four candidate build-concentration flags.

The candidate's 243 deaths occur in stage one (129) and stage two (114). All 357 second-stage survivors clear stages three and four. Every group's stage-three/four hostile HP-plus-shield-loss median is zero; finale injury occurs in 4/28, 8/20, 16/77, 14/79, 16/77 and 10/76 entrants. Stage two acts as the principal build filter, while the later campaign provides payoff for surviving builds. This does not establish uniformly challenging later encounters. The random-policy first-clear layout gap remains 32 percentage points and its second-stage conditional gap is −50.15 points, with the previously documented economy and survivor-selection confounding.

Against the original baseline, 206 paired attempts improve to victory and 17 change from victory to death, with complete seeds retained separately. Against V4, all 353 prior victories remain wins and four prior failures become wins. Among those 353 common victories, 282 become faster and 71 slower; the maximum slowdown is 19.44 seconds. The longest successful selection campaign is 366.30 seconds, giving 283.70 seconds of sample-only budget margin. Finale cleanup maxima are 13.63/5.03/31.29/22.37/11.04/9.04 seconds. These results do not guarantee unseen-build pacing.

The independent peer recalculates all 60 stage/campaign Wilson intervals and all raw digests, and confirms all 600 baseline results plus all 600 candidate first-two-stage summary/reward/event prefixes match V4 exactly. The root decision at 21:26:58 UTC preserves the candidate unchanged for fresh validation master 20261028, before its 21:27:21 UTC start. That prospective decision advanced evaluation without adopting the candidate; the independently completed later phases and final design judgment are recorded below.

### Fifth-revision independent validation interpretation

The prospectively reserved master 20261028 resolves all 3,600 paired records under the unchanged 650-second/78,000-step gate: 1,800 attempts per profile and 300 per strategy/layout. There are 1,595 campaign victories and 2,005 normal deaths, with no exhausted budgets, errors, invalid metrics, cancellations or missing records. This passes the hard integrity conditions; it does not mean every soft design observation is satisfied. The strict report and independent audit retain all 60 campaign/stage Wilson 95% intervals across both profiles. Candidate campaign intervals and opening clearance are:

| Strategy / logical width | Campaign wins / 300 | Campaign rate (Wilson 95%) | First-stage clearance |
| --- | ---: | --- | ---: |
| random-auto / 450 | 66 | 22.00% (17.68–27.03%) | 39.67% |
| random-auto / 1600 | 84 | 28.00% (23.22–33.33%) | 64.33% |
| build-auto / 450 | 220 | 73.33% (68.06–78.02%) | 85.00% |
| build-auto / 1600 | 237 | 79.00% (74.04–83.23%) | 98.67% |
| build-active / 450 | 217 | 72.33% (67.01–77.09%) | 84.33% |
| build-active / 1600 | 241 | 80.33% (75.464–84.436%) | 97.33% |

Both desktop build policies exceed the predeclared 25–75% campaign and 65–95% opening soft bands. Active desktop's campaign interval lies entirely above 75%, so interval overlap cannot explain away that deviation. These remain explicit design observations for the final judgment, rather than a new hard rejection threshold introduced after evaluation. All ten original warnings remain: six baseline stage-clearance drops, two candidate random-policy drops and two candidate desktop build-concentration flags.

Candidate deaths occur in stage one (392), stage two (335) and stage three (8), with none in the finale. Stage three has 1,073 entrants and 1,065 clears; all 1,065 finale entrants clear it. Stage two remains the main filter among opening survivors, followed by occasional third-stage failures and a reliable finale payoff for these surviving builds. All six groups' third-stage and finale hostile-HP-loss and hostile-HP-plus-shield-loss medians are zero. Actual hostile actions occur in 292/1,073 third-stage attempts and 278/1,065 finale attempts; hostile HP or shield injury occurs in 249/1,073 and 224/1,065 respectively. These denominators include every entrant and zero value, HP excludes bloodpact self-damage, and healing does not erase recorded injury. Hostile actions do not necessarily cause injury, and minority pressure does not establish uniformly challenging later encounters.

The random-policy desktop opening advantage is 24.67 percentage points, still above the 20-point investigation line; its second-stage conditional clearance is 11.42 points lower. Desktop campaign completion is 5.67 points higher for build-auto and 8.00 points higher for build-active. These observations retain the documented economy and survivor-selection confounding. Selection and validation use different predeclared seed sets; their rate differences are descriptive, not cross-round paired causal estimates. Shared game seeds across strategy/layout groups also mean the aggregate record count is accounting, not an independent population sample. The CLI's raw `selection` cohort label is preserved; the reserved validation configuration and post-decision start establish this phase's role.

Against the baseline, 606 paired attempts improve to victory and 71 change from victory to death; all seeds and the timing differences for 459 common victories remain retained separately. The longest successful candidate campaign is 443.1917 seconds, leaving 206.8083 seconds under the original budget in this sample. The longest observed post-boss cleanup is 33.3333 seconds. These conditional victory/cleanup distributions, measured in player combat seconds rather than reward thinking or human wall time, do not bound unseen seeds. All campaign records resolve, with no target-boundary censoring; the exploratory 475-second diagnostic target is not a formal adoption threshold.

Independent validation passed its hard integrity gate and supported continuing the frozen candidate unchanged through the remaining predeclared phases. Those phases and two exact CLI replays subsequently completed; the separate final design judgment is recorded below. Independent campaign validation does not establish sustained endless survival, human win rates, physical-device comfort or long-session balance.

### Fifth-revision natural endless interpretation

All six natural-endless cells resolve: 360/360 attempts, with 191 two-layer targets reached and 169 normal deaths, and no exhausted budgets, errors, invalid metrics, cancellations or missing records. Each attempt starts a new character and carries only its naturally earned campaign build. Of the 360 starts, 210 clear the campaign; 150 die during it, 18 die in the first endless layer and one in the second. The campaign deaths include one finale death under this phase's distinct seeds, so the earlier selection/validation finale-clearance observations are not a universal guarantee. Reaching the target is 191/360 across the declared matrix and 191/210 conditional on campaign clearance; these denominators answer different questions.

| Strategy / logical width | Campaign clears / 60 | Layer-one clears / entrants | Layer-two clears / entrants | Two-layer target / 60 (Wilson 95%) |
| --- | ---: | ---: | ---: | --- |
| random-auto / 450 | 17/60 | 14/17 | 14/14 | 14/60 (14.4–35.4%) |
| random-auto / 1600 | 17/60 | 15/17 | 14/15 | 14/60 (14.4–35.4%) |
| build-auto / 450 | 44/60 | 40/44 | 40/40 | 40/60 (54.1–77.3%) |
| build-auto / 1600 | 46/60 | 42/46 | 42/42 | 42/60 (57.5–80.1%) |
| build-active / 450 | 42/60 | 40/42 | 40/40 | 40/60 (54.1–77.3%) |
| build-active / 1600 | 44/60 | 41/44 | 41/41 | 41/60 (55.8–78.7%) |

The first endless layer has 210 observed entrants and 192 clears; the second has 192 entrants and 191 clears. After the second reward, the native continuation enters the next layer before the runner stops. All 191 zero-time third-layer entries are therefore right-censored target boundaries, not deaths or failed clearances. They are excluded from observed-entry clearance and pressure denominators. Ten original warnings remain: six stage-clearance drops and four build-concentration flags.

Observed endless pressure is higher than the low-injury late campaign within this cohort: the six groups' median hostile HP-plus-shield loss ranges from 286.49 to 608.41 in layer one and 899.17 to 1,758.50 in layer two. These distributions include zero values and exclude bloodpact HP costs. Natural healing and sustain remain substantial: among actual clears, every group's median HP ratio at clearance is 1 in both layers. Full HP at clearance does not erase earlier injury, while large cumulative injury does not by itself establish an unsustainable build. This formal phase contains only the candidate profile, with no matched baseline endless group; it cannot establish a general before/after improvement or isolate the effect of a single scalar.

The first endless boss remains 195,039 HP versus the 32,000-HP campaign finale, a 6.095× jump from the unchanged authored endless baseline. The earlier diagnostic's six selected weak controls all dying in layer one remains an explicit transition limitation; those biased controls are separate from these 360 formal attempts. The maximum observed run is 528.2917 player combat seconds under the 1,200-second/144,000-step budget, not a guarantee about unseen builds or human session length. Completing two finite layers does not prove balance or survival of the unbounded tail.

This phase passed its hard integrity gate. The complete sensitivity evidence, exact CLI replays and separate final design judgment follow; finite endless success alone does not decide adoption.

### Fifth-revision policy-seed and width sensitivity interpretation

All **18 cells × 16 game seeds = 288 records** resolved: 159 campaign victories and 129 natural deaths, with no errors, cancelled runs, invalid metrics or exhausted budgets. The table above retains every width/policy-seed cell and its own Wilson interval. Each cell uses the same sixteen environment seeds, so these results must not be pooled as independent draws across policy settings. The 41 warnings remain visible: 18 small-sample, ten stage-drop, six build-concentration, three target-policy and four layout-gap warnings.

The random policy is materially sensitive to its fixed policy RNG. At width 800, policy seeds 1/17/97 produce **10/0/9 victories out of 16**; at width 2400 they produce **4/1/6**. Policy seed 17 at width 800 loses all sixteen attempts in stage one; its Wilson interval is 0–19.36%, not evidence of attainable success in that observed cell or proof that success is impossible for every unseen game seed. At width 2400, that policy seed clears stage one in only 2/16 attempts and the campaign in 1/16. These resolved negative outcomes remain part of the accepted evidence.

Read-only reward-history inspection explains an association, not an isolated cause: the reward-policy RNG starts from the policy seed, so all sixteen games for seeds 1 and 97 choose the second slot on the first reward, while seed 17 chooses the third. The guided offer puts foundation/existing-build options in its first two slots and retains an alternative in the third; 14/16 first rewards in the narrow seed-17 group are outside the foundation set. This is consistent with its fragile opening, but it neither proves a software defect nor isolates a particular card's causal effect. These fixed-policy trajectories do not estimate how humans choose randomly. The complete paired seeds, first-reward observations and source boundaries remain in the [sensitivity interpretation annex](../experiments/balance/calibration/evidence/sensitivity-interpretation.json).

Default build policies break reward ties deterministically. All **64 builder game-seed/layout/policy combinations** have identical complete results across policy seeds 1/17/97 after ignoring only the two strategy-seed metadata fields. These repetitions are consistency controls, not 48 independent environment seeds per builder/layout or evidence of additional build diversity. At widths 800/2400, `build-auto` clears 12/16 versus 8/16 (75% versus 50%, a 25-point gap above the investigation line); `build-active` clears 13/16 versus 10/16. Both builders clear the opening in 16/16 at both widths, exceeding the soft 95% opening reference in this small sample. Repeated builder warnings do not establish independent reproductions. Wide intervals, the shared game seeds and layout-dependent reward histories prevent certification of every intermediate width, arbitrary policy seed or possible build.

### Exact CLI replays and independent full-matrix review

Two saved fifth-candidate selection cases were replayed through the actual `bun scripts/balance-simulator.ts replay --case ...` command: a portrait random-policy natural death and a portrait automatic-builder campaign victory. Both commands exited zero and matched the saved expected result hashes. The [replay receipt](../experiments/balance/calibration/evidence/exact-replays.json) retains full case/log digests and termination identities. These are exact reproducibility checks of existing records; they add **zero statistical samples** to the 5,448-run matrix.

An independent read-only peer review then verified all 36 complete cells, the 3,048 candidate and 2,400 baseline records, the frozen source/profile/collector hashes, raw manifest/run/profile digests and **255 reported interval entries: 249 Wilson intervals and six zero-entry/null cases**. It retained all **73 warnings and 88 paired harms** rather than reducing the review to aggregate rates. Selection contributes 17 baseline-win/candidate-death pairs and independent validation contributes 71, alongside 206 and 606 paired improvements. The review also verified both replay receipts, all 191 right-censored endless target boundaries and the builder-repeat sensitivity boundaries. It ran no new simulations and did not make the design decision.

### Final design decision and retained limits

The [final design decision](../experiments/balance/calibration/evidence/final-adoption.json) adopts the unchanged **F profile** for review and the authorized release workflow after all formal phases, exact replays and the independent full-matrix review passed. The hard integrity conditions are satisfied; **not all soft observation bands are satisfied**. The original bands are retained. In particular, independent desktop builder completion is 79%/80.33%, desktop opening clearance is 98.67%/97.33%, and the active-desktop completion interval lies wholly above the 75% reference. Random-policy layout gaps, the seed-17 sensitivity failures, paired harms and non-monotonic successful durations remain explicit tradeoffs.

The resulting campaign makes stage two the principal build filter and lets later encounters reward surviving builds. It does not establish uniform late pressure: all six selection and independent-validation groups retain zero median hostile HP-plus-shield injury in stages three and four, and every finale entrant in those two campaign phases clears. The independent validation still contains eight stage-three deaths; the separate natural-endless campaign cohort contains a finale death. Natural endless restores substantial observed hostile pressure, while healing and sustain remain effective. Its 6.095× first-boss HP jump, six weak diagnostic deaths, absence of a formal baseline endless group and finite two-layer stopping point prevent claims of a smooth transition, universal improvement or an indefinitely balanced tail.

The bounded calibration retains player output, card effects, reward economy, RNG, authored counts, physical caps and pools. Its methodological references support segmented measurement and supplementary simulation; they supply no universal PvE percentage target. The longest observed successful independent campaign (443.1917 seconds) and two-layer attempt (528.2917 seconds) leave sample margins under their unchanged budgets, not upper bounds on unseen builds. Final evidence-index assembly, source push, exact-head PR review, rebase merge, clean-main Wiki publication and PRE-before-PRO deployment remain separate delivery steps; this design decision is not a live deployment.

### Implementation and browser checks

Before the fourth revision, the third revision passed 375 Bun tests (8,663,144 assertions), strict type checking, Biome, guide generation checks and both PRO/PRE static builds. An independent implementation/documentation review found and corrected one stale English taunt interval; the bilingual guide now derives the first-layer 3.2-second interval and 1.4-second floor from the actual timing settings. Targeted guide checks passed after that prose-only correction.

Four third-revision static browser cases covered desktop and 320px touch layouts for both builds: bilingual help, exact slam rounding, no horizontal overflow or console/page/resource errors, PRO debugger isolation and PRE export equality with the complete 21.6× / 80,000-HP official profile. A paused manual stage-four jump confirms inherited configuration; it is not a natural campaign-clear test. Original screenshots were visually inspected.

Chromium and Firefox natural first-stage success/reward-carry/restart and genuine defeat/restart flows also passed (four cases) on the earlier second-revision profile. Those checks cover unchanged first-stage success/failure, reward carry-over and entry into stage two; they are retained with their earlier profile identity rather than represented as a fresh full-suite run. Fourth- and fifth-revision checks are recorded separately below with their own profile identities; the older checks do not establish a fresh full-suite run.

The fourth candidate passed a fresh complete unit run: **375 tests, zero failures, 8,663,146 assertions**. Strict type checking, Biome and guide consistency checks passed; both static builds passed. Four fresh browser combinations (PRO/PRE × desktop/320px touch) passed bilingual help, exact slam rounding, compression wording, overflow and page/console/resource checks. PRE draft export is intentionally assigned a new UUID; after asserting that identity contract, all remaining metadata and payload match the official profile, and normalizing only draft identity reproduces the frozen official hash. A paused stage-four configuration check confirms inherited 16.2× minion HP and 56,000 boss HP. Original screenshots were visually inspected. The initial PRE test assertion incorrectly expected the official ID; its failed logs are retained, and only the corrected PRE cases were rerun. These checks establish rendered configuration and interaction behavior, not natural fourth-stage browser completion.

The frozen fifth candidate passes a fresh full unit rerun: **378 tests, zero failures, 8,663,155 assertions**. The initial run exposed a historical no-Sanctuary fixture using a reward trajectory that legitimately earns Sanctuary under the new profile; that specific mechanism regression now explicitly uses its original baseline profile, preserving every victory, duration, zero-freeze and portable-round-trip assertion. The default-versus-official and other natural official-profile checks remain unchanged. Type checking, Biome and guide checks pass, as do both fresh static builds. Four fresh PRO/PRE × desktop/320px browser cases pass in 57.5 seconds, including bilingual help, rounding, compression wording, responsive scrolling, error/resource checks and PRO diagnostic isolation. PRE verifies the entire official payload through a distinct UUID draft and normalized hash, then checks paused inherited stage-three 4.5× / 16,000 and stage-four 9× / 32,000 values. These rendered configuration checks do not establish natural browser completion of those later stages. Original failed-fixture and targeted-fix logs are retained separately.

Simulation results measure these policies, not human win rates. Two finite endless layers do not establish balance of the entire unbounded tail. Browser automation can validate rendering, input, reward transitions and responsive controls; it does not establish physical-device comfort or long-session fatigue. Source/PR checks, Wiki publication, PRE and PRO deployment require separate verification in the delivery record.
