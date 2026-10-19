export type Random = () => number;

// A run owns its RNG: deterministic tests never depend on the global random source.
export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
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
