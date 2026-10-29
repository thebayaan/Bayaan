// @ai-generated
import {useCallback, useRef, type RefObject} from 'react';

type Pager = {scrollToIndex(params: {index: number; animated?: boolean}): void};

// iOS can lose a remounted pager's starting offset after a rotation: the
// offset is applied before the list has its new size, so the first page
// shows blank until a swipe. The returned `onLayout` handler scrolls each
// mount of the pager to `index` once it has laid out (a no-op when the
// offset held). Later layouts of the same mount leave the user's page alone.
export function useSettlePager(
  listRef: RefObject<Pager | null>,
  index: number,
): () => void {
  const settled = useRef<Pager | null>(null);
  return useCallback(() => {
    const list = listRef.current;
    if (!list || settled.current === list) return;
    settled.current = list;
    list.scrollToIndex({index, animated: false});
  }, [listRef, index]);
}
