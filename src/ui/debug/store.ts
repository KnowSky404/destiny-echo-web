import type { BalanceProfile } from "../../data/balance/model";
import { officialProfile, parseProfile, validateNumber } from "../../data/balance/profile";

export const STORAGE_KEY = "echoes:pre:balance:v1";
interface SavedProfiles {
  draft: BalanceProfile;
  versions: BalanceProfile[];
  selected: { id: string; revision: number } | null;
}
export class ProfileStore {
  state: SavedProfiles = { draft: officialProfile(), versions: [], selected: null };
  warning = "";
  private revisionHighWater = new Map<string, number>();
  private observedStorage: string | null = null;

  constructor(
    private readonly storage: Pick<Storage, "getItem" | "setItem"> | undefined,
    private readonly locks?: Pick<LockManager, "request">,
  ) {
    if (this.state.draft.id !== "default")
      this.revisionHighWater.set(this.state.draft.id, this.state.draft.revision);
    try {
      const raw = storage?.getItem(STORAGE_KEY);
      this.observedStorage = raw ?? null;
      if (!raw) return;
      const parsed = JSON.parse(raw) as SavedProfiles & { revisions?: unknown };
      if (!Array.isArray(parsed.versions) || parsed.versions.length > 100)
        throw new Error("本地版本列表无效");
      const versions = parsed.versions.map(parseProfile);
      const draft = parseProfile(parsed.draft);
      const revisions = new Map(this.revisionHighWater);
      if (parsed.revisions !== undefined) {
        if (
          !parsed.revisions ||
          typeof parsed.revisions !== "object" ||
          Array.isArray(parsed.revisions)
        )
          throw new Error("本地版本计数无效");
        for (const [id, value] of Object.entries(parsed.revisions)) {
          if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error("本地版本标识无效");
          const revision = validateNumber(value, ["版本", 1, 1e6, true], "revisions");
          revisions.set(id, Math.max(revisions.get(id) ?? 0, revision));
        }
      }
      // Older local stores did not retain counters. Their last draft may be the
      // only remaining evidence of an exported version that was later deleted.
      for (const profile of parsed.revisions === undefined ? [...versions, draft] : versions)
        revisions.set(profile.id, Math.max(revisions.get(profile.id) ?? 0, profile.revision));
      const selected = versions.find(
        (version) =>
          version.id === parsed.selected?.id && version.revision === parsed.selected.revision,
      );
      this.state = {
        draft,
        versions,
        selected: selected ? { id: selected.id, revision: selected.revision } : null,
      };
      this.revisionHighWater = revisions;
    } catch (error) {
      this.warning = `本地方案未能读取，现有存储未覆盖：${error instanceof Error ? error.message : String(error)}`;
    }
  }
  get active(): BalanceProfile | undefined {
    return this.state.versions.find(
      (version) =>
        version.id === this.state.selected?.id && version.revision === this.state.selected.revision,
    );
  }
  private assertCurrent(): void {
    if (this.storage && this.storage.getItem(STORAGE_KEY) !== this.observedStorage)
      throw new Error(
        "其他 PRE 标签页已更新方案；本页未覆盖保存内容。请先导出草稿，再刷新后继续保存",
      );
  }
  async withWriteLock<T>(action: () => T): Promise<T> {
    const write = () => {
      // Firefox reports exceptions thrown across this native callback boundary
      // as page errors even when the request promise has a rejection handler.
      try {
        this.assertCurrent();
        return { ok: true as const, value: action() };
      } catch (error) {
        return { ok: false as const, error };
      }
    };
    const result = this.locks ? await this.locks.request(`${STORAGE_KEY}:write`, write) : write();
    if (!result.ok) throw result.error;
    return result.value;
  }
  persist(): boolean {
    if (!this.storage) {
      this.warning = "浏览器不允许本地存储；本页仍可测试和导出，刷新后不会保留";
      return false;
    }
    this.assertCurrent();
    try {
      const raw = JSON.stringify({
        ...this.state,
        revisions: Object.fromEntries(this.revisionHighWater),
      });
      this.storage.setItem(STORAGE_KEY, raw);
      this.observedStorage = raw;
      this.warning = "";
      return true;
    } catch {
      this.warning = "本地存储不可用或已满；本页仍可测试和导出，请先导出备份";
      return false;
    }
  }
  private saveProfile(
    source: BalanceProfile,
    replaceDraft: boolean,
    newIdentity = false,
  ): BalanceProfile {
    this.assertCurrent();
    const profile = parseProfile(source);
    if (this.state.versions.length >= 100)
      throw new Error("最多保存 100 个版本，请导出并删除旧版本后继续");
    if (
      newIdentity ||
      profile.id === "default" ||
      (!this.storage && !this.state.versions.some((item) => item.id === profile.id))
    )
      profile.id = crypto.randomUUID();
    profile.revision = validateNumber(
      1 + (this.revisionHighWater.get(profile.id) ?? 0),
      ["版本", 1, 1e6, true],
      "revision",
    );
    const previousDraft = this.state.draft;
    const previousRevision = this.revisionHighWater.get(profile.id);
    this.state.versions.push(structuredClone(profile));
    if (replaceDraft) this.state.draft = structuredClone(profile);
    this.revisionHighWater.set(profile.id, profile.revision);
    if (!this.persist() && this.storage) {
      this.state.versions.pop();
      this.state.draft = previousDraft;
      if (previousRevision === undefined) this.revisionHighWater.delete(profile.id);
      else this.revisionHighWater.set(profile.id, previousRevision);
      throw new Error(`${this.warning}；固定版本未保存，请导出草稿`);
    }
    return profile;
  }
  saveVersion(): BalanceProfile {
    return this.saveProfile(this.state.draft, true);
  }
  importVersion(text: string): BalanceProfile {
    if (text.length > 2_000_000) throw new Error("配置文件不能超过 2 MB");
    return this.saveProfile(parseProfile(JSON.parse(text)), false, true);
  }
  select(profile: BalanceProfile): void {
    this.assertCurrent();
    if (
      !this.state.versions.some(
        (item) => item.id === profile.id && item.revision === profile.revision,
      )
    )
      throw new Error("请先保存为版本");
    this.state.selected = { id: profile.id, revision: profile.revision };
    this.persist();
  }
  copy(profile: BalanceProfile): void {
    this.assertCurrent();
    this.state.draft = {
      ...structuredClone(profile),
      id: crypto.randomUUID(),
      revision: 1,
      name: `${profile.name.slice(0, 90)} 副本`,
    };
    this.persist();
  }
  import(text: string): void {
    this.assertCurrent();
    if (text.length > 2_000_000) throw new Error("配置文件不能超过 2 MB");
    const profile = parseProfile(JSON.parse(text));
    this.state.draft = { ...profile, id: crypto.randomUUID(), revision: 1 };
    this.persist();
  }
  remove(id: string, revision: number): void {
    this.assertCurrent();
    this.state.versions = this.state.versions.filter(
      (item) => item.id !== id || item.revision !== revision,
    );
    if (this.state.selected?.id === id && this.state.selected.revision === revision)
      this.state.selected = null;
    this.persist();
  }
}

export function browserStore(): ProfileStore {
  try {
    if (!navigator.locks) {
      const store = new ProfileStore(undefined);
      store.warning = "浏览器不支持安全的跨标签页保存；本页仍可测试和导出，刷新后不会保留";
      return store;
    }
    return new ProfileStore(window.localStorage, navigator.locks);
  } catch {
    return new ProfileStore(undefined);
  }
}
