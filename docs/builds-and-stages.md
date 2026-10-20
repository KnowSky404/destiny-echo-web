# Card builds and continuous stages

Status: implemented locally. Content is run-local, data-driven and uses the existing fixed-defense simulation. This document defines gameplay behavior; [architecture](architecture.md) defines engine and input boundaries.

## Goals

- Make collecting related **different** cards unlock major combat changes.
- Let a completed build keep fighting beyond the first boss.
- Preserve the current visual style, fixed position, targeting, pause behavior, bounded pools and static hosting.

## Cards and synergy thresholds

Twelve cards belong to four families. One copy of each different card counts toward its family. Repeated copies only strengthen that card. Tiers activate at two and three different cards, derive from the collection, and do not mutate base stats a second time. Mixed families can coexist.

| Family | Cards | Two different cards | Three different cards |
| --- | --- | --- | --- |
| 殉星自爆 / Blast | 过载刻印, 余烬引信, 殉星契约 | Explosion damage ×1.8; radius 130 → 175 | Explosion kills propagate the death explosion; sacrifice repeats every 3s instead of 5s and max-HP scaling rises from 15% to 45% |
| 祷言弹幕 / Barrage | 急速咏唱, 分岔祷言, 因果贯穿 | Effective firing interval ×0.85; secondary damage 60% → 100% | Every fourth volley launches one extra full volley |
| 不落壁垒 / Bastion | 续杯仪式, 守夜契约, 荆棘圣约 | Restore 10 shield every 3s, up to 60% max HP | Successful incoming hits also damage every enemy for 50% max HP; thorns damage doubles |
| 终焉裁决 / Judgment | 防线裁决, 破绽凝视, 终焉回响 | Add 35% damage against preparing/attacking enemies | Double damage against charging bosses; an enemy damaged to ≤15% HP is executed, including bosses |

Base cards retain their earlier effects. New card behavior:

| ID | Effect per stack | Cap |
| --- | --- | --- |
| `fuse` | A kill explodes at the victim for 16 damage in radius 130 | 4 |
| `bloodpact` | Every 5s with a valid enemy target, sacrifice up to 3 HP and explode there for `20 × stacks + 15% max HP` | 3 |
| `thorns` | A successful nonlethal incoming hit retaliates against the current enemy for 18 damage | 4 |
| `focus` | Add 20% damage against bosses | 3 |
| `harvest` | Heal 2 HP on each kill, up to max HP | 3 |

Sacrifice cannot kill or heal the player, consume shield, trigger thorns or grant invulnerability. Its countdown can wait for a valid enemy; chests cannot trigger sacrifice. Regeneration never removes shield above its automatic cap. Invulnerability blocks both another incoming hit and its retaliation; a lethal incoming hit resolves defeat before any retaliation/healing.

All enemy damage uses the same path: apply attacking/boss/judgment bonuses, charging multiplier and execution, then either record an interrupt or deactivate and settle one kill. Death healing and score occur exactly once. Blast kills only enqueue another death explosion with the full blast family. Resolution is iterative and bounded by the enemy pool, and stops as soon as a stage or run ends. AoE and retaliation do not damage chests or grant rewards. Exhausting visual pools never cancels gameplay damage.

## Reward selection and visibility

- Every offer contains three distinct eligible cards. Existing stack caps apply in every stage and endless mode.
- If an eligible missing card belongs to an already owned family, one slot offers such a card. Other slots preserve alternative builds.
- Every offer includes a direct offense card (`overload`, `haste`, `multishot`, `fuse` or `bloodpact`). Overload, vitality and ward remain uncapped, preserving three choices after bounded cards cap.
- Cards show their family and `owned → next / 3` progress, identify tier activation/transformation and preview the newly unlocked effect. Duplicate cards explicitly say they do not increase the family count.
- Four keyboard/touch-operable disclosure rows show family progress, constituent cards and both tier effects. Active tiers have family colors. Explosion rings use a bounded effect pool and respect reduced motion.
- Narrow-screen overlays stay within the arena and scroll internally when needed; reward cards and the endless action remain touch-operable. Reward and supply overlays freeze all simulation, including both clocks, build timers and enemies. Claiming validates phase, source, token, membership and eligibility before consuming the reward. Tokens remain monotonic across stages and restarts.

## Four authored encounters

| Stage | Regular encounter | Boss | Boss HP | Arrival / deadline | Boss support |
| --- | --- | --- | --- | --- | --- |
| 1 · 圣杯前庭 | Original mixed defense; 35% sentinels | 失控圣杯 · 空愿之器 | 2,000 | 52s / 88s | None |
| 2 · 棱镜回廊 | 70% sentinels; HP ×1.3, damage ×1.1 | 折光主教 · 千面棱镜 | 4,300 | 48s / 90s | Sentinel every 9s |
| 3 · 焚星熔炉 | 80% wisps; HP ×1.7, speed ×1.25, damage ×1.2; prepare from y = 450 | 焚星之心 · 永燃余烬 | 7,200 | 46s / 90s | Wisp every 7s |
| 4 · 终愿核心 | Mixed pressure; HP ×2.1, speed ×1.15, damage ×1.35 | 终愿之器 · 命运归零 | 11,000 | 48s / 96s | Sentinel every 6s |

Authored boss identities share the original procedural boss silhouette; palette, HP, fan size, attack cadence, charge timing/thresholds and support differ. They do not claim four new art assets. Stage data owns these parameters. All bosses still advance to the defense and prepare before attacking. Furnace support uses the stage's region policy. Reinforcements reserve ordinary defense slots and share the 14-enemy budget with the boss.

Each stage has its own elapsed time, five-wave progression, chest schedule, boss arrival and deadline. Total elapsed time is cumulative. Stage one keeps the original schedule; later chests stop scheduling at `min(46, bossAt - 5)`. The stage HUD shows encounter name, cleared count, local time and deadline; the main clock shows cumulative time. Tested complete campaigns take roughly 4–6 minutes, excluding overlays/pauses.

## Stage progression and endless continuation

1. Defeating bosses one to three clears combat entities, target locks and pending chains, awards the boss score/health bonus, and enters `StageClear`.
2. `StageClear` shows the next encounter and its rule, plus a three-card supply. It cannot be bypassed with pause, resume or restart actions.
3. Claiming one supply keeps cards, base stats, shield, HP, score, kills, RNG progression and total elapsed time. It heals up to 35 HP and advances exactly one stage. Stage time, schedules, cooldowns, volley cycle, particles and rings restart. A stale or repeated click cannot advance twice.
4. Defeating boss four enters `Victory`. The player can restart, return to the menu, or choose **继续无尽 · 保留构筑**.
5. Endless preserves the build and heals up to 35 HP. It cycles the four encounter themes. At depth `d ≥ 1`, health uses `min(1000, 1.25^d)` times the fourth-stage baseline; damage is capped at ×4 and spawns remain bounded. Boss HP begins at 13,750 and rises each stage until its finite safety cap. Interrupt thresholds also grow. Every endless boss grants a stage supply and the next encounter.
6. HP exhaustion or the current stage's deadline ends the run. Restart always returns to stage one with base stats, no build, no effects and cleared counters. There is no persistent save.

## Acceptance and limits

Bun tests verify actual tier effects, repeated-card rules, eligible offers, nonlethal sacrifice, chain bounds/unique kills, healing, shield caps, retaliation invulnerability, boss execution/interrupts, independent stage clocks, early preparation, boss reinforcements, stage supplies, stale tokens, restart, full campaigns and two additional endless bosses using only public target/card/continue inputs.

Playwright verifies desktop and 320px touch rewards, tier previews/activation, real rendered chain kills, frozen stage supplies, carried builds, final-victory/endless actions, pause/target input and production assets. Browser fixtures are explicit and separate from natural runs. Full multi-stage natural runs are simulation evidence; browser natural coverage exercises first-stage advancement and failure. Screenshots and traces stay in the system temporary directory. Physical mobile devices, long endless performance and human difficulty tuning remain manual checks. No deployment is implied by local verification.
