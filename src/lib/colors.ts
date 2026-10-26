const PALETTES: Array<[string, string]> = [
  ["#7c3aed", "#db2777"],
  ["#0891b2", "#22c55e"],
  ["#ea580c", "#db2777"],
  ["#2563eb", "#7c3aed"],
  ["#0d9488", "#3b82f6"],
  ["#b45309", "#be123c"],
  ["#4f46e5", "#06b6d4"],
  ["#be185d", "#7c3aed"],
  ["#15803d", "#0d9488"],
  ["#c026d3", "#f59e0b"]
];

export function gradientFor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  const [from, to] = PALETTES[hash % PALETTES.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}

export function accentFor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return PALETTES[hash % PALETTES.length][0];
}
