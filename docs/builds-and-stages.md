# Card builds and continuous stages

Status: implemented. This is the content and baseline-parameter contract, not a claim that difficulty is balanced. [Architecture](architecture.md) defines engine/input/state boundaries. Runtime sources are `src/data/{cards,synergies,enemies,stages}.ts`, `src/game/stats.ts` and `src/game/world.ts`.

## Ten families, thirty cards, three breakpoints

Each acquired card layer contributes **one family point**, including repeat upgrades. At **3 / 6 / 9** points, a family gains a small / medium / large transformation. Higher tiers retain lower-tier effects unless explicitly replacing a number or cadence. Tiers are derived from the collection rather than permanently multiplying base stats. Base-card upgrades can continue after tier nine; the HUD caps the progress bar at nine and shows the actual layer total in the disclosure. Multiple families coexist.

| Family | Three cards and their base effects | 3 layers | 6 layers | 9 layers |
| --- | --- | --- | --- | --- |
| 殉星自爆 / `blast` | 过载刻印: +4 damage; 余烬引信: death explosion 16 damage/layer; 殉星契约: sacrifice explosion | Explosions ×1.4, radius 160; all ordinary-enemy kills can create the base death explosion | Blast kills propagate; sacrifice every 4s, including without a sacrifice card | Explosions ×2, radius 190; sacrifice every 3s, max-HP scaling 45% |
| 祷言弹幕 / `barrage` | 急速咏唱: interval ×0.88; 分岔祷言: +1 secondary; 因果贯穿: +1 penetration | Interval ×0.88, secondary damage 80% | Every fourth volley echoes; secondary damage 100% | Interval ×0.75, +1 projectile, echo every third volley |
| 不落壁垒 / `bastion` | 续杯仪式: +20 max HP / heal 30; 守夜契约: +24 shield; 荆棘圣约: retaliate for 18/layer | Restore 10 shield every 3s, automatic cap 60% max HP | Thorns ×2; incoming hits retaliate globally for 25% max HP | Restore 20 shield, automatic cap 100% max HP; global retaliation 50% max HP |
| 终焉裁决 / `judgment` | 防线裁决: +20%/layer vs Attacking; 破绽凝视: +20%/layer vs bosses; 终焉回响: heal 2/layer per kill | +20% vs Preparing/Attacking | Execute at 8% HP; charging-boss damage ×1.5 | Execute at 15%; charging-boss damage ×2 |
| 泰坦重击 / `might` | 巨力刻印: +5 damage; 泰坦意志: +12 percentage points attack multiplier; 破城重锤: +25% heavy-volley damage/layer every fifth volley | Attack damage ×1.2 | Heavy volley every fourth volley, +30% in addition to the card | Heavy volley every third volley, +80% in addition to the card |
| 猩红渴望 / `blood` | 渴血刻印: 4% lifesteal/layer; 不息血泉: 1.2 HP/s/layer; 赤色恩赐: +15% combat healing/layer | +5 percentage points lifesteal | 50% overheal becomes shield, cap 40% max HP | +10 percentage points lifesteal instead; regeneration ×2; all overheal becomes shield, cap 80% max HP |
| 命定暴击 / `precision` | 命定锋芒: +8 percentage points crit chance; 致命祷词: +0.25 crit multiplier; 弱点解剖: +12%/layer vs enemies below half HP | +10 percentage points crit chance | +0.25 crit multiplier | Another +0.5 crit multiplier; every third volley guarantees crits |
| 雷霆共振 / `storm` | 跃迁闪电: +1 lightning target, 30% shot damage; 共振电弧: 15% splash damage/layer, radius 85; 雷暴仪式: periodic AOE | +1 lightning target; splash radius +20 | Another +2 lightning targets; storm every 4s, including without its card | Storm every 3s; lightning/storm damage ×2 |
| 永冬结界 / `frost` | 寒霜刻印: 10% slow/layer for 2s; 碎冰咒: +12%/layer vs slowed enemies; 永冬脉冲: field slow every 6s | +10 percentage points on-hit slow; duration 3s | Every fourth hit on an enemy freezes it for 0.6s | Every third hit freezes for 1s; +30% damage vs slowed enemies |
| 王权禁锢 / `dominion` | 震慑刻印: every fourth primary hit stuns for 0.15s/layer; 破阵敕令: +12%/layer vs stunned/charging enemies; 静默王权: field stun every 8s | Stun duration ×1.3; +20% vs stunned/charging enemies | Field stun every 6s even without its card; also clears hostile bullets | Stun duration ×1.6; +50% interrupt contribution; stunned kills restore 8 shield up to max HP |

Base player stats: 100 HP, no shield, 12 damage, 0.34s interval, one projectile, no penetration, 0% crit chance and a 1.5 crit multiplier. Effective interval has a 0.08s floor; total projectile count caps at six, random crit chance at 85%, lifesteal at 50%, slow at 70%. Guaranteed critical volleys bypass the random chance cap. Crit chance uses an independent seeded combat RNG, so rolling crits does not consume reward/spawn randomness.

Card caps remain per ID. `overload`, `vitality`, `ward`, `force` and `renewal` are uncapped; haste caps at six, multishot at four/five base projectiles, piercing at three. Judgment's three cards cap at three each, so all nine points are reachable. Other new caps are recorded in the card data, and capped cards leave the reward pool. Every family can reach nine using its eligible cards.

Attack damage is `base damage × (1 + power) × might bonus`, followed by heavy-volley/secondary/critical multipliers. Target-dependent damage bonuses add before the charging-boss multiplier. Lifesteal uses **actual direct projectile damage**, excluding overkill, executions' extra removed HP, chests, explosions, lightning and retaliation. Combat healing amplification applies to lifesteal, kill healing and regeneration. Fixed card/supply heals retain their stated values. Neither regeneration nor overheal removes shield above an automatic cap.

Sacrifice consumes up to 3 HP without killing, consuming shield, granting invulnerability or triggering retaliation. Its base explosion is `20 × max(1, bloodpact layers) + 15% max HP`; nine blast points replace the HP term with 45%. It waits for an enemy target, never a chest. Retaliation cannot revive a lethally hit player.

Lightning chooses distinct nearby enemies per projectile and never returns to its primary victim. Splash excludes its primary victim. AOE cannot damage chests or claim rewards. Death explosions use an iterative queue; victims deactivate before enqueuing, so chains settle each death/score/heal once and stop when a stage or run ends. Cosmetic pool exhaustion never suppresses damage.

Slow affects movement, preparation, ordinary attack timers and boss charge timers. Stun freezes those timers while its own duration advances in combat. Bosses receive half slow strength and one-quarter stun/freeze duration. Repeated effects refresh durations with `max`, rather than adding unbounded stun durations. Freeze counts all projectile hits; 震慑 counts primary-projectile hits separately. Pause, rewards and endings freeze all status timers.

Periodic storm damage is `effective attack damage × (1 + 0.5 × max(1, storm layers))` in radius 150, every 6s before its family bonuses. Frost pulse slows the field by `20% + 5% × layers`, for 2s/3s. The control pulse lasts `max(0.5, 0.25 × layers)` seconds before duration bonuses and boss resistance.

## Rewards and visibility

- Every offer has three distinct eligible IDs. The first offer includes two foundation upgrades.
- Up to two slots follow the eligible family with the highest accumulated investment. Repeat copies count and can cross a breakpoint. The remaining slot permits another route.
- Every offer retains at least one foundation upgrade: overload, haste, multishot, piercing, force, momentum, chain, splash or stormcall. Pure conditional bonuses cannot be the only way out of a weak opening.
- The first chest appears at 3s. Further chests schedule seven seconds after the previous admission, through `min(46, bossAt - 5)`, with at most one chest active.
- The reward preview names the next breakpoint and newly unlocked effect. Ten keyboard/touch disclosure rows show progress, per-card layers and all three tier effects. HUD values use effective firing/crit/lifesteal stats.
- Reward/supply overlays stay within the arena and scroll internally on narrow displays. Claims validate phase, source, monotonic token, offered membership and eligibility, then consume the capability before resuming. Stale clicks cannot claim again or advance twice.

## Authored encounters and both attack roles

| Stage | Ordinary budget / simultaneous limit | Regular HP / speed / damage | Boss HP | Arrival / deadline | Mixed escort repeat |
| --- | --- | --- | --- | --- | --- |
| 圣杯前庭 | 40 / 14 | ×1 / ×1 / ×1; 35% sentinels | 2,000 | 52s / 88s | 4 every 2s |
| 棱镜回廊 | 52 / 18 | ×1.3 / ×1 / ×1.1; 70% sentinels | 4,300 | 48s / 90s | 6 every 2s |
| 焚星熔炉 | 68 / 21 | ×1.69 / ×1.25 / ×1.2; prepare at y=450 | 7,200 | 46s / 90s | 7 every 2s |
| 终愿核心 | 88 / 28 | ×2.197 / ×1.15 / ×1.35; mixed melee | 11,000 | 48s / 96s | 9 every 2s |

Campaign difficulty compounds from stage one with `c(i)=1.3^i` for `i=0..3`: regular HP uses `c(i)`, ordinary admission budgets use `ceil(40×c(i))`, and escort batch sizes use `ceil(4×c(i))`. The ordinary spawn interval is `(boss arrival - 0.8)/budget`, with the first admission at 0.8s. Counts are rounded from the unrounded baseline. Boss HP retains the authored values above, which already increase more than 30% at each campaign transition; speed, damage and attack patterns remain encounter-specific.

Wisps and sentinels now perform melee strikes against the defense only after arriving and preparing. The new cyan **蚀光术士 / hexer** has 66 base HP, speed 96/s, 1.2s preparation, one 7-damage projectile every 2.8s at speed 190/s. It can prepare from y=120, shoots while approaching, and stops in the midfield around y=340 (adjusted by its slot row). Its released projectiles remain dangerous after it dies.

**Every boss**, including stage one, immediately enters with melee and ranged escorts. New mixed batches arrive every **2 seconds** while the boss lives, without a total escort quota and independently of the ordinary-wave budget. All escort admissions follow a persistent one-hexer/three-melee cycle, including partially admitted batches. Boss entrance clears the preceding regular wave and hostile shots, then admits the boss and initial mixed batch in the same simulation step. A full regular pool cannot block it. Subsequent batches fill only free slots within the stage's simultaneous cap; unused batch capacity is discarded rather than accumulating an unbounded queue. Escorts keep acting during the boss's gold charge, providing actual multitarget pressure. Killing the boss immediately clears every escort, chest and projectile and freezes the stage supply/victory screen; surviving escorts never delay clearance. Existing HP/deadline failures still apply.

All bosses retain defense arrival, preparation, gold charge, interrupt and half-HP mechanics. They share the original procedural boss silhouette; palette, parameters, fans and support differ. There are no four new boss art assets. Hexers have their own original procedural texture. Frozen/slowed enemies and critical shots receive distinct colors.

## Endless growth and progression

Campaign bosses one to three grant a frozen supply; claiming retains the build, shield, score, kills and total time, heals up to 35 HP, advances one stage and resets combat schedules/statuses/pools. Boss four grants victory with the optional **继续无尽 · 保留构筑** action. Subsequent endless bosses grant another stage supply. HP exhaustion or the current stage deadline ends the run; restart always resets the campaign and build.

Let `d=1` be the first endless stage, relative to campaign stage four:

```text
g(d) = 1.5 ^ d
regular HP multiplier = 2.197 × g(d)
boss HP = round(11,000 × g(d))
regular spawn budget = ceil(88 × g(d))
spawn interval = (48 - 0.8) / spawn budget
escorts per batch = ceil(9 × g(d)), every 2 seconds while the boss lives
```

Every endless transition increases ordinary population, escort batch size, ordinary HP and boss HP **50%**, starting from campaign stage four. Rounding changes counts by at most one enemy from the ideal target. The initial budgets are 132, 198, 297, 446; escort batch sizes are 14, 21, 31, 46; boss HP is 16,500, 24,750, 37,125, 55,688. Theme rotation changes names/palette, without resetting combat composition, attack policies, health, speed, boss time or density to an easier baseline. Base speed remains ×1.15, boss arrival/deadline remains 48s/96s, and support cadence stays at 2s. Sentinel chance, ordinary attack policy, boss fan/cadence, special damage and charge time also retain the finale baseline. Enemy damage grows 4% per stage from ×1.35, capped at ×4; interrupt thresholds use `220 × sqrt(g(d))`.

Each group of four successful regular admissions contains **three melee and one ranged**. Endless escort packs follow the same composition. Counters advance on successful admission, not failed pool acquisition. Population is a per-stage admission budget, not an unbounded simultaneous count: 28 enemies and one admission per fixed step bound runtime work. A saturated pool can reduce realized regular admissions before the scheduled boss transition. In reachable depths health/population have no gameplay plateau; an exponent ceiling of 500 only prevents floating-point overflow at unreachable depths.

Each stage has its own elapsed time, five-wave progression, chest/boss schedules and deadline; cumulative run time is independent. Regular enemies additionally retain within-stage wave HP/speed bonuses. The endless HUD shows the planned population. There is no cross-run persistence.

## Validation, quantification and design references

Meaningful Bun tests cover all ten 3/6/9 thresholds, duplicates and eligibility, actual crit/heavy damage, real lifesteal/overkill/overheal, AOE non-recursion, slow/stun timers and boss resistance, every boss's mixed entrance/replacement, repeated escorts exceeding the regular quota, oversized batches and pool saturation, immediate boss-death clearance, attacks during gold charges, actual ranged projectiles, 1:3 admission counts, four campaign and forty endless growth configurations, actual population admission, pause/restart and natural full campaigns plus two endless bosses. Natural completion samples verify real incoming damage; a completed build can kill a boss before its first charge. Dedicated mixed-boss tests independently verify gold charges and escort attacks.

`World.snapshot().metrics` adds total actual damage, incoming HP/shield loss, effective HP healing, critical hits, control procs and actual melee/ranged spawns. Stage admission count/quota and growth are exposed alongside existing kills, arrivals, interrupts, specials and proc counters. Diagnostics remain test-only and read-only; there is no online analytics service or persistence. Fixed policies/seeds can compare survival, clearing time and builds later. Their results are **not** human win rates or proof of balance; first-stage losses and overpowered completed builds remain tuning work.

Playwright uses explicit fixtures for tier previews, chain kills, ranged waves and mixed gold-charge encounters, and native desktop/touch reward actions. Natural browser runs separately cover first-stage advance/failure/restart; simulation covers the full campaign/endless path. Physical phones and long endless performance remain manual acceptance. Local checks do not imply production publication.

Mechanism references, not copied balance values: Riot's [Fates II gameplay overview](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-fates-ii-gameplay-overview/) describes vertical 3/6/9 traits and damage-based healing; its [12.11 notes](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-12-11-notes/) distinguish lifesteal from omnivamp. This game's base numbers and fixed-defense adaptations are provisional values defined above.
