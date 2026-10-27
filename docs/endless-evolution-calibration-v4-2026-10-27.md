# Endless calibration v4 — 2026-10-27

**Measurement checkpoint: CALIBRATION ACCEPTED FOR PRE CANDIDATE DELIVERY.** At `2026-10-27T07:02:13.897Z`, root accepted the complete fresh 300/600/120 evidence and the local engineering/browser proof for profile `endless-evolution-20261027-v4`, revision 1. Its numerical payload is unchanged from v3. The [root decision](../experiments/balance/endless-evolution/pre-candidate-acceptance-v4.json), SHA-256 `554f9ab9e8b9446aded15db2eb841952085073f5b389a1e2042aca9b67eac285`, records `calibrationAccepted` and `acceptedForPreDelivery: true`, with `deliveryComplete`, production authorization and human acceptance still false at that checkpoint.

This document records calibration measurements and their acceptance boundary. PR/Codex review, the reviewed merge, Wiki publication and actual PRE delivery results belong in the separate PR delivery record; calibration acceptance does not claim those actions completed or authorize PRO. The four old observed development inputs below are not fresh validation or human evidence. The [v3 rejection](endless-evolution-calibration-2026-10-27.md), [v2 rejection](endless-evolution-calibration-2026-10-26.md) and [original calibration report](endless-evolution-calibration-2026-10-23.md) remain unchanged; none of their results is relabeled as accepted v4 evidence.

## Frozen candidate and prospective chronology

Root adopted Q for selection at `2026-10-27T04:57:44.084629Z`, with `releaseAccepted: false`. The receipt is retained at `artifacts/balance/endless-evolution/root-20261026/adopt-Q-for-selection.json`, SHA-256 `10669c8f332ce7ed75f695ea4f9d5210d314f77c2c17525358b997930b6e5ecb`. The new identity's canonical profile hash is `997accea6b158f020c12342839b872bc9bdf8277c0aba67bdb0a876a94c2e573`; the unchanged canonical payload hash is `c2327e7c0cd40e0dd707f617750bcc686383f14c4001cfc1f1f2e123621ce082`. These identify the prepared candidate and do not replace a formal source/profile freeze.

[freeze-v4.json](../experiments/balance/endless-evolution/freeze-v4.json) froze the 47 runtime files at `2026-10-27T05:08:19.169Z`, fingerprint `ea026afaf9b62a25a3712692dc80983bf5a12b76adfec499fde151be6152cc8f`, with the full profile hash above. Freeze-file SHA-256 is `ceb885236b1592346bc746da3d57174b49671ac6cdc24a159a5c662aa7811574`. Selection initialized at `2026-10-27T05:08:30.774Z` and finished at `2026-10-27T05:46:52.018Z`; its full independent audit completed after the final carrier exited. The [prospective holdout adoption](../experiments/balance/endless-evolution/selection-adoption-v4.json) is dated `2026-10-27T05:48:29.847Z`, SHA-256 `b33ee12ea55c7e8e3cf11ee7369add25aa3af840c66c2c8286e202ad7507d342`. Its native and versioned copies are byte-identical and retain `releaseAccepted: false`. Only then did validation initialize at `05:48:51.760Z` and endless at `05:48:51.976Z`; they finished at `06:45:54.008Z` and `06:48:29.168Z`. Both outer coordinators exited zero before their independent audits. No partial holdout outcomes are interpreted here.

The sampler records Git HEAD `acce7ad94fc6d919ed9127a5a39bbd8a006501a8` with `dirty: true`. This identifies an **uncommitted worktree snapshot**; it does not mean that the old commit already contains Q. The frozen 47-file hashes and full profile bind the sampled implementation. A later commit, review or merge must separately map its source bytes to this frozen implementation; sampling integrity does not establish that final Git/delivery mapping.

Before freezing, all four actual-worktree native results reproduced the Q reference result hashes exactly. `artifacts/balance/v4-adoption-equivalence-20261027/summary.json` completed at `2026-10-27T05:07:39.550Z`, SHA-256 `f41d1c70ebbe19656b9e557926325659a3328159ea8cf02a359045e8e99eb1d2`. These are known-input equivalence checks, not four additional fresh samples.

| Fresh matrix | Protocol | Master | Original denominator | Budget | Complete native result |
| --- | --- | ---: | ---: | --- | --- |
| Campaign selection | [campaign-selection-v4.json](../experiments/balance/endless-evolution/campaign-selection-v4.json) | 2026102701 | 300 = 6 × 50 | 900s / 108000 steps | COMPLETE: 170 victory / 130 death / 0 unresolved |
| Independent campaign | [campaign-validation-v4.json](../experiments/balance/endless-evolution/campaign-validation-v4.json) | 2026102702 | 600 = 6 × 100 | 900s / 108000 steps | COMPLETE: 355 victory / 245 death / 0 unresolved |
| Natural endless 20 | [endless-v4.json](../experiments/balance/endless-evolution/endless-v4.json) | 2026102703 | 120 = 6 × 20 | 7200s / 864000 steps | COMPLETE: 30 clear20 / 90 death / 0 unresolved |

The six groups are random-auto/build-auto/build-active at logical widths 450/1600. Protocol preparation is not execution. Future holdout use requires the recorded prospective adoption after selection; unresolved budget/error/cancel/invalid/missing/duplicate records remain unresolved or failed integrity, never relabeled as natural deaths. Ordinary-build successful campaign P50 must still satisfy 480–720s with nonempty success subsets. Sustained challenge and spike/stall risk require their own complete fresh evidence; neither a successful warning release nor an observed death is an acceptance quota.

The v3 second-stage concentration (270 of 299 campaign deaths) remains historical risk context. Q does not change campaign rules; its four protected old campaign trajectories neither measure a new success rate nor establish that the second-stage cliff has disappeared.

## Engineering proof so far

Root's full Bun gate passed **587 tests, zero failures, 4,838,150 assertions** in 123.45s. Typecheck, lint and docs check passed; lint reported three size warnings for historical large JSON files. The final UI3 local PRO/PRE builds both exited zero. Narrow-screen unit-label corrections changed presentation outside the 47 frozen runtime files; runtime `ea026…` and full profile `997acc…` remained unchanged. These are local engineering checks, not deployments.

The complete matched UI3 browser tuple passed **71/71 cases: 68 matrix cases plus three built-help/scroll probes**, across 18 actual receipts. Source, assertions and built assets matched every accepted receipt before and after execution. Only this complete final tuple is counted. UI1's visual failure and Firefox build drift, and UI2 Firefox's actual `HP/s` split (eight pass, one fail, one not run), are retained and excluded rather than combined into a passing total. The [versioned browser record](../experiments/balance/endless-evolution/browser-v4-audit.json) preserves the scope: bounded local rendered fixtures and built local PRO/PRE UI, with no physical-device, human-play or 60FPS claim. Its [format reconciliation](../experiments/balance/endless-evolution/browser-v4-format-reconciliation.json) records parsed equality of the formatted copy and original raw result; original bytes were not rewritten. The actual-worktree native equivalence runs, fresh balance matrices and cloud PRE/PRO remain separate evidence.

Current local proof under `artifacts/balance/endless-evolution/`:

| Record | SHA-256 |
| --- | --- |
| `root-20261026/bun-v4-release-gate.log` | `5de83ac5ebf87bd8244122d8a19f30f0fc2e5bec694c37acc373ed717bb29538` |
| `root-20261026/engineering-v4-UI3-proof.json` | `fc0d9354a3825274296ca10e9e064532b8a6dc345430155a53a4c919e5eea28b` |
| `root-20261026/build-v4-pro-ui3.log` | `b8d3d5b0c261a7cbce32ec22d1c732dca43cb51cb35a0bfc74ef70eb4db4e65e` |
| `root-20261026/build-v4-pre-ui3.log` | `36f69fc1f0f95e9549b439998efdaf6ac908b035714ff00e65af907ab764ceb5` |
| `browser-v4-20261027/qa-result.json` | `25b72cd450b90e3fe37e57f464e3e31fcaed0c2a376838a323fb3419fed99dd7` |
| `browser-v4-20261027/final-audit.json` | `7e1378d91b6e1c3891f8b6582d72ac73793ee42499cb3063d9cbbb190c2f657d` |

Earlier build and browser waves remain historical artifacts. The UI3 build proof was created while its browser run was pending; the later complete QA result and final audit close that boundary. The full browser archive under the main checkout's `artifacts/balance/endless-evolution/browser-v4-20261027/` contains 446 files verified against the originals; archive-file index SHA-256 is `503b738080bebb2e1cea97dd2cbd20f4b286e0e745109c07c68ebef86fb1b073`, sibling archive-receipt SHA-256 `9c8552c88074680cff219380d5d93d7868f647ccf7155c6b5f1898e9a08c0dbf`. Local engineering/browser acceptance and the complete 600/120 gameplay evidence remain separate checks; actual cloud delivery requires its own receipt and verification.

## Fresh selection300: complete integrity and successful pacing

| Group | Original denominator | Victory / death / unresolved | Successful n | Successful P50 | Successful P90 |
| --- | ---: | ---: | ---: | ---: | ---: |
| random-auto / 450 | 50 | 23 / 27 / 0 | 23 | 529.81s | 559.80s |
| random-auto / 1600 | 50 | 21 / 29 / 0 | 21 | 537.87s | 629.60s |
| build-auto / 450 | 50 | 31 / 19 / 0 | 31 | 509.92s | 577.24s |
| build-auto / 1600 | 50 | 32 / 18 / 0 | 32 | 513.80s | 582.65s |
| build-active / 450 | 50 | 31 / 19 / 0 | 31 | 519.92s | 578.59s |
| build-active / 1600 | 50 | 32 / 18 / 0 | 32 | 510.85s | 566.74s |

The original 300-record denominator is complete. Budget exhaustion, errors, cancellation, invalid records, missing, duplicate and unplanned identities are zero. All four ordinary-build successful medians pass 480–720s with nonempty success cohorts. This concerns successful subsets; it is not a claim that every attempt lasts 8–12 minutes. Campaign deaths in stages 1–4 are 0/114/13/3, with stage2 accounting for 114/130 = 87.69%; ordinary-build deaths are 0/61/11/2, with stage2 accounting for 61/74 = 82.43%. The concentration remains a risk, not an eliminated cliff.

The independent read-only audit verified 47 current/frozen/archived source files, full profile, four runner files, original protocols and collector bytes, all 300 raw lines/shards/per-run audits/passive sidecars and native result hashes. It reconciled finite credit, star cohorts, role TTK and cast lifecycles, reran the strict collector over persisted results, and verified all 76 bounded carriers exited zero with each run inside exactly one carrier. Native bytes were unchanged; the auditor executed no World and started no holdouts.

The small [selection-v4-audit.json](../experiments/balance/endless-evolution/selection-v4-audit.json) and [its hash index](../experiments/balance/endless-evolution/selection-v4-hashes.json) retain all six denominators, duration summaries, source identity and native bindings. Full audit directory is `artifacts/balance/endless-evolution/v4-runner-20261027/audit-v4/outputs/selection-2026-10-27T05-47-41-843Z`: `audit.json` SHA-256 `ade74f77e6a0c572325419f4c60231c7e22c741874fab43ad1da66647ed27ced`, original output index `98e1316523e63d38cf9e311999df34a7026685f0ef0dc1513ccaa770104b14b6`, native raw JSONL `6fc17f08445d91261948518ed5e505be3313e4cffadaa8b19c69b5207c8a038d`, receipt `e28f5dd4d3f144bde9a7e7bd46aa67c4b3eb2f25c9f878122dd6e428d4ae9871`, strict evidence `10f5cbfaa7118e2a1ce3014feb42f373d64e76c48d3370e34043516c638d518f`. Selection supported prospective holdout adoption only; the subsequent complete600/120 measurements and root checkpoint decision supply the later calibration acceptance.

## Independent campaign600: timing accepted, stage2 risk retained

| Group | Original denominator | Victory / death / unresolved | Successful n | Successful P50 / P90 |
| --- | ---: | ---: | ---: | ---: |
| random-auto / 450 | 100 | 37 / 63 / 0 | 37 | 530.11 / 589.53s |
| random-auto / 1600 | 100 | 48 / 52 / 0 | 48 | 533.07 / 560.82s |
| build-auto / 450 | 100 | 67 / 33 / 0 | 67 | 502.47 / 540.22s |
| build-auto / 1600 | 100 | 62 / 38 / 0 | 62 | 502.72 / 535.14s |
| build-active / 450 | 100 | 73 / 27 / 0 | 73 | 506.58 / 553.03s |
| build-active / 1600 | 100 | 68 / 32 / 0 | 68 | 506.60 / 549.92s |

All600 planned records passed the independent source/native/sidecar audit: **355 victories,245 natural deaths,0 unresolved**. All four ordinary successful P50 values satisfy480–720s. The longest ordinary successful run is792.13s, so this does not imply every attempt lasts8–12minutes. Deaths in stages1–4 are0/219/21/5; stage2 is89.39% of245 deaths. Ordinary groups have0/115/12/3 deaths, so stage2 is88.46% of130 deaths. This concentration remains a material limitation.

The ordinary groups' largest rolling-one-second HP loss is12.35% in campaign stage4. Tied native records are auto450 `run-224`; auto1600 `run-309/run-314`; active450 `run-441/run-484`; active1600 `run-505/run-509`. The metric excludes bloodpact. It stores no peak-window timestamp or per-hit source binding, so neither stage source totals nor fatalSource identifies the peak's cause. All130 ordinary-group deaths retain their terminal damage event; reconstructed pre-hit HP is below fullHP in every case (largest about4.32% maxHP). No fullHP ordinary single-hit death was observed in this sample. This is sample evidence, not a survival guarantee. Training totals32,445,840 comprise finite minion kills27,303,840 and Boss kills5,142,000; source totals reconcile.

The small [validation-v4-audit.json](../experiments/balance/endless-evolution/validation-v4-audit.json) and [hash index](../experiments/balance/endless-evolution/validation-v4-hashes.json) bind all600 native rows/shards/per-run audits/sidecars,151 bounded carriers, the current/frozen/archived47 source files, full profile, four runner files, strict collector and prospective adoption. Full audit is under `audit-v4/outputs/validation-2026-10-27T06-46-45-375Z/`, original index SHA-256 `c8e32f2ced499608470ba67abddac7b674863bf89e47528426a6ce73e5cd58f2`.

## Independent endless120: continuing late pressure and counterplay

The full original denominator is **120:30 clear20,90 natural deaths,0 unresolved**. Forty-three die in campaign;77 enter endless and68 clearD1. No budget/error/cancel/invalid/missing/duplicate outcome is substituted for a death. Each group below retains its original20 inputs; a missing late cohort is not zero pressure or a zero lifetime.

| Group (original20 each) | Enter / clear1 | Enter / clear5 | Enter / clear7 | Enter / clear10 | Enter / clear20 |
| --- | ---: | ---: | ---: | ---: | ---: |
| random-auto /450 | 8 /6 | 2 /2 | 1 /1 | 1 /1 | 1 /1 |
| random-auto /1600 | 8 /7 | 0 /0 | 0 /0 | 0 /0 | 0 /0 |
| build-auto /450 | 16 /15 | 14 /13 | 13 /13 | 11 /11 | 8 /8 |
| build-auto /1600 | 15 /14 | 13 /12 | 12 /11 | 11 /11 | 6 /6 |
| build-active /450 | 14 /13 | 12 /12 | 11 /11 | 9 /9 | 8 /8 |
| build-active /1600 | 16 /13 | 13 /13 | 12 /11 | 11 /11 | 7 /7 |

There are49 D7 entrants,47 clearingD7,43 clearingD10 and30 clearingD20. The19 deaths at/afterD7 occur at depths7:2,8:3,9:1,11:1,12:2,13:2,14:2,16:1,17:4,19:1. Thus17 die after clearingD7 and13 after clearingD10. This is continuing attrition across late depths, rather than only one new threshold; a required death count was not used as an acceptance rule.

### Same surviving inputs and common observed strata

These means retain the same D20-clearing input set at every earlier depth. Values are player/hostile birth-to-death seconds for actual defeated minions, including approach/control; living units and fusion donors are not fake deaths. Player time includes Sanctuary while hostile time stops. All-arrival and role/star/credit distributions remain in the full offline output and curated record.

| Ordinary group | Same-input n / original20 | D7 minion player/hostile | D10 | D20 |
| --- | ---: | ---: | ---: | ---: |
| auto450 | 8 /20 | 1.619 /1.522 | 1.641 /1.431 | 1.924 /1.624 |
| auto1600 | 6 /20 | 1.801 /1.602 | 1.840 /1.610 | 2.071 /1.723 |
| active450 | 8 /20 | 1.821 /1.645 | 1.819 /1.554 | 2.075 /1.663 |
| active1600 | 7 /20 | 1.950 /1.738 | 1.809 /1.611 | 1.952 /1.649 |

Using the existing common role/birth-star/death-star/finite-credit bands and earlier-depth death weights gives:

| Ordinary group | D7→20 minion player/hostile ratio | D10→20 minion player/hostile ratio |
| --- | ---: | ---: |
| auto450 | 1.1119 /1.0077 | 1.1128 /1.0899 |
| auto1600 | 1.0488 /0.9915 | 1.0551 /1.0100 |
| active450 | 1.0602 /0.9480 | 1.0716 /1.0148 |
| active1600 | 0.9170 /0.8887 | 1.0183 /0.9798 |

D7 common death support is100% on both sides. These aggregate weights retain the same input set, but do not fix each input's contribution or control species, position, exact fusion time and natural builds. The active1600 D7 comparison still accelerates and its D10 hostile ratio is slightly below1; there is no claim that all cohorts slow down. D20 ordinary elite means are9.74–12.45 player seconds and main Boss24.09–29.67s. D7→20 elite hostile ratios remain0.7582–0.9112 and Boss0.8292–0.9227. D5 elites lack common star support. The acceptance therefore rests on combined continuing pressure and counterplay evidence, not universal TTK growth or adding enormous HP alone.

### Actual damage, mitigation and cast consequences

| D20 group | Entrants / original20 | Zero enemyHP / fullHP entry cases | Enemy HP loss | Shield absorbed | Starts / interrupts / releases / caster deaths |
| --- | ---: | ---: | ---: | ---: | ---: |
| random450 | 1 /20 | 0 /1 | 56.59 | 203.12 | 8 /0 /5 /3 |
| random1600 | 0 /20 | no arrivals | — | — | no arrivals |
| auto450 | 8 /20 | 5 /6 | 579.42 | 1084.27 | 42 /13 /27 /2 |
| auto1600 | 6 /20 | 4 /5 | 1090.24 | 717.31 | 33 /7 /24 /2 |
| active450 | 8 /20 | 6 /8 | 399.53 | 1042.94 | 42 /40 /1 /1 |
| active1600 | 7 /20 | 7 /7 | 0 | 962.28 | 37 /34 /1 /2 |

Across30 D20 survivors, enemy HP loss is2125.786, voluntary bloodpact cost1797 and shield absorption4009.906. **22/30 have zero enemy HP loss and27/30 enter at fullHP**; active1600 retains seven zero-enemy-HP cases. These are survivor-conditioned strong-build results, not the original120 denominator or a claim that everyone must take HP damage. The finite shield/recovery resources and source maps remain observable even when HP is protected.

D20 has162 starts=94 interrupts+58 releases+10 caster-death cancellations, with zero run-end cancellation. Ordinary auto groups release51 casts; active groups release2. All released casts satisfy the2.4s hostile warning, and native unwarned/premature/missing-lifecycle counters are zero. Auto D20 `boss_slam` directly records387.720 HP loss and399.780 shield absorption, showing that some released attacks have actual costs. `projectile:boss` mixes ordinary and charged projectiles, so its damage cannot be causally assigned per cast. The public sidecar does not expose damage-vs-hit interrupt cause or focus-confirmation inputs; fixed policy/layout groups do not establish a human or single-mechanism causal effect.

FromD7 onward the four ordinary groups' observed enemyHP/shield totals are18,869/26,640;28,017/30,498;11,303/18,605;19,900/16,580. Their exposure and survival differ, so these totals are descriptive, not normalized strategy effects. All120 training totals30,283,600 come from recorded finite kill credit: minions23,772,820, elites2,769,780, Bosses3,741,000. D7+ accounts for14,468,210. HP awards and excess reinforcements do not supply training credit. Actual healing and shield-generation source maps are preserved separately from HP damage, shield absorption and training.

### Spike and stall boundaries

The full120 largest rolling-one-second HP loss is59.4725% in random1600 `run-39` D4, which dies in that layer. The D7+ maximum is53.9295% in auto1600 `run-67` D11; it clearsD11 and later diesD14. The earlier D11 peak cannot be attributed to the later D14 fatal projectile. Likewise, run39's tiny terminal poison tick does not identify the cause of its D4 rolling peak. Peak metrics have no exact window timestamp or per-hit binding; stage totals are context only. Bloodpact is excluded from these rolling HP metrics, and a35% ordinary single-hit cap is not a combined-one-second cap.

All90 deaths retain terminal `player_damage` events; none starts that terminal hit at fullHP. The19 D7+ deaths comprise18 ordinary impacts and one Slam, with pre-hit HP about2.11–33.43% maxHP. This sample contains no fullHP ordinary single-hit death; it does not guarantee survival on other inputs. The longest endless layer is153.975 player seconds (D1), longest D7+ layer120.517s, longest idle interval4.75s, and longest complete run2581.275s clearing20. Zero budget/error/cancel outcomes and these durations provide no observed extreme-stall signal within the unchanged budget.

### Accepted calibration scope

Root accepted the PRE candidate using the four successful campaign medians, continued late attrition, D10→20 minion growth in the measured player clock, observable warning/reselection distinction, actual attack/mitigation costs and bounded measured spikes/durations. It was not accepted merely because integrity passed, a skill released or a death quota was met. Strong-build HP protection, some accelerating cohorts, shorter leader hostile lifetimes and stage2 concentration remain explicit limitations. The next delivery record and bounded PRE playtest must retain those limits; this is not a human win-rate result or production release authorization.

The small [endless-v4-audit.json](../experiments/balance/endless-evolution/endless-v4-audit.json) and [hash index](../experiments/balance/endless-evolution/endless-v4-hashes.json) retain all120 denominators, both clocks, support fractions, sources, lifecycle and native bindings. Full independent audit is under `audit-v4/outputs/endless-2026-10-27T06-50-41-172Z/`, original index SHA-256 `0e2bddb0897e2605e0bd8be993b12c068aaeefd3e1860bdf9bf99fe84df2fd9f`. All120 native rows/shards/audits/sidecars,121 bounded carriers, frozen source/profile, collector and prospective chronology passed; the auditor ran zero World instances. Full offline gameplay, common-stratum and terminal reductions are retained at `artifacts/balance/endless-evolution/v4-gameplay-analysis-20261027/`; native bytes are unchanged.

## Q development rules and protected prefix

Q combines three bounded changes with the previously tested P recovery rules. Campaign and endless depths 1–6 retain their existing rules. All four development runs match the actual O4 reference's **first ten complete StageSummary records exactly**: four campaign stages plus endless depths 1–6, including rewards and post-reward snapshots.

- From depth 7, enemy-HP-derived damage against a minion shares that target's existing quarter-second pool at rate `0.20 / (1 + 0.08 × (depth − 7)) × enemyMaxHP` per player second. Raw/own-HP damage and execution remain unchanged.
- From depth 7, an ordinary `melee:` or `projectile:` hit requests at most 35% of player max HP before the existing shield and hit-immunity resolution. Poison, bloodpact and Slam are excluded; the existing deep Slam limit remains 45% max HP. A single-hit cap is not a rolling-one-second cap.
- Wave admissions form pairs at depths 7–12 and triples at depth 13+. For authored interval `b`, internal gap is `min(0.25, b / 2)` and final gap is `size × b − internalGap × (size − 1)`. A complete pack's gap sum preserves the authored mean cadence. Successful admissions alone advance its cursor; failed births do not spend quota. A partial final pack adds no enemies. Finite-wave completion time is not asserted identical.

P's depth-7+ recovery rules remain: actual combat HP and shield gains share `4% / (1 + 0.075 × (depth − 7)) × playerMaxHP` per player second with a quarter-second capacity. New combat shield gains also respect capacity `max(0.25, 1 − 0.05 × (depth − 6)) × playerMaxHP`; existing excess shield is retained. Earlier lifesteal limits and other authored recovery conversions remain in place. Q does not retune CC, giantPower, rewards, damage growth or the numerical profile payload. Hostile-projectile provenance is recorded independently of observer attachment so observation cannot change which hit cap applies.

The Q development source fingerprint `44bad0e5d5e6b1a9ffca2a959b12be6f7ee12577ce2ac367b6a9d706668a1187` includes reversible passive metadata. It is **not the formal v4 runtime fingerprint above**. The Q reference's metadata-free World file is SHA-256 `36127cc574208edb025fe157af3c8543e28b11a410e3466fe9787095b43d5d55`; the development observer patch reverses byte-for-byte to that reference. The actual frozen worktree World has SHA-256 `1bb83897e080a2285fede0b12c48061590384decca692b5f6b7f2fc8e8295a80` after removing isolated-prototype wording; the actual-worktree four-result equivalence check above verifies preserved behavior. The development seal predates all four Q runs; source, harness and reference hashes were checked again after completion.

## Four observed inputs: full denominator and risk

| Old observed input | Q natural outcome | D7–20 enemy HP loss O4 → P → Q | Q full-run maximum 1s HP loss |
| --- | --- | ---: | ---: |
| 1074236464 / build-auto / 450 | Clear20 | 28.35 → 173.18 → 888.71 | 26.14% |
| 1074236464 / build-active / 1600 | Death D18; clear17 | 0 → 814.46 → 2009.87 | 31.52% |
| 4136239728 / build-auto / 450 | Clear20 | 1539.20 → 2216.75 → 2870.22 | 45.00% |
| 4136239728 / build-active / 1600 | Clear20 | 269.66 → 933.69 → 754.85 | 33.92% |

The original denominator is **four: three clear20, one natural death, zero unresolved**. Enemy HP loss excludes bloodpact self-cost; totals cover each run's actually reached depths and are not exposure-normalized. The D18 death entered with 259.08/380 HP, lasted 35.275s and had a death-layer maximum one-second HP loss of 25.65%; fatal source was `melee:wisp`. This is not an observed full-health instant kill. No new extreme stall was observed: longest layer 99.21s, longest Boss lifetime about 32.12s, longest idle interval 4.31s. Four selected inputs cannot exclude rare spikes, stalls or early attrition on new inputs.

Only three runs enter D20. Their enemy HP losses are 47.4986/0/0, shield absorptions 219.5141/61.9069/73.0519, and entry shields 0/98/115.5; all three enter at full HP. The missing death input is not assigned zero D20 pressure. Two strong trajectories have no enemy HP loss throughout D17–20 or D16–20, respectively. Conversely, 107-auto takes enemy HP damage in D16–20, and 107-active accumulates injuries in D15–18 until death. Pressure is therefore neither universally absent nor proven adequate for every late build.

D20 has 16 cast starts: 9 interrupts, 5 releases, 2 cancellations on caster death, zero run-end cancellations. All releases meet the 2.4s hostile-clock warning; native unwarned/premature/missing-lifecycle counters are zero. `projectile:boss` includes ordinary and charged projectiles, so the source maps do not expose exact damage caused by each cast. A release counter alone does not establish consequential player pressure.

## Lifetimes, composition and limits

| Depth | Q entries / original four | Minion deaths | Q player / hostile mean lifetime | Player lifetime ≤1s |
| --- | ---: | ---: | ---: | ---: |
| 5 | 4 / 4 | 388 | 1.3350 / 1.2045s | 49.23% |
| 7 | 4 / 4 | 304 | 1.8071 / 1.6954s | 29.61% |
| 10 | 4 / 4 | 288 | 1.8214 / 1.6206s | 28.82% |
| 20 | 3 / 4 | 156 | 1.9370 / 1.5449s | 24.36% |

These are actual defeated-unit birth-to-death lifetimes, including approach and control. Living enemies and fusion donors are not fabricated as deaths; fused units retain original birth time. A ≤1s lifetime is not proof of a single hit. Player time can include Sanctuary while hostile time is frozen. The table changes cohort at D20 and must not be read as an unconditional survival-adjusted depth trend.

For the **same three D20-reaching inputs**, minion player mean is O4 0.9700s → P 1.6827s → Q 1.9370s; hostile mean is 0.8261s → 1.3268s → 1.5449s. Player ≤1s fractions are 62.35% → 27.50% → 24.36%. Holding input, role, birth/death stars and finite-credit band at P death weights gives Q/P ratios 1.1103 player and 1.1311 hostile, with 99.38% P / 98.08% Q common support.

Within those same Q inputs, reweighting D20 to D7 common strata gives minion ratios **1.1431 player / 0.9575 hostile**, with 99.10% D7 / 100% D20 support. Per-input player/hostile ratios are 1.1107/0.9408, 1.1348/1.0416 and 1.1666/0.9126. Raw hostile ratios are about 0.961/1.154/1.102, so reweighting changes the signs of some raw trends. D10→20 minion ratios are 1.0426/0.9511. D7→20 elite ratios are 0.8948/0.7317 and main Boss 0.9634/0.7905. D5→20 elites lack common star support; no ratio is invented.

Matching does not control species, position, exact fusion time, natural reward/build changes or every selection effect. The three Q changes were combined, so this is a paired trajectory comparison rather than a single-component causal estimate. Auto450 and active1600 have different layouts and cannot isolate the effect of targeting. Old observed inputs, successful-subset lifetimes and Bot outcomes are not new-seed confidence estimates or human win rates. **Those four development inputs supported fresh testing only; they did not independently establish the sustained-challenge gate.** The complete fresh evidence and its qualified acceptance are recorded above.

## Small curated records and persistent archives

[development-Q-v4.json](../experiments/balance/endless-evolution/development-Q-v4.json) retains the fixed-input outcomes, predeclaration/protection checks and native archive index. [independent-Q-v4.json](../experiments/balance/endless-evolution/independent-Q-v4.json) retains independent support ratios, risks and output hashes; [independent-Q-v4.md](../experiments/balance/endless-evolution/independent-Q-v4.md) is the unchanged small readonly interpretation. Their [hash index](../experiments/balance/endless-evolution/development-Q-v4-hashes.json) binds the curated bytes. These are summaries, not replacements for native results.

The full ignored artifacts are persisted outside the worktree under the main checkout's `artifacts/balance/endless-evolution/`:

| Persistent record | SHA-256 |
| --- | --- |
| `v4-Q-development-20261027/hash-index.json` (535 indexed files) | `3ffc2c1eb26bc90d71fb995b32b85e9345af32ee776bfb2194295b5d714ba673` |
| `v4-Q-development-20261027/final-audit.json` | `907d1397715f7b0e6ff179056ad09a1f34c7359430fbe6e99b92aea88282566a` |
| `v4-Q-development-20261027-archive-receipt.json` | `f1bc8385a59dc715c9e04d9c5e32a74261ce30ef23b947b3201d659f71f403cd` |
| `v4-Q-independent-readonly-20261027/hashes.json` | `32dcfc563964b655709a5d19fe25bfb96a6a708e8acfc36dbfd829ae478e0e0e` |
| `v4-Q-independent-readonly-20261027/archive-receipt.json` | `1b1043b2b0615bf25fd4b4fbd6bd1d791bf8338daa2092d242a85cbc6ae15dbc` |

Independent reduction read 36 O4/P/Q result/sidecar files and matched every input SHA to the persistent Q archive. Native artifacts were not rewritten. The original development archive, independent output indices and historical v1/v2/v3 rejection reports remain intact. The V4 auditor at `artifacts/balance/endless-evolution/v4-runner-20261027/audit-v4/` retains the V3 integrity checks with V4 identities, paths and protocol metadata. Complete300/600/120 measurements, local engineering/browser proof and the root PRE-candidate calibration decision are recorded above. The [curated hash index](../experiments/balance/endless-evolution/calibration-v4-curated-hashes.json) binds this report and its small summaries. The auditors themselves grant no deployment authorization; later source/review/merge/Wiki/PRE results belong in the PR delivery record.
