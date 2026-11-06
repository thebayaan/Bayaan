// @ai-generated
// The Adhkar widget's play button (PlayAdhkarIntent). It always plays, never
// pauses: it starts the list's audio from the widget's dhikr, or resumes and
// moves an existing session of that list there.
import {nextPlayableIndex, toSessionItems} from './sessionReducer';
import type {AdhkarSession, SessionEvent, SessionSource} from './types';

/** Events that make `source` play from `dhikrId` (null: from the start). */
export function widgetPlayEvents(
  session: AdhkarSession | null,
  source: SessionSource,
  dhikrId: string | null,
): SessionEvent[] {
  const requested = dhikrId
    ? source.items.findIndex(i => i.dhikrId === dhikrId)
    : -1;
  // A dhikr without audio starts from the next one that has some.
  const target = nextPlayableIndex(source.items, Math.max(0, requested));
  if (target < 0) return [];
  const targetId = source.items[target].dhikrId;

  const events: SessionEvent[] = [];
  let current: string | undefined;
  if (session && session.mode === 'all' && session.listId === source.listId) {
    // Play All on this list would toggle it, so resume it instead.
    if (session.status === 'paused') events.push({type: 'toggle'});
    current = session.items[session.index]?.dhikrId;
  } else {
    events.push({type: 'pressPlayAll', source});
    current = source.items[nextPlayableIndex(source.items, 0)]?.dhikrId;
  }
  if (current !== targetId) {
    events.push({type: 'swipedTo', listId: source.listId, dhikrId: targetId});
  }
  return events;
}

export async function playAdhkarFromWidget(
  superId: string,
  dhikrId: string | null,
): Promise<void> {
  // Lazy: the widget command handler loads this module on every platform,
  // and these pull in the adhkar database and i18n.
  const {adhkarService} =
    require('@/services/adhkar/AdhkarService') as typeof import('@/services/adhkar/AdhkarService');
  const {getSuperCategoryDisplayTitle} =
    require('@/utils/adhkarUtils') as typeof import('@/utils/adhkarUtils');
  const {useAdhkarSessionStore} =
    require('@/store/adhkarSessionStore') as typeof import('@/store/adhkarSessionStore');

  const data = await adhkarService.getAdhkarForSuperCategory(superId);
  if (!data) return;
  const source: SessionSource = {
    listId: superId,
    listTitle: getSuperCategoryDisplayTitle(data.superCategory),
    items: toSessionItems(data.categoryGroups.flatMap(g => g.adhkar)),
  };
  const store = useAdhkarSessionStore.getState();
  for (const event of widgetPlayEvents(store.session, source, dhikrId)) {
    store.dispatch(event);
  }
}

/** Pause or resume the adhkar session; a no-op when it is already there. */
export function adhkarPlaybackEvents(
  session: AdhkarSession | null,
  playing: boolean,
): SessionEvent[] {
  if (!session) return [];
  return (session.status !== 'paused') === playing ? [] : [{type: 'toggle'}];
}

export function setAdhkarPlaybackFromWidget(playing: boolean): void {
  const {useAdhkarSessionStore} =
    require('@/store/adhkarSessionStore') as typeof import('@/store/adhkarSessionStore');
  const store = useAdhkarSessionStore.getState();
  for (const event of adhkarPlaybackEvents(store.session, playing)) {
    store.dispatch(event);
  }
}
