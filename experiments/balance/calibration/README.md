# Stage calibration protocol

This directory freezes the pre-calibration profile and reproducible experiment inputs for the 2026-10-22 calibration. Run with the repository's `Balance Simulator V1`, which drives the production fixed-step `World` through natural rewards and targeting. No injected builds, manual/injected healing, debug jumps or skipped encounters participate in adoption evidence.

The approach follows [Riot's measured, segmented balance framework](https://www.leagueoflegends.com/en-us/news/dev/dev-balance-framework-update/) and [research on autonomous agents as supplementary balance testing](https://arxiv.org/abs/2304.08699). These support methodology, not a universal PvE win-rate standard. Proxy performance does not establish human difficulty or enjoyment.

Selection uses master seed `20261022`. Freeze the candidate before running `validation.json` (master seed `20261028`); do not tune repeatedly against those seeds. Selection has 100 game seeds per strategy/layout; the expanded independent validation has 300. Each set is paired across the before/after profiles. The strategy RNG is fixed within a group. `sensitivity.json` separately changes strategy seeds and tests the desktop width bounds; `endless.json` naturally carries campaign builds into two finite endless layers.

Project design observations, chosen before holdout evaluation:

- Build strategies should usually reach later stages: observe first-stage clearance around 65–95% and campaign completion around 25–75%.
- Random reward choice should retain attainable successes and meaningful failures; compare it separately from build strategies.
- Later encounters should produce actual hostile actions and damage/shield pressure; exclude sacrifice self-damage when interpreting survival. Strong builds can legitimately clear without injury.
- Compare mobile/desktop separately, including confidence intervals, sample counts and conditional vs cumulative stage clearance. A gap above 20 percentage points requires explanation and further investigation.
- Zero runtime errors, invalid metrics, missing/cancelled runs and exhausted budgets are required in adoption batches. A dead run is a resolved outcome, not an error.
- Review every stage's health, damage, timing, counts, capacity, boss duration, charge/interruption, escorts, reward economy and endless transition. Retain parameters that already serve the encounter; avoid changing numeric fields merely to create a diff.

These are design observations rather than CI assertions or promises about real players. The final report records deviations, uncertainty and the root design decision; satisfying the hard integrity gates does not imply every soft observation band was met. The unbounded tail of endless mode cannot be proven balanced by two-layer simulations; inspect deeper derived numbers and retain bounded pools and overflow protections.

## Completed fifth-revision matrix

The frozen F candidate completed all 36 strict cells: **1,200 selection + 3,600 independent validation + 360 natural endless + 288 sensitivity = 5,448 records** (3,048 candidate and 2,400 baseline). Every expected record resolved without errors, invalid metrics, missing/cancelled outcomes or exhausted budgets. All four collections use candidate profile `e33fe7cbc2c26362482762303b3b93aa6d2fed0dcc4b776cdef0d883543df102`, simulation fingerprint `359b7c2478e4e28cc99996b7a6b6cdab9993e901493c95a9e4c67ff7089226e0` and strict collector SHA-256 `32a3af2edb022e0657493b9b78fdd5ee437c2029c53b473042d38f97c985e0f2` (the paired phases also retain the frozen baseline). Two exact CLI replays of existing selection cases passed; they add zero statistical samples. Independent full-matrix peer review verified all cells, raw digests, 255 reported interval entries (249 Wilson intervals and six zero-entry/null cases), 73 warnings, 88 paired harms and both replay receipts without new simulations.

The root decision adopts F while explicitly recording that **not all soft observation bands are satisfied**. Desktop builder completion/opening rates exceed their references; stage two remains the principal campaign build filter, while later hostile-injury medians are zero in all six campaign groups. Random-policy seed 17 wins 0/16 at width 800 and 1/16 at 2400. The eighteen sensitivity cells share sixteen game seeds; deterministic builder repetitions are consistency controls and are not pooled as independent diversity. Natural endless reaches two layers in 191/360 attempts, retains 191 zero-time next-layer censored entries and the 6.095× first-boss HP jump. These limitations, the six weak-control diagnostic deaths and all prior rejections remain in the [calibration report](../../../docs/balance-calibration-2026-10-22.md). The evidence index and clean-main delivery steps are separate from numerical adoption; no Wiki or Cloudflare deployment follows merely from these results.

Commands (use new output directories; do not overwrite an interrupted run):

```sh
bun scripts/calibration-evidence.ts prepare --inputs artifacts/balance/calibration-inputs
```

The preparer prints all 36 bounded cell commands. Run the six selection cells, review them and freeze the candidate before running validation. The other phases contain six endless cells and eighteen sensitivity cells. Each cell uses a single strategy/layout; the paired selection/validation cells retain both profiles and all declared seeds. Splitting execution does not reduce or sample the declared matrix: adoption requires 1,200 selection + 3,600 independent validation + 360 endless + 288 sensitivity = 5,448 runs.

After every cell in a phase completes, collect its evidence with the strict collector (repeat for `validation`, `endless` and `sensitivity`):

```sh
bun scripts/calibration-evidence.ts collect --phase selection --cells artifacts/balance/calibration-cells --out artifacts/balance/calibration-selection-evidence.json
```

The collector rejects incomplete or unexpected cells, duplicate/missing seeds, mismatched profiles or simulator source, unresolved outcomes, exhausted budgets and invalid metrics. It recomputes rates, Wilson 95% intervals and stage pressure from the complete run records, then records input digests. Validation is identified by its independently frozen phase/configuration; the simulator's paired-comparison raw cohort label remains `selection`. Compare all four resulting source fingerprints and the candidate profile hash before adoption. Incomplete/interrupted exploratory runs are diagnostic only and are excluded from the formal cell directory.

The second candidate passed selection but failed independent validation master `20261023`: one natural run still had three ordinary enemies alive at 650 seconds. The expanded-budget diagnostic cleared at 655.09 seconds and is explicitly excluded from adoption. `rejected-v2.json` and `rejected-v2-audit.json` preserve the failed candidate, complete phase counts, source digests and post-boss cleanup tails. These inspected validation seeds are now exploratory only. The third revision also failed its separate `20261026` validation, with one living, low-output random-policy run still fighting the final boss at 650 seconds. `rejected-v3.json`, `rejected-v3-validation-protocol.json` and `rejected-v3-audit.json` preserve that complete rejection and the observed 85% active-desktop completion deviation. Both consumed validation sets are now development data only. The rejected fourth revision used prospectively reserved `20261027`, expanded to 300 seeds per cell before its candidate selection, preserving the strategy/layout matrix and 650-second budget. `fresh-validation-v4-reservation.json` preserves that reservation; the earlier reservation belongs to rejected revision three.

The first 125,000-HP finale candidate is preserved in `rejected-v1.json`, with historical hashes and the failed gate in `rejected-v1-audit.json`. Its six complete cells contained one unresolved 650-second run; it is not adoption evidence. A separate diagnostic extended that exact run to a natural victory at 703.70 seconds. Every revised candidate must repeat the full selection matrix under the original budget; neither the diagnostic nor the first selection replaces any final required cell.

Full append-only run evidence stays in ignored `artifacts/balance/`; commit only the fixed profiles, experiment inputs and compact reviewed evidence. PRE browser automation and live asset verification are additional gates; they do not prove physical-device comfort or long-session balance.

The fourth candidate selects variant A from `v4-joint-probes.json`: stage-three HP 8.1× / boss 28,000 and finale HP 16.2× / boss 56,000, preserving incoming damage. The deliberately selected 50-case diagnostic supports pacing diagnosis only. Its results are excluded from all final phase counts.

The fourth candidate also failed its expanded independent `20261027` validation: 3,599/3,600 paired records resolved, while candidate random-desktop seed 1632591434 remained alive after its boss died at 599.01 seconds. V4 selection/local QA remain explicitly historical in `rejected-v4-evidence/`; its validation is not accepted. The fifth revision subsequently used prospectively reserved independent master `20261028`, still 300 seeds per group with the same 650-second/78,000-step hard gate. See `fresh-validation-v5-reservation.json`. The 475-second diagnostic target is excluded from adoption counts.

The fifth candidate chooses variant F from the complete 240-run known-case durability comparison and 36 natural endless probes: stage-three HP 4.5× / boss 16,000, finale HP 9× / boss 32,000. All 61 previous winning controls remain wins, all four historical budget configurations win, and the longest successful diagnostic run is 470.05 seconds. Four common wins slow down. F retains more observed late attack/injury coverage than G. The first endless boss remains 195,039 HP, a 6.095× finale jump; six selected weak controls die there and six selected strong controls clear two layers. These development probes are excluded from all 5,448 formal acceptance samples.

Reviewed development diagnostics: [complete paired projection](v5-life-probes.json), [projection provenance](v5-life-projection-map.json), [human interpretation](v5-life-probes.md) and [natural-continuation boundary annex](v5-endless-prefix-annex.json). Original full records and source hashes remain in ignored artifacts; these probes contribute zero formal acceptance samples.

The post-review collector reconciles each direct stage enemy-action counter with its mechanic count. All 5,448 original records pass recollection without changing numerical results. Original collector-76 audits, freeze records and decisions remain historical; the [post-review resolution](evidence/post-review-resolution.json) reaffirms adoption and preserves every soft deviation.
