import { describe, expect, test } from "bun:test";
import { debugSource, debugText, metricsDebugText, profileDebugText } from "../../src/i18n/debug";

const names = [
  "覆盖 基础伤害",
  "修改 生命上限",
  "编辑 当前生命",
  "所有嘲讽巨像",
  "已保存 玩家与构筑",
  "规则 1：1–无限",
  "用户 {name} {label} {revision}",
  `<profile> $& $1 \${name} \`literal\``,
  "__proto__",
];

describe("PRE presentation translation", () => {
  test.each(names)(
    "preserves profile name %s in lists, statuses, identities and metrics",
    (name) => {
      const profile = Object.freeze({ id: "user-profile", name, revision: 7 });
      const contexts = [
        [{ kind: "version", selected: false }, `${name} v7`, `${name} v7`],
        [
          { kind: "version", selected: true },
          `${name} v7 · 下次打开时沿用`,
          `${name} v7 · Reuse on next visit`,
        ],
        [{ kind: "saved" }, `已保存 ${name} v7`, `Saved ${name} v7`],
        [{ kind: "draft" }, `草稿：${name} v7（可编辑）`, `Draft: ${name} v7 (editable)`],
        [{ kind: "selected" }, `选中版本：${name} v7`, `Selected version: ${name} v7`],
        [
          { kind: "running", width: 450 },
          `正在运行：${name} v7 · 逻辑宽度 450`,
          `Running: ${name} v7 · Logical width 450`,
        ],
        [
          { kind: "case", hash: "abc123" },
          `方案：${name} v7 · 内容哈希 abc123`,
          `Profile: ${name} v7 · Content hash abc123`,
        ],
        [
          { kind: "candidate" },
          `已导入候选 ${name} v7 为独立版本；草稿、选中版本与当前战斗保持不变`,
          `Imported candidate ${name} v7 as a separate version; draft, selection and battle are unchanged.`,
        ],
      ] as const;
      for (const [context, chinese, english] of contexts) {
        const source = profileDebugText(profile, context);
        expect(debugSource(source, "en")).toBe(english);
        expect(debugSource(source, "zh-CN")).toBe(chinese);
        expect(debugSource(source, "en").replaceAll(name, "profile")).not.toMatch(
          /\p{Script=Han}/u,
        );
      }
      const metrics = metricsDebugText(profile, {
        seed: 45,
        stage: 2,
        stageTime: 12.5,
        activeTime: 12,
        stageDamage: 200,
        stageTaken: 10,
        stageHealing: 4,
        stageKills: 5,
        damage: 300,
        taken: 20,
        healing: 8,
        kills: 9,
      });
      expect(debugSource(metrics, "en")).toBe(
        `${name} v7 · Seed 45 · Stage 2 · Stage 12.5s / Active 12.0s · Stage damage 200 / Taken 10 / Healing 4 / Kills 5 · Total damage 300 / Taken 20 / Healing 8 / Kills 9`,
      );
      expect(debugSource(metrics, "zh-CN")).toBe(
        `${name} v7 · 种子 45 · 第 2 关 · 本关 12.5s / 实战 12.0s · 本关伤害 200 / 承伤 10 / 治疗 4 / 击杀 5 · 累计伤害 300 / 承伤 20 / 治疗 8 / 击杀 9`,
      );
      expect(profile).toEqual({ id: "user-profile", name, revision: 7 });
    },
  );

  test("localizes the built-in official display without changing a user profile or export name", () => {
    const official = Object.freeze({ id: "default", name: "当前正式数值", revision: 1 });
    expect(debugSource(profileDebugText(official, { kind: "draft" }), "en")).toBe(
      "Draft: Official balance v1 (editable)",
    );
    expect(
      debugSource(profileDebugText({ ...official, id: "user-copy" }, { kind: "draft" }), "en"),
    ).toBe("Draft: 当前正式数值 v1 (editable)");
    expect(official.name).toBe("当前正式数值");
  });

  test("keeps field labels, enemy options and nested validation messages translated", () => {
    expect(debugText("覆盖 基础伤害", "en")).toBe("Override Base damage");
    expect(debugText("所有嘲讽巨像", "en")).toBe("All Taunting Colossus");
    expect(debugText("#15 游离残响 · 50/50", "en")).toBe("#15 Wisp · 50/50");
    expect(debugText("规则 1：1–无限", "en")).toBe("Rule 1: 1–Infinity");
    expect(debugText("方案.payload: 必须是普通对象", "en")).toBe(
      "profile.payload: expected a plain object",
    );
    expect(debugText("player.hp: 需要 0–100 之间的有限数值", "en")).toBe(
      "player.hp: expected a finite number between 0 and 100",
    );
    expect(debugText("本地方案未能读取，现有存储未覆盖：本地版本列表无效", "en")).toBe(
      "Local profiles could not be read; existing storage was preserved: Invalid local version list",
    );
  });

  test.each(["toString", "constructor", "__proto__", "Unrecognized original value"])(
    "keeps unknown text %s unchanged",
    (source) => {
      expect(debugText(source, "en")).toBe(source);
      expect(debugText(source, "zh-CN")).toBe(source);
    },
  );
});
