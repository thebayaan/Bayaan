import {createFocusWithin} from './focusWithin';

describe('createFocusWithin', () => {
  it('starts outside', () => {
    expect(createFocusWithin().inside()).toBe(false);
  });

  it('is inside after a focus and outside after its blur', () => {
    const f = createFocusWithin();
    f.focus(10);
    expect(f.inside()).toBe(true);
    f.blur(10);
    expect(f.inside()).toBe(false);
  });

  it('stays inside when focus moves within the pane, blur first', () => {
    const f = createFocusWithin();
    f.focus(10);
    f.blur(10);
    f.focus(11);
    expect(f.inside()).toBe(true);
  });

  it('stays inside when focus moves within the pane, focus first', () => {
    const f = createFocusWithin();
    f.focus(10);
    f.focus(11);
    f.blur(10);
    expect(f.inside()).toBe(true);
  });

  it('reset forgets the focused view', () => {
    const f = createFocusWithin();
    f.focus(10);
    f.reset();
    expect(f.inside()).toBe(false);
  });
});
