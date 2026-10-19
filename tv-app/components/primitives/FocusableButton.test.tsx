import React from 'react';
import {Text} from 'react-native';
import {act, fireEvent, render, screen} from '@testing-library/react-native';
import {FocusableButton} from './FocusableButton';
import {takeLongPressOrigin} from '../../services/focusReturn';

describe('FocusableButton', () => {
  it('presses, and a disabled button reads as disabled', () => {
    const onPress = jest.fn();
    const {rerender} = render(
      <FocusableButton onPress={onPress} accessibilityLabel="Play">
        <Text>Play</Text>
      </FocusableButton>,
    );
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);

    rerender(
      <FocusableButton onPress={onPress} accessibilityLabel="Play" disabled>
        <Text>Play</Text>
      </FocusableButton>,
    );
    // fireEvent would reach the component's own onPress prop, so check the
    // host button: read out as disabled.
    expect(screen.getByRole('button', {disabled: true})).toBeTruthy();
  });

  it('a long-press notes itself as the place focus returns to', () => {
    takeLongPressOrigin();
    const onLongPress = jest.fn();
    render(
      <FocusableButton onPress={() => {}} onLongPress={onLongPress}>
        <Text>Al-Fatiha</Text>
      </FocusableButton>,
    );
    fireEvent(screen.getByRole('button'), 'longPress');
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(takeLongPressOrigin()).not.toBeNull();
  });

  it('tells its children when it has focus', () => {
    render(
      <FocusableButton onPress={() => {}}>
        {focused => <Text>{focused ? 'focused' : 'rest'}</Text>}
      </FocusableButton>,
    );
    expect(screen.getByText('rest')).toBeTruthy();
    act(() => {
      fireEvent(screen.getByRole('button'), 'focus');
    });
    expect(screen.getByText('focused')).toBeTruthy();
    act(() => {
      fireEvent(screen.getByRole('button'), 'blur');
    });
    expect(screen.getByText('rest')).toBeTruthy();
  });
});
