export type Random = () => number;

// A run owns its RNG: deterministic tests never depend on the global random source.
export interface SeededRandom extends Random {
  getState(): number;
  setState(state: number): void;
}

export function seededRandom(seed: number): SeededRandom {
  let state = seed >>> 0;
  const random = () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  return Object.assign(random, {
    getState: () => state,
    setState: (saved: number) => {
      state = saved;
    },
  });
}

export function shuffled<T>(items: readonly T[], random: Random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    const value = result[index];
    const replacement = result[other];
    if (value !== undefined && replacement !== undefined) {
      result[index] = replacement;
      result[other] = value;
    }
  }
  return result;
}

// Uniform weights keep the original shuffle and its RNG consumption exactly.
export function weightedShuffle<T>(
  items: readonly T[],
  weight: (item: T) => number,
  random: Random,
): T[] {
  const pool = items.filter((item) => weight(item) > 0);
  if (pool.every((item) => weight(item) === weight(pool[0] as T))) return shuffled(pool, random);
  const result: T[] = [];
  while (pool.length) {
    let roll = random() * pool.reduce((sum, item) => sum + weight(item), 0);
    let index = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      roll -= weight(pool[i] as T);
      if (roll < 0) {
        index = i;
        break;
      }
    }
    const item = pool.splice(index, 1)[0];
    if (item !== undefined) result.push(item);
  }
  return result;
}

export function weightedChoice<T>(
  items: readonly T[],
  weight: (item: T) => number,
  random: Random,
): T | undefined {
  const pool = items.filter((item) => weight(item) > 0);
  if (!pool.length) return undefined;
  let roll = random() * pool.reduce((sum, item) => sum + weight(item), 0);
  for (const item of pool) {
    roll -= weight(item);
    if (roll < 0) return item;
  }
  return pool[pool.length - 1];
}
