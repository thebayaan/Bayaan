// @ai-generated
import React from 'react';
import {act, create} from 'react-test-renderer';
import {usePlayerA11y, type PlayerA11y} from '@/hooks/usePlayerA11y';

function renderA11y(): PlayerA11y {
  let result!: PlayerA11y;
  function Probe(): null {
    result = usePlayerA11y();
    return null;
  }
  act(() => {
    create(<Probe />);
  });
  return result;
}

describe('usePlayerA11y', () => {
  const a11y = renderA11y();

  it('labels every control as a button with English text', () => {
    const controls = [
      a11y.playPause(false),
      a11y.previous(),
      a11y.next(),
      a11y.skipBack(15),
      a11y.skipForward(15),
      a11y.love(false),
      a11y.displayOptions,
      a11y.speed(1),
      a11y.repeat('none'),
      a11y.sleepTimer(false),
      a11y.ambient(false),
      a11y.followAlong(false),
      a11y.queue(false),
      a11y.moreOptions,
      a11y.closePlayer,
      a11y.openFullProfile,
    ];
    for (const props of controls) {
      expect(props.accessibilityRole).toBe('button');
      expect(props.accessibilityLabel).toBeTruthy();
      // A missing key would come back as the raw key path.
      expect(props.accessibilityLabel).not.toMatch(/a11y\./);
    }
  });

  it('announces play or pause from the playing state', () => {
    expect(a11y.playPause(false).accessibilityLabel).toBe('Play');
    expect(a11y.playPause(true).accessibilityLabel).toBe('Pause');
    expect(a11y.playPause(true, true).accessibilityState).toEqual({
      disabled: true,
    });
  });

  it('includes the seek interval', () => {
    expect(a11y.skipBack(15).accessibilityLabel).toBe('Back 15 seconds');
    expect(a11y.skipForward(15).accessibilityLabel).toBe('Forward 15 seconds');
  });

  it('reports toggle and value state', () => {
    expect(a11y.love(true).accessibilityState).toEqual({selected: true});
    expect(a11y.queue(true).accessibilityState).toEqual({selected: true});
    expect(a11y.speed(1.5).accessibilityValue).toEqual({text: '1.5x'});
    expect(a11y.repeat('none').accessibilityValue).toEqual({text: 'Off'});
    expect(a11y.repeat('queue').accessibilityValue).toEqual({text: 'All'});
    expect(a11y.repeat('track').accessibilityValue).toEqual({text: 'One'});
  });

  it('describes the now-playing row and where it leads', () => {
    expect(a11y.nowPlaying('Al-Mulk', 'Reciter')).toEqual({
      accessibilityRole: 'button',
      accessibilityLabel: 'Al-Mulk, Reciter',
      accessibilityHint: "Opens the reciter's profile",
    });
    expect(a11y.openPlayer('Al-Mulk', 'Reciter').accessibilityHint).toBe(
      'Opens the full player',
    );
  });
});
