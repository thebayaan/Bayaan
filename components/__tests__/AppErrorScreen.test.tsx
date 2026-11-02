// @ai-generated
import React from 'react';
import {Appearance, StatusBar} from 'react-native';
import TestRenderer, {act, ReactTestRenderer} from 'react-test-renderer';
import {ROOT_COLORS} from '@/constants/rootColors';
import AppErrorScreen, {safeText} from '../AppErrorScreen';

const RETRY_ID = 'app-error-screen-retry';

function mount(
  element: Parameters<typeof TestRenderer.create>[0],
): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer as ReactTestRenderer;
}

function retryButtons(renderer: ReactTestRenderer) {
  return renderer.root.findAll(
    node =>
      node.props.testID === RETRY_ID &&
      typeof node.props.onPress === 'function',
  );
}

function background(renderer: ReactTestRenderer) {
  const [screen] = renderer.root.findAll(
    node =>
      node.props.testID === 'app-error-screen' && typeof node.type === 'string',
  );
  return Object.assign({}, ...screen.props.style).backgroundColor;
}

describe('AppErrorScreen', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shows the title and the message', () => {
    const text = JSON.stringify(
      mount(<AppErrorScreen message="Error loading fonts" />).toJSON(),
    );

    expect(text).toContain('Something went wrong');
    expect(text).toContain('Error loading fonts');
  });

  it('shows no button without onRetry', () => {
    const renderer = mount(<AppErrorScreen message="m" />);

    expect(retryButtons(renderer)).toHaveLength(0);
  });

  it('calls onRetry from the button', () => {
    const onRetry = jest.fn();
    const renderer = mount(<AppErrorScreen message="m" onRetry={onRetry} />);

    act(() => {
      retryButtons(renderer)[0].props.onPress();
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it.each(['light', 'dark'] as const)('uses the %s colors', scheme => {
    jest.spyOn(Appearance, 'getColorScheme').mockReturnValue(scheme);

    const renderer = mount(<AppErrorScreen message="m" />);

    expect(background(renderer)).toBe(ROOT_COLORS[scheme].background);
    expect(renderer.root.findByType(StatusBar).props.barStyle).toBe(
      scheme === 'dark' ? 'light-content' : 'dark-content',
    );
  });
});

describe('safeText', () => {
  it('returns the fallback when the read throws or gives no text', () => {
    expect(
      safeText(() => {
        throw new Error('i18n failed');
      }, 'fallback'),
    ).toBe('fallback');
    expect(safeText(() => '', 'fallback')).toBe('fallback');
    expect(safeText(() => 'text', 'fallback')).toBe('text');
  });
});
