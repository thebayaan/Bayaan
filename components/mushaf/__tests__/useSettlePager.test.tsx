// @ai-generated
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {useSettlePager} from '../useSettlePager';

type FakePager = {scrollToIndex: jest.Mock};
const fakePager = (): FakePager => ({scrollToIndex: jest.fn()});

function setup(index: number) {
  const listRef: {current: FakePager | null} = {current: null};
  let onLayout: (() => void) | undefined;
  function Host({page}: {page: number}) {
    onLayout = useSettlePager(listRef, page);
    return null;
  }
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<Host page={index} />);
  });
  return {
    listRef,
    layout: () => onLayout?.(),
    setPage: (page: number) =>
      act(() => {
        renderer.update(<Host page={page} />);
      }),
  };
}

describe('useSettlePager', () => {
  it('scrolls a newly mounted pager to its page on its first layout', () => {
    const {listRef, layout} = setup(4);
    const list = fakePager();
    listRef.current = list;
    layout();
    expect(list.scrollToIndex).toHaveBeenCalledTimes(1);
    expect(list.scrollToIndex).toHaveBeenCalledWith({
      index: 4,
      animated: false,
    });
  });

  it('leaves the same pager alone on later layouts', () => {
    const {listRef, layout, setPage} = setup(4);
    const list = fakePager();
    listRef.current = list;
    layout();
    // The reader swipes to another page, then lays out again (keyboard,
    // toolbar): the user's page must not be pulled back.
    setPage(7);
    layout();
    layout();
    expect(list.scrollToIndex).toHaveBeenCalledTimes(1);
  });

  it('settles again when the pager remounts after a rotation', () => {
    const {listRef, layout, setPage} = setup(4);
    const portrait = fakePager();
    listRef.current = portrait;
    layout();
    setPage(7);
    // A new width key remounts the list at the current page.
    const landscape = fakePager();
    listRef.current = landscape;
    layout();
    expect(landscape.scrollToIndex).toHaveBeenCalledWith({
      index: 7,
      animated: false,
    });
    expect(portrait.scrollToIndex).toHaveBeenCalledTimes(1);
  });

  it('does nothing before the list is attached', () => {
    const {layout} = setup(4);
    expect(() => layout()).not.toThrow();
  });
});
