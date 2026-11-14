// @ai-generated
/**
 * useWordAudio with a fake expo-audio player: one player at a time, the
 * state following its status, and the player and its subscription released
 * on a second toggle, a url change and unmount.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import type {AudioStatus} from 'expo-audio';

interface FakePlayer {
  uri: string;
  play: jest.Mock;
  pause: jest.Mock;
  remove: jest.Mock;
  addListener: jest.Mock;
  subscription: {remove: jest.Mock};
  emit: (status: Partial<AudioStatus>) => void;
}

const mockPlayers: FakePlayer[] = [];
const mockCreate: {error: Error | null} = {error: null};

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn((source: {uri: string}) => {
    if (mockCreate.error) throw mockCreate.error;
    const listeners: ((status: Partial<AudioStatus>) => void)[] = [];
    const subscription = {remove: jest.fn()};
    const player: FakePlayer = {
      uri: source.uri,
      play: jest.fn(),
      pause: jest.fn(),
      remove: jest.fn(),
      addListener: jest.fn(
        (_event: string, listener: (status: Partial<AudioStatus>) => void) => {
          listeners.push(listener);
          return subscription;
        },
      ),
      subscription,
      emit: status =>
        listeners.forEach(listener =>
          listener({
            playing: false,
            didJustFinish: false,
            error: null,
            ...status,
          }),
        ),
    };
    mockPlayers.push(player);
    return player;
  }),
}));

import {createAudioPlayer} from 'expo-audio';
import {useWordAudio, type WordAudio} from '../useWordAudio';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const URL_A = 'https://audio.qurancdn.com/wbw/002_255_003.mp3';
const URL_B = 'https://audio.qurancdn.com/wbw/002_255_004.mp3';

let audio: WordAudio;
function Probe({url}: {url: string | null}) {
  audio = useWordAudio(url);
  return null;
}

function render(url: string | null) {
  let created: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    created = TestRenderer.create(<Probe url={url} />);
  });
  if (!created) throw new Error('not rendered');
  const renderer: TestRenderer.ReactTestRenderer = created;
  return {
    update: (next: string | null) =>
      act(() => renderer.update(<Probe url={next} />)),
    unmount: () => act(() => renderer.unmount()),
  };
}

const toggle = () => act(() => audio.toggle());
const last = () => mockPlayers[mockPlayers.length - 1];

function expectReleased(player: FakePlayer) {
  expect(player.pause).toHaveBeenCalled();
  expect(player.remove).toHaveBeenCalledTimes(1);
  expect(player.subscription.remove).toHaveBeenCalledTimes(1);
}

beforeEach(() => {
  mockPlayers.length = 0;
  mockCreate.error = null;
  jest.mocked(createAudioPlayer).mockClear();
});

describe('useWordAudio', () => {
  it('toggle creates a player for the word, listens to it and plays it', () => {
    const view = render(URL_A);
    expect(audio.state).toBe('idle');
    toggle();
    expect(createAudioPlayer).toHaveBeenCalledWith({uri: URL_A});
    const player = last();
    expect(player.addListener).toHaveBeenCalledWith(
      'playbackStatusUpdate',
      expect.any(Function),
    );
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(audio.state).toBe('loading');
    act(() => player.emit({isBuffering: true}));
    expect(audio.state).toBe('loading');
    act(() => player.emit({playing: true}));
    expect(audio.state).toBe('playing');
    view.unmount();
  });

  it('a second toggle pauses and releases it', () => {
    const view = render(URL_A);
    toggle();
    act(() => last().emit({playing: true}));
    toggle();
    expectReleased(mockPlayers[0]);
    expect(audio.state).toBe('idle');
    // A toggle while it is still loading stops it too.
    toggle();
    expect(audio.state).toBe('loading');
    toggle();
    expectReleased(mockPlayers[1]);
    expect(audio.state).toBe('idle');
    view.unmount();
  });

  it('returns to idle when the word finishes, and plays again with a new player', () => {
    const view = render(URL_A);
    toggle();
    act(() => last().emit({playing: true}));
    act(() => last().emit({didJustFinish: true}));
    expect(audio.state).toBe('idle');
    toggle();
    expect(mockPlayers).toHaveLength(2);
    expectReleased(mockPlayers[0]);
    expect(mockPlayers[1].play).toHaveBeenCalledTimes(1);
    expect(audio.state).toBe('loading');
    view.unmount();
  });

  it('returns to idle when playback stops after it started', () => {
    const view = render(URL_A);
    toggle();
    act(() => last().emit({playing: true}));
    act(() => last().emit({playing: false}));
    expect(audio.state).toBe('idle');
    view.unmount();
  });

  it('a url change stops and releases the player; the new word is idle', () => {
    const view = render(URL_A);
    toggle();
    const first = last();
    act(() => first.emit({playing: true}));
    view.update(URL_B);
    expectReleased(first);
    expect(audio.state).toBe('idle');
    // Late updates of the released player change nothing.
    act(() => first.emit({playing: true}));
    expect(audio.state).toBe('idle');
    // Back on the first word: idle, not its old state.
    view.update(URL_A);
    expect(audio.state).toBe('idle');
    view.unmount();
  });

  it('unmount stops and releases the player', () => {
    const view = render(URL_A);
    toggle();
    act(() => last().emit({playing: true}));
    view.unmount();
    expectReleased(mockPlayers[0]);
  });

  it('gives error when the player cannot be created, and toggle tries again', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => null);
    const view = render(URL_A);
    mockCreate.error = new Error('no player');
    toggle();
    expect(audio.state).toBe('error');
    mockCreate.error = null;
    toggle();
    expect(mockPlayers).toHaveLength(1);
    expect(audio.state).toBe('loading');
    view.unmount();
    warn.mockRestore();
  });

  it('gives error when the player reports a playback error', () => {
    const view = render(URL_A);
    toggle();
    act(() => last().emit({error: 'The operation could not be completed'}));
    expect(audio.state).toBe('error');
    toggle();
    expectReleased(mockPlayers[0]);
    expect(mockPlayers).toHaveLength(2);
    view.unmount();
  });

  it('does nothing without a url', () => {
    const view = render(null);
    toggle();
    expect(createAudioPlayer).not.toHaveBeenCalled();
    expect(audio.state).toBe('idle');
    view.unmount();
  });
});
