import { describe, expect, test } from "bun:test";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { KindWeights, PlayerValues, StageRule } from "../../src/data/balance/model";
import {
  defaultProfile,
  defaultRewardPolicy,
  kindWeightsAt,
  officialProfile,
  parseProfile,
  resolvedStage,
  rewardPolicyAt,
} from "../../src/data/balance/profile";
import { CARDS, drawCards } from "../../src/data/cards";
import { ENEMIES } from "../../src/data/enemies";
import { stageAt } from "../../src/data/stages";
import { drawBossRewards, TRAININGS } from "../../src/data/training";
import { DebugWorld } from "../../src/game/debug/DebugWorld";
import { seededRandom } from "../../src/game/random";
import { createPlayer, World } from "../../src/game/world";
import { ProfileStore, STORAGE_KEY } from "../../src/ui/debug/store";
import { enemy, hit, tick } from "./helpers";

function required<T>(value: T | undefined | null): T {
  if (value === undefined || value === null) throw new Error("Expected test fixture value");
  return value;
}
const weights: KindWeights = { wisp: 0, sentinel: 0, hexer: 0, tank: 1, wizard: 0 };
const rule = (from: number, to: number | null, damage: number): StageRule => ({
  from,
  to,
  stage: { damage },
  kindWeights: null,
  rewards: {},
});
function playerValues(world: World): PlayerValues {
  const { hp, shield, invulnerable, poisonTime, woundTime, poisonDamageBonus, poisonSlowBonus } =
    world.player;
  return { hp, shield, invulnerable, poisonTime, woundTime, poisonDamageBonus, poisonSlowBonus };
}
function started(profile = defaultProfile()): DebugWorld {
  const world = new DebugWorld(450, profile);
  world.start(7);
  return world;
}
function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe("portable balance profiles", () => {
  test("complete JSON round-trip preserves every default and original stage calculation", () => {
    const profile = parseProfile(JSON.parse(JSON.stringify(defaultProfile())));
    expect(profile).toEqual(defaultProfile());
    for (const width of [450, 700, 1200, 2400])
      for (const index of [0, 1, 2, 3, 4, 8, 1000])
        expect(resolvedStage(profile, index, width)).toEqual(stageAt(index, width));
  });
  test("rejects incompatible, unknown, unsafe and incomplete inputs with field errors", () => {
    for (const change of [
      (p: ReturnType<typeof defaultProfile>) => {
        p.schemaVersion = 2 as 1;
      },
      (p: ReturnType<typeof defaultProfile>) => {
        p.payload.player.stats.damage = Number.NaN;
      },
      (p: ReturnType<typeof defaultProfile>) => {
        p.payload.player.stats.projectiles = 1.5;
      },
      (p: ReturnType<typeof defaultProfile>) => {
        p.payload.rewards.chest.cardWeights.unknown = 1;
      },
      (p: ReturnType<typeof defaultProfile>) => {
        p.payload.rewards.chest.epicChance = 2;
      },
      (p: ReturnType<typeof defaultProfile>) => {
        p.payload.enemies.wisp.interval = 0;
      },
      (p: ReturnType<typeof defaultProfile>) => {
        p.payload.stageRules = [{ ...rule(1, null, 2), kindWeights: { ...weights, tank: 0 } }];
      },
      (p: ReturnType<typeof defaultProfile>) => {
        p.payload.player.hp = 101;
      },
    ]) {
      const profile = defaultProfile();
      change(profile);
      expect(() => parseProfile(profile)).toThrow();
    }
    expect(() => parseProfile({ ...defaultProfile(), surprise: 1 })).toThrow("surprise");
    expect(() => parseProfile({ ...defaultProfile(), payload: {} })).toThrow();
    expect(() => parseProfile(Object.create(null))).toThrow("普通对象");
  });
  test("global, interval, then exact rules apply regardless of list order and same-level overlap is rejected", () => {
    const profile = defaultProfile();
    profile.payload.stageRules = [rule(3, 3, 7), rule(2, 4, 5), rule(1, null, 2)];
    expect(parseProfile(profile)).toEqual(profile);
    expect([0, 1, 2, 3, 4].map((index) => resolvedStage(profile, index).damage)).toEqual([
      2, 5, 7, 5, 2,
    ]);
    profile.payload.stageRules.push(rule(4, 8, 9));
    expect(() => parseProfile(profile)).toThrow("重叠");
  });
  test("counts scale to geometry, physical capacity stays bounded, and explicit cadence wins", () => {
    const profile = defaultProfile();
    profile.payload.stageRules = [
      {
        ...rule(1, null, 2),
        stage: { enemyCount: 20, maxEnemies: 65, bossAt: 10, supportCount: 2 },
      },
    ];
    const portrait = resolvedStage(profile, 0, 450);
    const desktop = resolvedStage(profile, 0, 1200);
    expect(portrait.enemyCount).toBe(20);
    expect(desktop.enemyCount).toBeGreaterThan(portrait.enemyCount);
    expect(portrait.maxEnemies).toBeLessThanOrEqual(25);
    expect(desktop.maxEnemies).toBeLessThanOrEqual(65);
    expect(portrait.spawnInterval).toBeCloseTo(9.2 / 20);
    required(profile.payload.stageRules[0]).stage.spawnInterval = 0.5;
    expect(resolvedStage(profile, 0, 1200).spawnInterval).toBe(0.5);
  });
  test("source-specific card rules and enemy weights inherit across ranges", () => {
    const profile = defaultProfile();
    const supply = { ...defaultRewardPolicy(), mode: "weighted" as const };
    profile.payload.stageRules = [
      { ...rule(1, null, 1), kindWeights: weights },
      { ...rule(5, null, 2), rewards: { supply } },
    ];
    expect(kindWeightsAt(profile, 5)).toEqual(weights);
    expect(rewardPolicyAt(profile, 5, "supply")).toEqual(supply);
    expect(rewardPolicyAt(profile, 3, "supply").mode).toBe("guided");
  });
  test("two worlds own independent profiles, including future stages and actor definitions", () => {
    const profile = defaultProfile();
    profile.payload.player.stats.damage = 80;
    profile.payload.enemies.wisp.damage = 30;
    const custom = new World(450, profile);
    const standard = new World();
    profile.payload.player.stats.damage = 900;
    custom.start(1);
    standard.start(1);
    expect(custom.player.stats.damage).toBe(80);
    expect(standard.player.stats.damage).toBe(12);
    tick(custom, 1);
    tick(standard, 1);
    expect(custom.profile.payload.enemies.wisp.damage).toBe(30);
    expect(standard.profile.payload.enemies.wisp.damage).toBe(ENEMIES.wisp.damage);
  });
  test("default reward policy preserves legacy choices and RNG state across sources and seeds", () => {
    for (let seed = 1; seed <= 50; seed++)
      for (const source of ["chest", "supply", "stage"] as const) {
        const first = seededRandom(seed);
        const second = seededRandom(seed);
        expect(
          drawCards(createPlayer(), new Map(), first, source, seed % 5, defaultRewardPolicy()),
        ).toEqual(drawCards(createPlayer(), new Map(), second, source, seed % 5));
        expect(first.getState()).toBe(second.getState());
      }
  });
  test("pure weighted pools include only configured eligible IDs, allow epics directly, and handle shortages", () => {
    const policy = defaultRewardPolicy();
    policy.mode = "weighted";
    policy.firstStageRestriction = false;
    policy.cardWeights = Object.fromEntries(
      CARDS.map((card) => [card.id, ["nova-heart", "ward"].includes(card.id) ? 1 : 0]),
    );
    expect(
      new Set(drawCards(createPlayer(), new Map(), seededRandom(1), "chest", 0, policy)),
    ).toEqual(new Set(["nova-heart", "ward"]));
    expect(
      drawCards(createPlayer(), new Map([["nova-heart", 1]]), seededRandom(1), "chest", 0, policy),
    ).toEqual(["ward"]);
    policy.cardWeights.ward = 0;
    expect(
      drawCards(createPlayer(), new Map([["nova-heart", 1]]), seededRandom(1), "chest", 0, policy),
    ).toEqual([]);
  });
  test("boss single-card offers honor nonuniform weights even when the pool has exactly three cards", () => {
    for (const mode of ["weighted", "guided"] as const) {
      const policy = defaultRewardPolicy();
      policy.mode = mode;
      policy.firstStageRestriction = false;
      policy.cardWeights = Object.fromEntries(
        CARDS.map((card) => [
          card.id,
          card.id === "force" ? 100 : ["haste", "ward"].includes(card.id) ? 1 : 0,
        ]),
      );
      let heavy = 0;
      for (let seed = 0; seed < 300; seed++)
        if (
          drawBossRewards(createPlayer(), new Map(), seededRandom(seed), 1, policy).includes(
            "force",
          )
        )
          heavy++;
      expect(heavy).toBeGreaterThan(270);
    }
  });
  test("guided rules never restore disabled foundation cards or disabled trainings", () => {
    const policy = defaultRewardPolicy();
    policy.firstStageRestriction = false;
    policy.cardWeights = Object.fromEntries(
      CARDS.map((card) => [card.id, card.id === "recovery" ? 1 : 0]),
    );
    policy.trainingWeights = Object.fromEntries(
      TRAININGS.map((item) => [item.id, item.id === "training-health" ? 1 : 0]),
    );
    expect(drawBossRewards(createPlayer(), new Map(), seededRandom(3), 0, policy)).toEqual([
      "training-health",
      "recovery",
    ]);
  });
});

describe("PRE battle commands", () => {
  test("RNG state can be restored without changing the seeded sequence", () => {
    const random = seededRandom(9);
    random();
    const saved = random.getState();
    const expected = [random(), random(), random()];
    random.setState(saved);
    expect([random(), random(), random()]).toEqual(expected);
  });
  test("adding/removing cards rebuilds the build and never replays a one-time shield or heal", () => {
    const world = started();
    world.player.hp = 40;
    world.execute({
      type: "deck",
      cards: { ward: 2, vitality: 1, force: 2 },
      trainings: { "training-damage": 1 },
    });
    expect(world.player.shield).toBe(48);
    expect(world.player.hp).toBe(70);
    expect(world.player.stats.maxHp).toBe(120);
    expect(world.player.stats.damage).toBe(28);
    world.execute({
      type: "deck",
      cards: { ward: 2, vitality: 1, force: 1 },
      trainings: { "training-damage": 1 },
    });
    expect(world.player.shield).toBe(48);
    expect(world.player.hp).toBe(70);
    expect(world.player.stats.damage).toBe(23);
    world.execute({ type: "deck", cards: {}, trainings: {} });
    expect(world.player.stats.maxHp).toBe(100);
    expect(world.player.shield).toBe(48);
    expect(world.player.hp).toBe(70);
    expect(world.stacks.size + world.trainingStacks.size).toBe(0);
  });
  test("attribute overrides survive grants and stages, and can be cleared independently", () => {
    const world = started();
    world.execute({ type: "player", values: playerValues(world), overrides: { damage: 100 } });
    world.execute({ type: "deck", cards: { force: 2 }, trainings: {} });
    expect(world.player.stats.damage).toBe(100);
    world.execute({ type: "jump", stage: 2, fresh: false });
    expect(world.player.stats.damage).toBe(100);
    expect(world.stacks.get("force")).toBe(2);
    world.execute({ type: "player", values: playerValues(world), overrides: {} });
    expect(world.player.stats.damage).toBe(22);
    world.execute({ type: "new-run", seed: 4 });
    expect(world.player).toEqual(createPlayer());
    expect(world.stacks.size).toBe(0);
  });
  test("invalid deck and rule commands leave the build/configuration untouched", () => {
    const world = started();
    const before = structuredClone(world.player);
    expect(() => world.execute({ type: "deck", cards: { force: -1 }, trainings: {} })).toThrow();
    expect(world.player).toEqual(before);
    expect(() =>
      world.execute({
        type: "spawn-rules",
        stage: { damage: 2 },
        weights: { ...weights, tank: -1 },
      }),
    ).toThrow();
    expect(world.stage.damage).toBe(1);
  });
  test("temporary spawn patches change future actors without rewriting existing ones", () => {
    const world = started();
    world.execute({ type: "spawn", kind: "wisp", count: 1 });
    const first = required(world.enemies.items.find((enemy) => enemy.active));
    world.execute({ type: "spawn-rules", stage: { health: 3, damage: 4 }, weights });
    world.execute({ type: "spawn", kind: "wisp", count: 1 });
    const active = world.enemies.items.filter((enemy) => enemy.active);
    expect(first.maxHp).toBe(50);
    expect(world.enemyStage(first).damage).toBe(1);
    expect(required(active[1]).maxHp).toBe(150);
    expect(world.enemyStage(required(active[1])).damage).toBe(4);
    world.execute({ type: "jump", stage: 2, fresh: false });
    expect(world.stage.damage).toBe(stageAt(1).damage);
    expect(world.debugInfo.kindWeights).toBeNull();
  });
  test("kind-weight rules spawn only selected species and preserve a boss slot", () => {
    const world = started();
    world.execute({ type: "spawn-rules", stage: { enemyCount: 20, maxEnemies: 2 }, weights });
    world.resume();
    tick(world, 2);
    expect(
      world.enemies.items.filter((enemy) => enemy.active).every((enemy) => enemy.kind === "tank"),
    ).toBe(true);
    world.execute({ type: "spawn", kind: "tank", count: 65 });
    expect(world.enemies.items.filter((enemy) => enemy.active).length).toBe(1);
    world.execute({ type: "spawn", kind: "boss", count: 2 });
    expect(world.enemies.items.filter((enemy) => enemy.active).length).toBe(2);
    expect(
      world.enemies.items.filter((enemy) => enemy.active && enemy.kind === "boss"),
    ).toHaveLength(1);
  });
  test("temporary cadence changes and retained restarts restart the corresponding spawn timers", () => {
    const world = started();
    world.execute({ type: "spawn", kind: "boss", count: 1 });
    world.execute({
      type: "spawn-rules",
      stage: { supportInterval: 100, supportCount: 1, maxEnemies: 2 },
      weights: null,
    });
    world.resume();
    tick(world, 2.1);
    expect(world.enemies.items.filter((item) => item.active && item.kind !== "boss")).toHaveLength(
      0,
    );
    world.execute({ type: "restart", restoreEntry: false });
    world.execute({ type: "spawn", kind: "boss", count: 1 });
    world.resume();
    tick(world, 2.1);
    expect(world.enemies.items.filter((item) => item.active && item.kind !== "boss")).toHaveLength(
      0,
    );
    world.execute({
      type: "spawn-rules",
      stage: { supportInterval: 0.5, supportCount: 1, maxEnemies: 2 },
      weights: null,
    });
    world.resume();
    tick(world, 0.6);
    expect(world.enemies.items.filter((item) => item.active && item.kind !== "boss")).toHaveLength(
      1,
    );
    world.execute({ type: "jump", stage: 1, fresh: true });
    world.execute({ type: "spawn-rules", stage: { spawnInterval: 100 }, weights: null });
    world.resume();
    tick(world, 2);
    expect(world.stageSpawned).toBe(0);
  });
  test("empty stage training policies consume milestones without banking later awards, including checkpoints", () => {
    const profile = defaultProfile();
    const policy = defaultRewardPolicy();
    policy.trainingWeights = Object.fromEntries(TRAININGS.map((item) => [item.id, 0]));
    profile.payload.stageRules = [
      { from: 1, to: 1, stage: {}, kindWeights: null, rewards: { stage: policy } },
    ];
    const world = started(profile);
    world.bossSpawned = true;
    world.score = 4900;
    hit(world, enemy(world, { x: 225, y: 300, speed: 0, hp: 1 }), 1);
    expect(world.scoreTrainings).toBe(0);
    expect(world.trainingStacks.size).toBe(0);
    expect(world.snapshot().nextScoreTraining).toBe(10000);
    expect(world.scoreMilestones).toBe(1);
    world.execute({ type: "jump", stage: 2, fresh: false });
    world.bossSpawned = true;
    world.resume();
    hit(world, enemy(world, { x: 225, y: 300, speed: 0, hp: 1 }), 1);
    expect(world.scoreTrainings).toBe(0);
    world.score = 9900;
    hit(world, enemy(world, { x: 225, y: 300, speed: 0, hp: 1 }), 1);
    expect(world.scoreTrainings).toBe(1);
    expect(world.scoreMilestones).toBe(2);
    world.execute({ type: "restart", restoreEntry: true });
    expect(world.scoreMilestones).toBe(1);
    expect(world.scoreTrainings).toBe(0);
  });
  test("boss summon notices report the actual configured count and enhancement", () => {
    const profile = defaultProfile();
    profile.payload.endless.summonCount = 2;
    profile.payload.endless.summonMultiplier = 2.25;
    profile.payload.endless.supplies = 0;
    const world = started(profile);
    world.stageIndex = 4;
    world.bossSpawned = true;
    enemy(world, {
      kind: "boss",
      x: 225,
      y: 100,
      defenseX: 225,
      speed: 0,
      hp: 70,
      maxHp: 100,
      skillsUsed: 0,
    });
    tick(world, 0.05);
    expect(world.notice).toContain("召唤 2 只");
    expect(world.notice).toContain("×2.25");
    expect(world.enemies.items.filter((item) => item.active && item.enhanced)).toHaveLength(2);
  });
  test("editing actor max health preserves percentage and removing does not count as a kill", () => {
    const world = started();
    world.execute({ type: "spawn", kind: "wisp", count: 2 });
    const enemy = required(world.enemies.items.find((item) => item.active));
    enemy.hp = 25;
    world.execute({ type: "enemy", ids: [enemy.id], patch: { hp: 200, damage: 50, speed: 0 } });
    expect(enemy.hp).toBe(100);
    expect(enemy.maxHp).toBe(200);
    expect(world.enemyDefinition(enemy).damage).toBe(50);
    const untouched = required(
      world.enemies.items.find((item) => item.active && item.id !== enemy.id),
    );
    expect(world.enemyDefinition(untouched).damage).toBe(ENEMIES.wisp.damage);
    expect(untouched.maxHp).toBe(ENEMIES.wisp.hp);
    expect(enemy.speed).toBe(0);
    world.execute({ type: "remove", ids: [enemy.id] });
    expect(enemy.active).toBe(false);
    expect(world.kills + world.score).toBe(0);
  });
  test("retain-build restart and entry restore are distinct and entry RNG outcomes repeat", () => {
    const world = started();
    tick(world, 2);
    const first = world.snapshot().enemies.map(({ kind, x, y, hp }) => ({ kind, x, y, hp }));
    world.execute({ type: "deck", cards: { force: 2 }, trainings: {} });
    world.player.hp = 42;
    world.execute({ type: "spawn-rules", stage: { damage: 4 }, weights });
    world.execute({ type: "restart", restoreEntry: false });
    expect(world.player.hp).toBe(42);
    expect(world.player.stats.damage).toBe(22);
    expect(world.stage.damage).toBe(4);
    expect(world.stageElapsed).toBe(0);
    world.execute({ type: "restart", restoreEntry: true });
    expect(world.player).toEqual(createPlayer());
    expect(world.elapsed + world.kills + world.score).toBe(0);
    expect(world.stage.damage).toBe(1);
    world.resume();
    tick(world, 2);
    expect(world.snapshot().enemies.map(({ kind, x, y, hp }) => ({ kind, x, y, hp }))).toEqual(
      first,
    );
  });
  test("jump clears hazards/rewards while serials remain monotonic, and profile activation starts clean", () => {
    const world = started();
    world.execute({ type: "spawn", kind: "wisp", count: 1 });
    const id = required(world.snapshot().enemies[0]).id;
    world.reward = { token: 10, source: "chest", choices: ["force"] };
    world.state.phase = "RewardSelection";
    world.execute({ type: "jump", stage: 12, fresh: false });
    expect(world.phase).toBe("Paused");
    expect(world.reward).toBeNull();
    expect(world.chooseCard("force", 10)).toBe(false);
    expect(world.stageIndex).toBe(11);
    world.execute({ type: "spawn", kind: "wisp", count: 1 });
    expect(required(world.snapshot().enemies[0]).id).toBeGreaterThan(id);
    const profile = defaultProfile();
    profile.payload.player.stats.damage = 77;
    world.execute({ type: "profile", profile, seed: 3 });
    profile.payload.player.stats.damage = 99;
    expect(world.player.stats.damage).toBe(77);
    expect(world.stageIndex).toBe(0);
    expect(world.seed).toBe(3);
  });
  test("editing during an offer invalidates its token without duplicating the reward source counter", () => {
    const world = started();
    tick(world, 6);
    const chest = world.chests.items.find((item) => item.active);
    if (chest) {
      chest.hp = 1;
      world.selectTargetAt(chest);
    }
    tick(world, 8);
    const offered = required(world.reward);
    const token = offered.token;
    const chests = world.openedChests;
    world.execute({ type: "deck", cards: { force: 1 }, trainings: {} });
    expect(required(world.reward).token).toBeGreaterThan(token);
    expect(world.openedChests).toBe(chests);
    expect(world.chooseCard(offered.choices[0] ?? "force", token)).toBe(false);
    const current = required(world.reward);
    expect(world.chooseCard(current.choices[0] ?? "force", current.token)).toBe(true);
    expect([...world.stacks.values()].reduce((sum, n) => sum + n, 0)).toBe(2);
  });
  test("an exhausted configured pool explicitly continues once without introducing excluded cards", () => {
    const profile = defaultProfile();
    profile.payload.rewards.chest.cardWeights = Object.fromEntries(
      CARDS.map((card) => [card.id, 0]),
    );
    const world = started(profile);
    tick(world, 6);
    const chest = world.chests.items.find((item) => item.active);
    if (chest) {
      chest.hp = 1;
      world.selectTargetAt(chest);
    }
    tick(world, 8);
    expect(world.phase).toBe("RewardSelection");
    expect(world.reward?.choices).toEqual([]);
    const token = required(world.reward).token;
    expect(world.resume()).toBe(false);
    expect(world.skipUnavailableReward(token + 1)).toBe(false);
    expect(world.skipUnavailableReward(token)).toBe(true);
    expect(world.skipUnavailableReward(token)).toBe(false);
    expect(world.stacks.size).toBe(0);
  });
});

describe("configuration CLI", () => {
  test("validates and applies an exported profile in an isolated source copy without deploying", async () => {
    const dir = await mkdtemp(join(tmpdir(), "echoes-balance-cli-"));
    try {
      await cp(new URL("../../src/", import.meta.url), join(dir, "src"), { recursive: true });
      await cp(new URL("../../scripts/", import.meta.url), join(dir, "scripts"), {
        recursive: true,
      });
      await cp(new URL("../../docs/", import.meta.url), join(dir, "docs"), { recursive: true });
      const profile = defaultProfile();
      profile.payload.player.stats.damage = 44;
      profile.payload.player.hp = 57;
      profile.payload.player.stats.maxHp = 150;
      const file = join(dir, "export.json");
      await writeFile(file, JSON.stringify(profile));
      const validate = Bun.spawnSync([
        process.execPath,
        join(dir, "scripts/balance.ts"),
        "validate",
        file,
      ]);
      expect(validate.exitCode).toBe(0);
      expect(validate.stdout.toString()).toContain("配置有效");
      const apply = Bun.spawnSync([
        process.execPath,
        join(dir, "scripts/balance.ts"),
        "apply",
        file,
      ]);
      expect(apply.exitCode).toBe(0);
      expect(apply.stdout.toString()).toContain("尚未部署");
      expect(
        parseProfile(
          JSON.parse(await readFile(join(dir, "src/data/balance/official.json"), "utf8")),
        ),
      ).toEqual(profile);
      const unreviewed = Bun.spawnSync([process.execPath, join(dir, "scripts/game-guide.ts")]);
      expect(unreviewed.exitCode).toBe(1);
      const digest = unreviewed.stderr.toString().match(/current rules: ([a-f0-9]{64})/)?.[1];
      expect(digest).toBeDefined();
      // Model a maintainer's explicit translation review, in this isolated copy only.
      await writeFile(join(dir, "docs/wiki-content/reviewed-rules.txt"), `${digest}\n`);
      const guide = Bun.spawnSync([process.execPath, join(dir, "scripts/game-guide.ts")]);
      expect(guide.exitCode).toBe(0);
      expect(await readFile(join(dir, "docs/game-guide/Mechanics.md"), "utf8")).toContain(
        "Starting HP 57",
      );
      expect(await readFile(join(dir, "docs/game-guide/Mechanics-zh-CN.md"), "utf8")).toContain(
        "初始生命 57，生命上限 150",
      );
      await writeFile(file, '{"schemaVersion":99}');
      expect(
        Bun.spawnSync([process.execPath, join(dir, "scripts/balance.ts"), "apply", file]).exitCode,
      ).toBe(1);
      expect(
        parseProfile(
          JSON.parse(await readFile(join(dir, "src/data/balance/official.json"), "utf8")),
        ),
      ).toEqual(profile);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("browser-local version lifecycle", () => {
  test("versions are immutable, selection restores on refresh, and different stores are isolated", () => {
    const storage = memoryStorage();
    const store = new ProfileStore(storage);
    store.state.draft.payload.player.stats.damage = 42;
    const version = store.saveVersion();
    const official = officialProfile();
    expect(version.revision).toBe(official.id === "default" ? 1 : official.revision + 1);
    if (official.id !== "default") expect(version.id).toBe(official.id);
    store.select(version);
    store.state.draft.payload.player.stats.damage = 80;
    expect(store.active?.payload.player.stats.damage).toBe(42);
    const reload = new ProfileStore(storage);
    expect(reload.active?.payload.player.stats.damage).toBe(42);
    expect(new ProfileStore(memoryStorage()).state.draft).toEqual(officialProfile());
    store.saveVersion();
    expect(store.state.versions.map((item) => item.revision)).toEqual([
      version.revision,
      version.revision + 1,
    ]);
  });
  test("export/import preserves numeric payload, invalid imports do not overwrite the draft", () => {
    const store = new ProfileStore(memoryStorage());
    store.state.draft.payload.enemies.tank.hp = 987;
    const exported = JSON.stringify(store.state.draft);
    const other = new ProfileStore(memoryStorage());
    other.import(exported);
    expect(other.state.draft.payload).toEqual(store.state.draft.payload);
    expect(other.state.draft.id).not.toBe(store.state.draft.id);
    const before = structuredClone(other.state.draft);
    expect(() => other.import('{"schemaVersion":2}')).toThrow();
    expect(other.state.draft).toEqual(before);
  });
  test("deleted revisions are never reused after reload, restoring an old draft or removing every version", () => {
    const storage = memoryStorage();
    let store = new ProfileStore(storage);
    const first = store.saveVersion();
    const second = store.saveVersion();
    store.remove(second.id, second.revision);
    store = new ProfileStore(storage);
    store.state.draft.payload.player.stats.damage = 70;
    const third = store.saveVersion();
    expect(third.id).toBe(first.id);
    expect(second.revision).toBe(first.revision + 1);
    expect(third.revision).toBe(second.revision + 1);
    expect(third.payload).not.toEqual(second.payload);
    store.remove(first.id, first.revision);
    store.remove(third.id, third.revision);
    store.state.draft = structuredClone(first);
    store.persist();
    store = new ProfileStore(storage);
    expect(store.saveVersion().revision).toBe(third.revision + 1);
    store.copy(first);
    expect(store.saveVersion().revision).toBe(1);
    store.import(JSON.stringify(second));
    expect(store.saveVersion().revision).toBe(1);
  });
  test("legacy storage infers revision counters and invalid counters preserve the original storage", () => {
    const storage = memoryStorage();
    const draft = defaultProfile();
    draft.id = "legacy-profile";
    draft.revision = 2;
    storage.setItem(STORAGE_KEY, JSON.stringify({ draft, versions: [], selected: null }));
    const legacy = new ProfileStore(storage);
    expect(legacy.saveVersion().revision).toBe(3);
    const invalid = JSON.stringify({ ...legacy.state, revisions: { "legacy-profile": -1 } });
    storage.setItem(STORAGE_KEY, invalid);
    const broken = new ProfileStore(storage);
    expect(broken.warning).toContain("未能读取");
    expect(storage.getItem(STORAGE_KEY)).toBe(invalid);
  });
  test("stale tabs cannot reserve a revision or overwrite another tab's saved versions", () => {
    const storage = memoryStorage();
    const firstTab = new ProfileStore(storage);
    const secondTab = new ProfileStore(storage);
    const saved = firstTab.saveVersion();
    const persisted = storage.getItem(STORAGE_KEY);
    secondTab.state.draft.payload.player.stats.damage = 99;
    expect(() => secondTab.saveVersion()).toThrow("其他 PRE 标签页");
    expect(secondTab.state.versions).toHaveLength(0);
    expect(() => secondTab.persist()).toThrow("其他 PRE 标签页");
    expect(() => secondTab.remove(saved.id, saved.revision)).toThrow("其他 PRE 标签页");
    expect(storage.getItem(STORAGE_KEY)).toBe(persisted);
    const reloaded = new ProfileStore(storage);
    expect(reloaded.state.versions).toEqual([saved]);
    expect(reloaded.saveVersion().revision).toBe(saved.revision + 1);
  });
  test("failed shared persistence never creates an exportable saved revision", () => {
    const storage = memoryStorage();
    const first = new ProfileStore(storage).saveVersion();
    const full = new ProfileStore({
      getItem: (key) => storage.getItem(key),
      setItem: () => {
        throw new Error("Quota exceeded");
      },
    });
    full.state.draft.payload.player.stats.damage = 99;
    expect(() => full.saveVersion()).toThrow("固定版本未保存");
    expect(full.state.versions).toEqual([first]);
    expect(full.state.draft.payload.player.stats.damage).toBe(99);
    expect(new ProfileStore(storage).state.versions).toEqual([first]);
  });
  test("expected write conflicts never throw across the native lock callback boundary", async () => {
    const storage = memoryStorage();
    const locks = {
      request: async (_name: string, callback: (lock: Lock) => unknown) => {
        let result: unknown;
        expect(() => {
          result = callback({} as Lock);
        }).not.toThrow();
        return result;
      },
    } as unknown as Pick<LockManager, "request">;
    const stale = new ProfileStore(storage, locks);
    new ProfileStore(storage).saveVersion();
    await expect(stale.withWriteLock(() => stale.saveVersion())).rejects.toThrow("其他 PRE 标签页");
  });
  test("blocked/corrupt storage has a readable fallback and never silently rewrites the original", () => {
    const storage = memoryStorage();
    storage.data.set(STORAGE_KEY, "bad JSON");
    const store = new ProfileStore(storage);
    expect(store.warning).toContain("未能读取");
    expect(storage.getItem(STORAGE_KEY)).toBe("bad JSON");
    const unavailable = new ProfileStore(undefined);
    unavailable.saveVersion();
    expect(unavailable.warning).toContain("本地存储");
    expect(parseProfile(JSON.parse(JSON.stringify(unavailable.state.draft)))).toEqual(
      unavailable.state.draft,
    );
  });
});
