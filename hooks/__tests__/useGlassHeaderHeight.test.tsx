// @ai-generated
import React from 'react';
import {act, create} from 'react-test-renderer';
import {HeaderHeightContext} from 'expo-router/react-navigation';
import {useGlassHeaderHeight} from '@/hooks/useGlassHeaderHeight';

function Probe({
  enabled,
  onValue,
}: {
  enabled: boolean;
  onValue: (height: number) => void;
}): null {
  onValue(useGlassHeaderHeight(enabled));
  return null;
}

it('returns the header height when enabled', () => {
  const values: number[] = [];
  act(() => {
    create(
      <HeaderHeightContext.Provider value={97}>
        <Probe enabled onValue={v => values.push(v)} />
      </HeaderHeightContext.Provider>,
    );
  });
  expect(values.at(-1)).toBe(97);
});

it('returns 0 when disabled, even inside a header', () => {
  const values: number[] = [];
  act(() => {
    create(
      <HeaderHeightContext.Provider value={97}>
        <Probe enabled={false} onValue={v => values.push(v)} />
      </HeaderHeightContext.Provider>,
    );
  });
  expect(values.at(-1)).toBe(0);
});

it('returns 0 instead of throwing outside a navigator with a header', () => {
  const values: number[] = [];
  act(() => {
    create(<Probe enabled onValue={v => values.push(v)} />);
  });
  expect(values.at(-1)).toBe(0);
});
