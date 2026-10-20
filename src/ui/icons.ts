const PATHS: Record<string, string> = {
  damage: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z M12 7v10M7 12h10",
  haste: "M12 8v5l4 2 M9 2h6 M12 4a9 9 0 1 0 .01 0",
  multishot: "m4 15 2-6 2 6M6 9v12 M10 8l2-6 2 6M12 2v17 M16 15l2-6 2 6M18 9v12",
  piercing: "M3 12h18m-5-5 5 5-5 5 M7 4v5m0 6v5 M12 4v5m0 6v5",
  vitality: "M20 5c-4-4-8 2-8 2S8 1 4 5c-5 6 8 15 8 15s13-9 8-15Z M8 12h8m-4-4v8",
  execution: "M3 18h18M7 3v10m-3-3 3 3 3-3M17 3v10m-3-3 3 3 3-3",
  ward: "m12 2 8 3v6c0 5-8 11-8 11S4 16 4 11V5Z M8 12l3 3 5-6",
};

export function icon(name: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${PATHS[name] ?? PATHS.damage}"/></svg>`;
}
