// @ai-generated
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {useInitialPageLanding} from '../useInitialPageLanding';

type Landing = ReturnType<typeof useInitialPageLanding>;

/** Renders the hook and hands back its latest result. */
function mount(
  page: number,
  scrollToIndex: (index: number) => void,
  schedule: (run: () => void) => void,
): {current: () => Landing; setPage: (next: number) => void} {
  let latest: Landing | null = null;
  function Probe({start}: {start: number}): null {
    latest = useInitialPageLanding(start, scrollToIndex, schedule);
    return null;
  }
  let renderer: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    renderer = TestRenderer.create(<Probe start={page} />);
  });
  return {
    current: () => {
      if (!latest) throw new Error('hook did not render');
      return latest;
    },
    setPage: next => {
      act(() => {
        renderer?.update(<Probe start={next} />);
      });
    },
  };
}

const runNow = (run: () => void): void => run();

describe('useInitialPageLanding', () => {
  it('scrolls to the start page once the list has loaded', () => {
    const scrollToIndex = jest.fn();
    const hook = mount(42, scrollToIndex, runNow);

    hook.current().onLoad();

    expect(scrollToIndex).toHaveBeenCalledWith(41);
  });

  it("reports pages as the reader's only after landing", () => {
    const pending: Array<() => void> = [];
    const hook = mount(42, jest.fn(), run => {
      pending.push(run);
    });

    expect(hook.current().hasLanded()).toBe(false);
    hook.current().onLoad();
    expect(hook.current().hasLanded()).toBe(false);
    pending.forEach(run => run());
    expect(hook.current().hasLanded()).toBe(true);
  });

  it('keeps the page it opened with when the reader page changes later', () => {
    const scrollToIndex = jest.fn();
    const hook = mount(42, scrollToIndex, runNow);

    hook.setPage(68);
    hook.current().onLoad();

    expect(scrollToIndex).toHaveBeenCalledWith(41);
  });

  it('lands only once', () => {
    const scrollToIndex = jest.fn();
    const hook = mount(42, scrollToIndex, runNow);

    hook.current().onLoad();
    hook.current().onLoad();

    expect(scrollToIndex).toHaveBeenCalledTimes(1);
  });
});
