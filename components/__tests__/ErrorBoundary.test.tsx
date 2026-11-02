/**
 * @jest-environment node
 */
// @ai-generated
// The node environment loads the CommonJS build of @sentry/react; the default
// environment resolves its ESM build, which Jest does not transform.
//
// A render throw below the root boundary reached the user as an unstyled line
// of text with no way out, and reached Sentry as nothing. These tests pin both
// halves of the fix: the boundary reports, and the user can retry. They run the
// real Sentry.ErrorBoundary, and a fake client takes what it reports.

import React, {useEffect} from 'react';
import {Text} from 'react-native';
import TestRenderer, {act, ReactTestRenderer} from 'react-test-renderer';
import branding from '@/config/branding';
import ErrorBoundary from '../ErrorBoundary';

const mockFlush: jest.Mock = jest.fn(() => Promise.resolve(true));

jest.mock('@sentry/react-native', () => ({
  ErrorBoundary: jest.requireActual('@sentry/react').ErrorBoundary,
  flush: () => mockFlush(),
}));

const {getCurrentScope} = jest.requireActual('@sentry/react');

const RETRY_ID = 'app-error-screen-retry';
const noop = () => undefined;

function Boom({throws}: {throws: boolean}) {
  if (throws) throw new Error('kaboom');
  return <Text>recovered</Text>;
}

function BoomInEffect() {
  useEffect(() => {
    throw new Error('kaboom in effect');
  }, []);
  return <Text>committed</Text>;
}

function mount(child: React.ReactElement): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(<ErrorBoundary>{child}</ErrorBoundary>);
  });
  return renderer as ReactTestRenderer;
}

function update(renderer: ReactTestRenderer, child: React.ReactElement) {
  act(() => {
    renderer.update(<ErrorBoundary>{child}</ErrorBoundary>);
  });
}

function retryButtons(renderer: ReactTestRenderer) {
  return renderer.root.findAll(
    node =>
      node.props.testID === RETRY_ID &&
      typeof node.props.onPress === 'function',
  );
}

function pressRetry(renderer: ReactTestRenderer) {
  act(() => {
    retryButtons(renderer)[0].props.onPress();
  });
}

function textOf(renderer: ReactTestRenderer) {
  return JSON.stringify(renderer.toJSON());
}

describe('ErrorBoundary', () => {
  const captureException = jest.fn(() => 'abcdef1234567890');
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    captureException.mockClear();
    mockFlush.mockClear();
    getCurrentScope().setClient({captureException});
    // React logs the caught error.
    consoleError = jest.spyOn(console, 'error').mockImplementation(noop);
  });

  afterEach(() => {
    getCurrentScope().setClient(undefined);
    consoleError.mockRestore();
  });

  it('reports the error to Sentry with the tag and the component stack', () => {
    mount(<Boom throws />);

    expect(captureException).toHaveBeenCalledTimes(1);
    const [error, , scope] = captureException.mock.calls[0] as unknown as [
      Error & {cause?: {stack?: string}},
      unknown,
      {getScopeData: () => {tags: Record<string, string>}},
    ];
    expect(error.message).toBe('kaboom');
    expect(scope.getScopeData().tags.scope).toBe('error-boundary');
    expect(error.cause?.stack).toContain('ErrorBoundary');
  });

  it('flushes the report', () => {
    mount(<Boom throws />);

    expect(mockFlush).toHaveBeenCalledTimes(1);
  });

  it('shows a readable message with the app name', () => {
    const renderer = mount(<Boom throws />);

    expect(textOf(renderer)).toContain('Something went wrong');
    expect(textOf(renderer)).toContain(
      `${branding.appName} hit an unexpected error on this screen. Your downloads and saved items are safe.`,
    );
  });

  it('recovers on retry when the child stops throwing', () => {
    const renderer = mount(<Boom throws />);

    update(renderer, <Boom throws={false} />);
    pressRetry(renderer);

    expect(textOf(renderer)).toContain('recovered');
  });

  it('stops offering a retry after two attempts', () => {
    const renderer = mount(<Boom throws />);

    pressRetry(renderer);
    pressRetry(renderer);

    expect(retryButtons(renderer)).toHaveLength(0);
    expect(textOf(renderer)).toContain('close the app fully');
  });

  it('stops offering a retry when the throw comes from an effect', () => {
    const renderer = mount(<BoomInEffect />);

    pressRetry(renderer);
    pressRetry(renderer);

    expect(retryButtons(renderer)).toHaveLength(0);
  });

  it('keeps the budget for the session after a recovery', () => {
    const renderer = mount(<Boom throws />);

    // Incident 1: one retry throws again, the second one recovers.
    pressRetry(renderer);
    update(renderer, <Boom throws={false} />);
    pressRetry(renderer);
    expect(textOf(renderer)).toContain('recovered');

    // Incident 2: the budget is spent, so the screen asks for a restart.
    update(renderer, <Boom throws />);
    expect(textOf(renderer)).toContain('close the app fully');
    expect(retryButtons(renderer)).toHaveLength(0);
  });

  it('renders its children when nothing throws', () => {
    const renderer = mount(<Boom throws={false} />);

    expect(textOf(renderer)).toContain('recovered');
    expect(captureException).not.toHaveBeenCalled();
  });
});
