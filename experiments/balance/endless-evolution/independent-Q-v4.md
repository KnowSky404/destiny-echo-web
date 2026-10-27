# Independent Q readonly observed-input comparison

Recommendation: the fixed Q candidate is reasonable to freeze and take to fresh selection/validation. This is a development-screen decision, not release acceptance, proof of increasing challenge in every group, a required death quota, or a human result. No World execution, retune, reserved seed or official document edit was performed.

Original denominator4: three natural clear20 and107-active1600 natural death atD18 (17cleared). Death/nonentry are preserved. First10 full StageSummary records and configs are exact O4/P/Q matches; all four completed native receipts, sidecar acceptance and source checks passed.

| Depth | Q input entries / original4 | Same-input minion mean player O4/P/Q | Same-input hostile O4/P/Q | Q player<=1s | Q/P common-stratum player/hostile ratio |
|---|---:|---:|---:|---:|---:|
| 5 | 4/4 | 1.3350/1.3350/1.3350s | 1.2045/1.2045/1.2045s | 49.23% | 1.0000/1.0000 |
| 7 | 4/4 | 1.4448/1.7776/1.8071s | 1.3876/1.6575/1.6954s | 29.61% | 1.0249/1.0333 |
| 10 | 4/4 | 1.1489/1.7272/1.8214s | 1.0862/1.5340/1.6206s | 28.82% | 1.0718/1.0738 |
| 20 | 3/4 | 0.9700/1.6827/1.9370s | 0.8261/1.3268/1.5449s | 24.36% | 1.1103/1.1311 |

AtD20 the same three inputs are used for all O4/P/Q means; the fourth input is missing, never zero-filled. Q/P common support is99.38% of P deaths and98.08% of Q deaths. Matching retains input identity, role, birth/death stars and finite-credit band, weighted by baseline deaths. Species, positions, exact fusion times and subsequent natural build divergence remain uncontrolled. No direct causal comparison of auto450 vs active1600 is made.

Within the same three Q D20 entrants, common-stratum D7->20 minion ratios are1.1431(player)/.9575(hostile), with99.10% D7 and100% D20 support. Per-input ratios are1.1107/.9408,1.1348/1.0416,1.1666/.9126. Raw hostile ratios are approximately .961/1.154/1.102; reweighting changes the latter two signs, so a claim that every hostile-clock cohort slows would be false. D10->20 minion ratio1.0426/.9511. D7->20 elite.8948/.7317 and boss.9634/.7905. D5->20 elite has no common star support and no ratio is invented. Player clock includes Sanctuary, so more player lifetime alone is not proof of more hostile activity.

| Original input | Q natural result | D7–20 enemy HP O4/P/Q | Q fullrun maximum1sHP loss |
|---|---|---:|---:|
| seed1074236464-auto450 | endless_target_reached (cleared20) | 28.35/173.18/888.71 | 26.14% |
| seed1074236464-active1600 | death (cleared17) | 0.00/814.46/2009.87 | 31.52% |
| seed4136239728-auto450 | endless_target_reached (cleared20) | 1539.20/2216.75/2870.22 | 45.00% |
| seed4136239728-active1600 | endless_target_reached (cleared20) | 269.66/933.69/754.85 | 33.92% |

Enemy HP excludes bloodpact. Q D18 death entered259.08/380HP, lasted35.275s, death-layer max1sHP25.65%, fatal melee:wisp; it is not an observed full-health instant kill. Q longest layer99.2083s, boss lifetime at most32.12s, longest idle4.3083s; no new extreme stall was observed within the unchanged7200s/864000step budgets. Four selected inputs cannot rule out rare spikes or stalls.

| D20 input | Enemy HP / bloodpact | Shield absorbed | Entry HP / shield | HP heal L/R/H | Overheal shield L/R/H | Cast start/int/release/death/runend |
|---|---:|---:|---:|---:|---:|---:|
| seed1074236464-auto450 | 47.4986/51 | 219.5141 | 350/0.00 | 44.81/53.69/0.00 | 88.77/233.81/1.36 | 6/3/2/1/0 |
| seed1074236464-active1600 | not entered afterD18 death | — | — | — | — | — |
| seed4136239728-auto450 | 0.0000/54 | 61.9069 | 280/98.00 | 20.56/31.28/2.16 | 22.86/19.45/3.60 | 5/1/3/1/0 |
| seed4136239728-active1600 | 0.0000/45 | 73.0519 | 330/115.50 | 17.70/27.30/0.00 | 9.25/10.65/0.00 | 5/5/0/0/0 |

L/R/H means lifesteal/regeneration/harvest, accepted writes per whole layer, not rates or requested potential. Minor bastion and all other sources are preserved in late-source-flow.json. D20 has16starts=9interrupts+5releases+2entity-death cancellations, no run-end cancellation; all releases meet2.4s hostile warning and native lifecycle anomalies are zero. Training remains finite minion/elite/boss kill credit; full per-layer source/card/training records are retained.

Sustained-pressure limit: two surviving builds have zero enemy HP loss throughout D17–20 (413-auto) or D16–20 (413-active), despite receiving shield damage atD20. All three D20 entrants begin at full HP. Strong builds can still cover damage; this is not claimed fixed for all inputs. Conversely, Q107-auto takes enemy HP damage inD16–20 and107-active accumulates injury inD15–18 until natural death. Therefore pressure is not merely a one-off D7 step or a required release counter.

These observations justify testing generalization with a separately frozen fresh matrix rather than further tuning these four inputs. Fresh integrity, pacing, challenge and safety outcomes must still be evaluated as their own gates; neither this report nor root adoption marks gameplay/release accepted. No additional parameter is recommended here.
