// Analytics events raised by widget actions while the app was not running.

export interface AdhkarSessionCompletedEvent {
  name: 'adhkar_session_completed';
  props: {category: string; duration_ms: number; dhikr_count: number};
  // When the widget action completed the session (epoch ms). Older queued
  // events have none; the parser fills in the drain time.
  completedAtMs: number;
}

export type PendingWidgetEvent = AdhkarSessionCompletedEvent;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toAdhkarSessionCompleted(
  value: unknown,
  nowMs: number,
): AdhkarSessionCompletedEvent | null {
  if (!isRecord(value) || value.name !== 'adhkar_session_completed') {
    return null;
  }
  const props = value.props;
  if (
    !isRecord(props) ||
    typeof props.category !== 'string' ||
    typeof props.duration_ms !== 'number' ||
    typeof props.dhikr_count !== 'number'
  ) {
    return null;
  }
  const at = value.completedAtMs;
  return {
    name: 'adhkar_session_completed',
    props: {
      category: props.category,
      duration_ms: props.duration_ms,
      dhikr_count: props.dhikr_count,
    },
    completedAtMs:
      typeof at === 'number' && Number.isFinite(at) && at > 0 ? at : nowMs,
  };
}

export function parsePendingWidgetEvents(
  json: string | null,
  nowMs: number = Date.now(),
): PendingWidgetEvent[] {
  if (!json) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const items: unknown[] = parsed;
  const events: PendingWidgetEvent[] = [];
  for (const item of items) {
    const event = toAdhkarSessionCompleted(item, nowMs);
    if (event) events.push(event);
  }
  return events;
}
