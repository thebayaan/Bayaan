// App State uses complete PUTs, but the intent is a leaf-level local patch.
// Arrays are atomic; maps are merged recursively, including explicit removals.
export interface SettingsChange {
  path: string[];
  value?: unknown;
  remove?: true;
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function equal(left: unknown, right: unknown): boolean {
  if (object(left) && object(right)) {
    const keys = Object.keys(left);
    return (
      keys.length === Object.keys(right).length &&
      keys.every(
        key => Object.hasOwn(right, key) && equal(left[key], right[key]),
      )
    );
  }
  return JSON.stringify(left) === JSON.stringify(right);
}

export function settingsChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  path: string[] = [],
): SettingsChange[] {
  const changes: SettingsChange[] = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const nextPath = [...path, key];
    if (!Object.hasOwn(after, key))
      changes.push({path: nextPath, remove: true});
    else if (object(before[key]) && object(after[key])) {
      changes.push(...settingsChanges(before[key], after[key], nextPath));
    } else if (!equal(before[key], after[key])) {
      // An added map is a set of leaf additions, not a replacement of unknown
      // siblings that might already exist in the remote document.
      if (object(after[key])) {
        changes.push(...settingsChanges({}, after[key], nextPath));
      } else changes.push({path: nextPath, value: after[key]});
    }
  }
  return changes;
}

export function applySettingsChanges(
  remote: Record<string, unknown>,
  changes: SettingsChange[],
): Record<string, unknown> {
  const result = JSON.parse(JSON.stringify(remote)) as Record<string, unknown>;
  for (const change of changes) {
    // Never traverse prototypes, even when restoring untrusted persisted JSON.
    if (
      !change.path.length ||
      change.path.some(key =>
        ['__proto__', 'prototype', 'constructor'].includes(key),
      )
    )
      continue;
    let target = result;
    for (const key of change.path.slice(0, -1)) {
      if (!object(target[key])) target[key] = {};
      target = target[key] as Record<string, unknown>;
    }
    const key = change.path[change.path.length - 1];
    if (change.remove) delete target[key];
    else target[key] = JSON.parse(JSON.stringify(change.value));
  }
  return result;
}
