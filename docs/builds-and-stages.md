# Card builds and continuous stages

Player reference: [complete Chinese game guide](game-guide/Home.md), generated together with the native GitHub Wiki.

Status: implemented. This is the content and baseline-parameter contract, not a claim that difficulty is balanced. [Architecture](architecture.md) defines engine/input/state boundaries. Runtime sources are `src/data/{cards,synergies,enemies,stages}.ts`, `src/game/stats.ts` and `src/game/world.ts`.

## Ten families, forty-three augments and score and boss training, three breakpoints

Each acquired card layer contributes **one family point**, including repeat upgrades. At **3 / 6 / 9** points, a family gains a small / medium / large transformation. Higher tiers retain lower-tier effects unless explicitly replacing a number or cadence. Tiers are derived from the collection rather than permanently multiplying base stats. Base-card upgrades can continue after tier nine; the HUD caps the progress bar at nine and shows the actual layer total in the disclosure. Multiple families coexist.

| Family | Three cards and their base effects | 3 layers | 6 layers | 9 layers |
| --- | --- | --- | --- | --- |
| 殉星自爆 / `blast` | 过载刻印: +4 damage; 余烬引信: death explosion 16 damage/layer; 殉星契约: sacrifice explosion | Explosions ×1.4, radius 160; all ordinary-enemy kills can create the base death explosion | Blast kills propagate; sacrifice every 4s, including without a sacrifice card | Explosions ×2, radius 190; sacrifice every 3s, max-HP scaling 45% |
| 祷言弹幕 / `barrage` | 急速咏唱: interval ×0.88; 分岔祷言: +1 secondary; 因果贯穿: +1 penetration | Interval ×0.88, secondary damage 80% | Every fourth volley echoes; secondary damage 100% | Interval ×0.75, +1 projectile, echo every third volley |
| 不落壁垒 / `bastion` | 续杯仪式: +20 max HP / heal 30; 守夜契约: +24 shield; 荆棘圣约: retaliate for 18/layer | Restore 10 shield every 3s, automatic cap 60% max HP | Thorns ×2; incoming hits retaliate globally for 25% max HP | Restore 20 shield, automatic cap 100% max HP; global retaliation 50% max HP |
| 终焉裁决 / `judgment` | 防线裁决: +20%/layer vs Attacking; 破绽凝视: +20%/layer vs bosses; 终焉回响: heal 2/layer per kill | +20% vs Preparing/Attacking | Execute at 8% HP; charging-boss damage ×1.5 | Execute at 15%; charging-boss damage ×2 |
| 泰坦重击 / `might` | 巨力刻印: +5 damage; 泰坦意志: +12 percentage points attack multiplier; 破城重锤: +25% heavy-volley damage/layer every fifth volley | Attack damage ×1.2 | Heavy volley every fourth volley, +30% in addition to the card | Heavy volley every third volley, +80% in addition to the card |
| 猩红渴望 / `blood` | 渴血刻印: 3.4% effective lifesteal/layer; 不息血泉: 1.2 HP/s/layer; 赤色恩赐: +15% combat healing/layer | +4.25 effective points lifesteal | 50% overheal becomes shield, cap 40% max HP | +8.5 effective points lifesteal instead; regeneration ×2; all overheal becomes shield, cap 80% max HP |
| 命定暴击 / `precision` | 命定锋芒: +8 percentage points crit chance; 致命祷词: +0.25 crit multiplier; 弱点解剖: +12%/layer vs enemies below half HP | +10 percentage points crit chance | +0.25 crit multiplier | Another +0.5 crit multiplier; every third volley guarantees crits |
| 雷霆共振 / `storm` | 跃迁闪电: +1 lightning target, 30% shot damage; 共振电弧: 15% splash damage/layer, radius 85; 雷暴仪式: periodic AOE | +1 lightning target; splash radius +20 | Another +2 lightning targets; storm every 4s, including without its card | Storm every 3s; lightning/storm damage ×2 |
| 永冬结界 / `frost` | 寒霜刻印: 10% slow/layer for 2s; 碎冰咒: +12%/layer vs slowed enemies; 永冬脉冲: field slow every 6s | +10 percentage points on-hit slow; duration 3s | Every fourth hit on an enemy freezes it for 0.6s | Every third hit freezes for 1s; +30% damage vs slowed enemies |
| 王权禁锢 / `dominion` | 震慑刻印: every fourth primary hit stuns for 0.15s/layer; 破阵敕令: +12%/layer vs controlled/charging enemies; 静默王权: cleansing sanctuary every 8s | Stun/sanctuary duration ×1.3; +20% vs controlled/charging enemies | Sanctuary every 6s even without its card; also clears hostile bullets | Stun/sanctuary duration ×1.6; +50% interrupt contribution; controlled kills restore 8 shield up to max HP |

The original thirty common/rare cards remain; three new shield-engine augments bring that pool to 33. Each family adds one **epic** card, capped at one acquisition per run; it contributes one family point, independently of its compound stat bonuses. Card rarity and family tier are separate. Acquired epics survive stage/endless transitions and leave the reward pool until restart.

| Epic / ID | Family | Immediate effect |
| --- | --- | --- |
| 超新星之心 / `nova-heart` | blast | +8 base damage, +2 explosion layers, +1 sacrifice layer |
| 万千祷言 / `heavenly-barrage` | barrage | +2 projectiles, +1 piercing; six effective projectiles maximum |
| 不灭圣城 / `aegis-core` | bastion | +60 max HP, heal 80, +60 shield, +1 thorns layer |
| 终焉敕令 / `final-verdict` | judgment | +40% vs bosses, +40% vs Attacking, +4 kill healing |
| 泰坦神躯 / `titan-heart` | might | +18 base damage, +30 percentage points power |
| 猩红圣杯 / `crimson-grail` | blood | +12 percentage points lifesteal, +3 HP/s, +25 percentage points healing amplification |
| 命运之眼 / `fate-eye` | precision | +20 percentage points crit chance, +0.75 crit multiplier |
| 万雷归一 / `tempest-core` | storm | +2 lightning targets, +2 splash layers, +2 storm layers |
| 绝对零域 / `absolute-zero` | frost | +20 percentage points slow, +35% vs slowed enemies, +2 frost-pulse layers |
| 时序王冠 / `chronocrown` | dominion | +2 sanctuary layers, +35% controlled damage, +0.3s primary-hit stun |

Base player stats: 100 HP, no shield, 12 damage, 0.34s interval, one projectile, no penetration, 0% crit chance and a 1.5 crit multiplier. Effective interval has a 0.08s floor; total projectile count caps at six, random crit chance at 85%, raw lifesteal at 50%, then ×0.85 (42.5% effective maximum), slow at 70%. Guaranteed critical volleys bypass the random chance cap. Crit chance uses an independent seeded combat RNG, so rolling crits does not consume reward/spawn randomness.

Card caps remain per ID. `overload`, `vitality`, `ward`, `force` and `renewal` are uncapped; haste caps at six, multishot at four acquisitions (five projectiles without epics), piercing at three acquisitions. Epic bonuses do not consume normal-card stack limits; extra projectiles still respect the six-projectile global cap. Judgment's three base cards cap at three acquisitions each, so all nine points are reachable. Other new caps are recorded in the card data, and capped cards leave the reward pool. Every family can reach nine using its eligible cards.

Attack damage is `base damage × (1 + power) × might bonus`, followed by heavy-volley/secondary/critical multipliers. Target-dependent damage bonuses add before the charging-boss multiplier. Lifesteal uses **actual direct projectile damage**, excluding overkill, executions' extra removed HP, chests, explosions, lightning and retaliation. Combat healing amplification applies to lifesteal, kill healing and regeneration. Fixed card heals skip combat healing amplification. While poisoned, all HP healing, including card heals and combat overheal before shield conversion, is reduced by 90%; direct shield gains are unaffected. Stage recovery follows cleansing and restores up to 35 HP. Neither regeneration nor overheal removes shield above an automatic cap.

Sacrifice consumes up to 3 HP without killing, consuming shield, granting invulnerability or triggering retaliation. Its base explosion is `20 × max(1, bloodpact layers) + 15% max HP`; nine blast points replace the HP term with 45%. It waits for an enemy target, never a chest. Retaliation cannot revive a lethally hit player.

Lightning chooses distinct nearby enemies per projectile and never returns to its primary victim. Splash excludes its primary victim. AOE cannot damage chests or claim rewards. Death explosions use an iterative queue; victims deactivate before enqueuing, so chains settle each death/score/heal once and stop when a stage or run ends. Cosmetic pool exhaustion never suppresses damage.

Slow affects movement, preparation, ordinary attack timers and boss charge timers. Stun freezes those timers while its own duration advances in combat. Bosses receive half slow strength and one-quarter stun/freeze duration. Repeated effects refresh durations with `max`, rather than adding unbounded stun durations. Freeze counts all projectile hits; 震慑 counts primary-projectile hits separately. Pause, rewards and endings freeze all status timers.

Periodic storm damage is `effective attack damage × (1 + 0.5 × max(1, storm layers))` in radius 150, every 6s before its family bonuses. Frost pulse slows the field by `20% + 5% × layers`, for 2s/3s.

### Cleansing sanctuary

静默王权 and the six-point dominion bonus now stop hostile time instead of applying a short field stun. Every 8 hostile seconds (6 at dominion six or nine), activate for `(0.5 + 0.25 × controlPulse layers) × dominion duration multiplier` player seconds: ×1, ×1.3 at three/six, ×1.6 at nine. One 静默王权 therefore grants 0.75s; 时序王冠 alone grants 1s. **Bosses receive the full sanctuary duration.** Ordinary hit-triggered frost/stun keeps its existing boss resistance.

Activation cleanses poison, its 90% grievous-wounds healing penalty and its attack-speed penalty **before** that step's poison damage. Enemy movement, preparation, attacks, gold charges, guard/status durations, hostile projectile position/lifetime/collision, chests, spawning/reinforcements, scheduled supplies and the stage clock freeze. All enemy taunts are disabled during sanctuary, including attack-area priority and tanks, across auto/manual cycling, secondary assignment and homing restrictions. Wizard poison is an active decision, never a death trigger. Fusion and skill timers also freeze during sanctuary. Endless boss HP-threshold skills defer until time resumes; a boss killed during the stop cannot cast them. At dominion six, activation also clears hostile bullets; otherwise frozen bullets resume from the same positions and remain dangerous.

Player shots, firing cooldowns, healing and build effects continue. The cumulative run clock includes these playable seconds; the separate stage clock stays fixed. The pulse cooldown uses hostile time and cannot recharge during its own stop. Pause/rewards preserve the remaining duration. Boss clearance, stage advance and restart clear it. HUD names the effect, remaining duration and frozen hostile time; enemy rings use the control color. Controlled-damage bonuses and nine-point shield-on-kill recognize sanctuary.

## Rewards and visibility

- Every stage-one offer, including its boss reward, excludes frost, dominion, blood and bastion families (including epics); first-stage boss/score training also excludes leech before focused selection and epic promotion. Stage two onward uses the complete pool.

- Offers contain up to three distinct eligible IDs; a depleted first-stage pool can contain only the remaining two unlimited damage cards. The first offer includes two foundation upgrades.
- After three acquired card layers, chest/supply offers independently have a 25% chance to promote one slot to an eligible epic. Every stage/boss reward guarantees an epic candidate while any remain. Promotion favors the most invested eligible family; otherwise it chooses a shuffled epic. Exhausted epic pools fall back to regular choices.
- Up to two slots follow the eligible family with the highest accumulated investment. Repeat copies count and can cross a breakpoint. Epic promotion can replace one of those slots while preserving a foundation option.
- Every offer retains at least one foundation upgrade: overload, haste, multishot, piercing, force, momentum, chain, splash or stormcall. Pure conditional bonuses cannot be the only way out of a weak opening.
- In the campaign, the first chest appears at 3s. Further chests schedule seven seconds after the previous admission, through `min(46, bossAt - 5)`, with at most one chest active.
- The reward preview names the next breakpoint and newly unlocked effect. Ten keyboard/touch disclosure rows show progress, per-card layers and all three tier effects. HUD values use effective firing/crit/lifesteal stats.
- Reward/supply overlays stay within the arena and scroll internally on narrow displays. Claims validate phase, source, monotonic token, offered membership and eligibility, then consume the capability before resuming. Stale clicks cannot claim again or advance twice.

## Authored encounters and both attack roles

| Stage | Ordinary budget / simultaneous limit | Regular HP / speed / damage | Boss HP | Boss arrival (no deadline) | Mixed escort repeat |
| --- | --- | --- | --- | --- | --- |
| 圣杯前庭 | 40 / 14 | ×1 / ×1 / ×1 | 2,000 | 52s | 4 every 2s |
| 棱镜回廊 | 60 / 18 | ×1.5 / ×1 / ×1.1 | 4,300 | 48s | 6 every 2s |
| 焚星熔炉 | 90 / 21 | ×2.25 / ×1.25 / ×1.2; melee prepares at y=450 | 7,200 | 46s | 9 every 2s |
| 终愿核心 | 135 / 28 | ×3.375 / ×1.15 / ×1.35 | 11,000 | 48s | 14 every 2s |

Campaign difficulty compounds with `c(i)=1.5^i` for `i=0..3`: regular HP uses `c(i)`, ordinary admission budgets use `ceil(40×c(i))`, and escort batch sizes use `ceil(4×c(i))`. The ordinary spawn interval is `(boss arrival - 0.8)/budget`, with first admission at 0.8s. Counts round up from the unrounded baseline. Boss HP retains the authored values above, increasing at least 50% at each transition; speed, damage and campaign charge patterns remain encounter-specific.

Campaign minions are **wisp / sentinel / hexer, 1:1:1**. Each shuffled group contains one of each, and only successful admissions consume the group. Ordinary waves and every escort batch share this stage-local sequence. Counts of the three species differ by at most one when the final group is partial; bosses are excluded.

Wisps and sentinels now perform melee strikes against the defense only after arriving and preparing. The new cyan **蚀光术士 / hexer** has 66 base HP, speed 96/s, 1.2s preparation, one 7-damage projectile every 2.8s at speed 190/s. It can prepare from y=120, shoots while approaching, and stops in the midfield around y=340 (adjusted by its slot row). Its released projectiles remain dangerous after it dies.

**Every boss**, including stage one, immediately enters with melee and ranged escorts. New mixed batches arrive every **2 seconds** while the boss lives, without a total escort quota and independently of the ordinary-wave budget. All admissions share the stage’s balanced three-species sequence, including partially admitted batches. Boss entrance preserves existing minions, their damage/statuses and hostile shots. Ordinary admissions reserve one boss slot; the initial escort batch only fills available space. A full regular pool cannot block it. Subsequent batches fill only free slots within the stage's simultaneous cap; unused batch capacity is discarded rather than accumulating an unbounded queue. Escorts keep acting during the boss's gold charge, providing actual multitarget pressure. Killing the boss immediately clears every escort, chest and projectile and freezes the stage supply/victory screen; surviving escorts never delay clearance. Only player HP exhaustion ends a run; no stage can time out.

Campaign bosses retain defense arrival, preparation, gold charge, interrupt and half-HP mechanics. Endless bosses use the health-threshold skills below instead of timed gold charges. They share the original procedural boss silhouette; palette, parameters, fans and support differ. There are no four new boss art assets. Hexers have their own original procedural texture. Frozen/slowed enemies and critical shots receive distinct colors.

## Endless growth and progression

Campaign bosses one to three grant a frozen supply; claiming retains the build, shield, score, kills and total time, heals up to 35 HP, advances one stage and resets combat schedules/statuses/pools. Boss four grants victory with the optional **继续无尽 · 保留构筑** action. Subsequent endless bosses grant another stage supply. Only HP exhaustion ends the run; restart always resets the campaign and build.

Let `d=1` be the first endless stage, relative to campaign stage four:

```text
g(d) = 2 ^ d
ordinary budget N = min(360, ceil(135 × g(d)))
escorts per batch S = min(12, ceil(14 × g(d))), every 2 seconds
population concentration P = 1 + (ceil(135 × g(d))/N - 1) + (ceil(14 × g(d))/S - 1)
regular HP multiplier = 3.375 × g(d) × P
regular damage/poison multiplier from concentration = sqrt(P)
boss HP = round(11,000 × g(d))
spawn interval = (48 - 0.8) / N
```

Ordinary budgets start at 270, reach 360 on endless stage two and remain there; routine escort packs cap at 12. Excess ordinary population and excess escort population both contribute to P, strengthening all current-stage minions. Boss health still doubles independently, starting at 22,000. Themes rotate; speed stays ×1.15, boss arrival 48s, no deadline and support cadence 2s. The separate ordinary damage multiplier is `1.2 × min(4, 1.35 × 1.04^d)`, capped at ×4.8. All endless damage, including poison and slams, is increased by20%; attack intervals and preparation multiply by0.8. Wave modifiers still apply. Growth uses an exponent ceiling of 200 only to prevent numeric overflow in unreachable depths; even concentration × health × star bonuses remain finite.

### Capacity, movement and fusion

Portrait uses a FIT-scaled 450 × 800 viewport; desktop entry uses 1600 × 800 with fixed logical geometry and proportional rendering. Capacity stays unchanged. With 18px side margins, width is 414. A 68 × 84 cell includes the worst tank silhouette/rings, health bar and star markers. Six columns fit; reserving the middle two for the 118px boss envelope leaves four lanes. Six rows fit below the entry margin: `floor((620−116)/84)=6`. Thus **24 minions plus one boss**, with the physical 28-object pool unchanged.

Portrait minion lane centers are x=55/123/327/395; desktop centers are x=342.5/410.5/1189.5/1257.5. In both, front y=620, row gap84. Every admission chooses a free position from y=52/136/220/304/388 behind that lane's rearmost unit. Failed placement waits. Each step advances front to back, preserves spacing and repacks destinations when deaths/fusions free space. All endless minion types use the same formation; wizards can shoot while advancing from y=120. The boss moves along the arena center (x=225 portrait, x=800 desktop) without lateral sway. Bodies, persistent rings, bars and stars do not overlap; brief combat effects can cross units. Star upgrades preserve body size.

In endless, three same-kind, same-star minions aged at least 4 seconds can fuse when all three pairwise distances stay within 150 for 3 continuous hostile seconds. Purple progress arcs warn the player. Changes of group/proximity reset progress; stunned units cannot participate, sanctuary freezes progress. The anchor ID survives, donors deactivate without kills, score, healing, poison or death procs. The upgraded unit heals fully, gains **3.5× the highest donor maximum HP and 2.5× the highest donor damage scale**, preserves enhanced status, and displays gold stars/bar. Three stars is the cap. Defeating a promoted unit grants base score ×3^(stars−1). Existing controls on the surviving unit remain.

### Active tank and wizard actions

Endless uses **wisp/tank/wizard 1:1:1** successful admissions; campaign retains wisp/sentinel/hexer. Tanks have 500 base HP (10× wisp). Taunt is a **2.5-second active skill**, never an innate lock: before attack permission, attempt every 3.2s with 40% probability; after preparation each 3.2-second action chooses taunt (40%) or melee attack (60%). One action never does both. Enemy action RNG is independent of rewards, crits and boss thresholds.

Attack-area priority remains above out-of-range targets, including preparing enemies and on-screen anywhere-policy bosses. Only when the attack area is empty can a currently active tank taunt restrict manual/automatic/secondary/in-flight locks. A non-casting tank adds no extra priority. Saved manual preference resumes after expiry/death; sanctuary temporarily bypasses both restrictions. The HUD distinguishes attack-area priority from active taunt, with a remaining-duration label and amber ring for active taunt.

Wizards have 250 base HP (5× wisp), prepare from y=120 and take one action every 2.72s: **40% poison, otherwise one aimed projectile**. A normal shot does not poison; death does not poison. Poison lasts 3s, base 7.2 damage/s × concentration/star/summon damage scale, absorbs shield first, bypasses hit invulnerability and does not trigger retaliation. Reapplication refreshes duration and retains the stronger active potency rather than adding DPS. Real HP damage refreshes 30% attack slow for 3s. Poison immediately reduces all HP healing by90%, including combat overheal before conversion; direct shield grants are unaffected. Cleanse/expiry ends wounds. All timers freeze outside Playing and clear on stage/reset.

### Boss skills and rewards

Endless bosses attack anywhere on-screen after preparation and deal twice regular damage at their defense slot. HP thresholds70/40/10% each independently select guard/summon/slam with replacement. Nonlethal hits can cross multiple once-only thresholds; death cancels remaining skills, sanctuary defers them.

- Guard:90% all-source damage reduction for3 hostile seconds, refreshes without stacking.
- Summon: **add six enhanced minions without deleting any existing enemy**. HP, ordinary damage and poison ×1.5. Saturated capacity/placement uses a bounded scalar queue (at most18), drains into vacancies ahead of routine packs and freezes during sanctuary/pause/rewards. Boss death/stage/reset cancels it.
- Slam: direct HP loss120+6×(depth−1), bypasses shield and invulnerability, can kill.

Every endless stage grants three random direct augment supplies, sampled once in[3,43), plus one mixed boss reward. Early boss death clears combat and settles missing supplies before the boss reward. Each fresh offer validates eligibility and has a one-use token. In addition to automatic score trainings, a stage gives four selectable rewards, comprising three augments and either one more augment or one training. No endless chests. Routine packs only fill available slots and do not queue; ordinary admissions never exceed one per fixed step.

### Shield engine and numeric training

All 43 existing/new build cards are `type=augment`; only these add synergy layers. New augments:

| ID / family | Effect | Stack cap |
| --- | --- | --- |
| overflow / blood | Combat overheal conversion +10 percentage points; base converted-shield capacity20% maxHP |3|
| reservoir / bastion | Conversion +5 points and converted-shield capacity +10% maxHP; enables conversion alone |3|
| shield-leech / blood | While shield>0, effective lifesteal +1.7 points |3|

Combat conversion adds card percentages to blood6/9's50%/100%, capped100%. Capacity takes the higher of card20% or blood40%/80%, adds reservoir capacity and caps100% maxHP. Card-granted shields above this cap are preserved. Actual HP healing settles before overflow, wounds applies first, and conversion cannot trigger itself. Instant card healing and between-stage restoration do not convert.

Every defeated boss, including campaign stage four, offers **two different numeric trainings plus one random augment**, choose one. Eligible epics retain priority for the augment slot. First-stage blood/bastion/frost/dominion exclusions apply to that slot; leech training is also excluded in stage one. Training also arrives automatically at every 5,000 cumulative points, with no selection or score deduction. All crossed milestones settle and recompute eligibility one by one using an independent seeded RNG; repeats are allowed. Training has `type=training`, updates only base stats and records in `trainingStacks`, never synergy progress. Choices persist for the current run/endless and clear on restart. Numeric options are damage+6, maxHP+30 (no instant heal), power+10 points, crit+4 points (base cap85%), crit multiplier+0.2, effective lifesteal+1.7 points(raw+2, raw cap50%), regeneration+0.75/s, and interval×0.94(floor0.08s). Options with capped effective combat stats (including family bonuses) are excluded; uncapped stats preserve at least two options. Final campaign boss reward enters StageClear; claiming it enters Victory before endless continuation. Other claims restore up to35HP and advance normally.

Each stage has its own elapsed time, five-wave progression, chest/boss schedules; no deadline; cumulative run time is independent. Regular enemies additionally retain within-stage wave HP/speed bonuses. The endless HUD shows live capacity, capped budget and concentration. There is no cross-run persistence.

## Validation, quantification and design references

Meaningful Bun tests cover cleansing before lethal poison, separate sanctuary clocks, frozen hostile collisions/spawns/stage clocks, deferred boss skills, full boss duration, pause/reward preservation, once-per-run epic promotion, all epic-first nine-point builds, attack-area taunt transitions, and all ten 3/6/9 thresholds, duplicates and eligibility, actual crit/heavy damage, real lifesteal/overkill/overheal, AOE non-recursion, slow/stun timers and boss resistance, every boss's mixed entrance/replacement, repeated escorts exceeding the regular quota, capped packs, no-overlap geometry and saturation, immediate boss-death clearance, attacks during gold charges, actual ranged projectiles, 1:1:1 species admission counts, taunt retargeting, non-stacking shield/HP poison, attack slow, 70/40/10 skills, guard expiry, bounded enhanced summons, shield-bypassing slams, four endless rewards including mixed boss training, four campaign and forty endless growth configurations with bounded populations, actual population admission, pause/restart, natural full campaigns, natural failure under the new endless pressure and explicitly fixtured two-stage endless reward continuation. Natural completion samples verify real incoming damage; a completed build can kill a boss before its first charge. Dedicated mixed-boss tests independently verify gold charges and escort attacks.

`World.snapshot().metrics` adds total actual damage, incoming HP/shield loss, effective HP healing, critical hits, control procs and actual melee/ranged spawns. Stage admission count/quota, per-species successful admissions, supply schedules/counts, boss skill/status state and growth are exposed alongside existing kills, arrivals, interrupts, specials and proc counters. Diagnostics remain test-only and read-only; there is no online analytics service or persistence. Fixed policies/seeds can compare survival, clearing time and builds later. Their results are **not** human win rates or proof of balance; first-stage losses and overpowered completed builds remain tuning work.

Playwright uses explicit fixtures for tier previews, chain kills, ranged waves and mixed gold-charge encounters, and native desktop/touch reward actions. Natural browser runs separately cover first-stage advance/failure/restart; simulation covers the natural full campaign and harder endless failure; explicit fixtures cover multiple endless stage/reward transitions. Physical phones and long endless performance remain manual acceptance. Local checks do not imply production publication.

Mechanism references, not copied balance values: Riot's [Fates II gameplay overview](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-fates-ii-gameplay-overview/) describes vertical 3/6/9 traits and damage-based healing; its [12.11 notes](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-12-11-notes/) distinguish lifesteal from omnivamp. This game's base numbers and fixed-defense adaptations are provisional values defined above.
