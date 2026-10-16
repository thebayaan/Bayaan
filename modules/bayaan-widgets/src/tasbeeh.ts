export interface PendingTasbeeh {
  dhikrId: string;
  count: number;
  day: string; // YYYY-MM-DD local
  reset?: boolean; // the widget's reset button; count is 0
}

export interface TasbeehOp {
  reset: boolean;
  increments: number; // taps after the last reset
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;
}

export function mergeTasbeehIncrements(
  pending: PendingTasbeeh[],
  today: string,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const p of pending) {
    if (p.day !== today || p.count <= 0) continue;
    totals[p.dhikrId] = (totals[p.dhikrId] ?? 0) + p.count;
  }
  return totals;
}

// What the app must apply per dhikr: an optional reset, then increments.
export function planTasbeehOps(
  pending: PendingTasbeeh[],
  today: string,
): Record<string, TasbeehOp> {
  const ops: Record<string, TasbeehOp> = {};
  for (const p of pending) {
    if (p.day !== today) continue;
    if (p.reset === true) {
      ops[p.dhikrId] = {reset: true, increments: 0};
      continue;
    }
    if (p.count <= 0) continue;
    const op = ops[p.dhikrId] ?? {reset: false, increments: 0};
    ops[p.dhikrId] = {reset: op.reset, increments: op.increments + p.count};
  }
  return ops;
}

function isPendingTasbeeh(value: unknown): value is PendingTasbeeh {
  return (
    typeof value === 'object' &&
    value !== null &&
    'dhikrId' in value &&
    'count' in value &&
    'day' in value &&
    typeof value.dhikrId === 'string' &&
    typeof value.count === 'number' &&
    typeof value.day === 'string' &&
    (!('reset' in value) || typeof value.reset === 'boolean')
  );
}

export function parsePendingTasbeeh(json: string): PendingTasbeeh[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  return Array.isArray(parsed) ? parsed.filter(isPendingTasbeeh) : [];
}
