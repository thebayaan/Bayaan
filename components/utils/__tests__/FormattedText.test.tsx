import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import FormattedTextRenderer, {footnoteIdFromTag} from '../FormattedText';

function render(text: string, onFootnotePress: jest.Mock) {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(
      <FormattedTextRenderer
        text={text}
        baseStyle={{fontSize: 16}}
        onFootnotePress={onFootnotePress}
      />,
    );
  });
  if (!renderer) throw new Error('not rendered');
  return renderer;
}

function pressMarker(renderer: TestRenderer.ReactTestRenderer): void {
  const marker = renderer.root.find(
    node => node.props.accessibilityRole === 'button',
  );
  act(() => marker.props.onPress());
}

describe('footnoteIdFromTag', () => {
  it('reads quoted and unquoted ids', () => {
    expect(footnoteIdFromTag('<sup foot_note="226402">')).toBe('226402');
    expect(footnoteIdFromTag('<sup foot_note=254011>')).toBe('254011');
    expect(footnoteIdFromTag('<sup>')).toBe('');
  });
});

describe('FormattedTextRenderer footnotes', () => {
  it('passes a quoted id (bundled Saheeh) to the press handler', () => {
    const onPress = jest.fn();
    const renderer = render(
      'In the name of Allāh,<sup foot_note="226402">1</sup> the Merciful',
      onPress,
    );
    pressMarker(renderer);
    expect(onPress).toHaveBeenCalledWith('226402', '1');
  });

  it('passes an unquoted id (QF) to the press handler', () => {
    const onPress = jest.fn();
    const renderer = render(
      'In the name of Allāh,<sup foot_note=254011>1</sup> the Merciful',
      onPress,
    );
    pressMarker(renderer);
    expect(onPress).toHaveBeenCalledWith('254011', '1');
  });
});
