// Parses durations like "30s", "5m", "1h" into milliseconds.

export function parseDurationMs(input: string): number {
  const m = input.trim().match(/^(\d+)\s*(s|m|h)$/i);
  if (!m) {
    throw new Error(`Invalid duration "${input}". Expected formats: 30s, 5m, 1h.`);
  }
  const n = parseInt(m[1], 10);
  switch (m[2].toLowerCase()) {
    case 's':
      return n * 1_000;
    case 'm':
      return n * 60_000;
    case 'h':
      return n * 3_600_000;
    default:
      throw new Error(`Unreachable duration unit: ${m[2]}`);
  }
}
