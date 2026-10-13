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

// QF text carries tags this renderer does not draw and HTML entities.
describe('FormattedTextRenderer QF markup', () => {
  // The rendered strings, in order (host nodes only).
  function plainText(renderer: TestRenderer.ReactTestRenderer): string {
    function collect(
      node: ReturnType<TestRenderer.ReactTestRenderer['toJSON']>,
    ): string {
      if (node === null) return '';
      if (Array.isArray(node)) return node.map(collect).join('');
      return (node.children ?? [])
        .map(child => (typeof child === 'string' ? child : collect(child)))
        .join('');
    }
    return collect(renderer.toJSON());
  }

  it('drops <a class=f> and <span> wrappers but keeps the tappable footnote', () => {
    const onPress = jest.fn();
    const renderer = render(
      'l’Assoluto <a class=f><sup foot_note=156219>1</sup></a>. <span class="h">Non</span> &quot;x&quot;',
      onPress,
    );
    const text = plainText(renderer);
    expect(text).not.toMatch(/<|>|&quot;/);
    expect(text).toContain('"x"');
    expect(text).toContain('Non');
    pressMarker(renderer);
    expect(onPress).toHaveBeenCalledWith('156219', '1');
  });

  it('renders <i class=...> as italic text, not as a literal tag', () => {
    const renderer = render('a <i class="s">word</i> b', jest.fn());
    expect(plainText(renderer)).toBe('a word b');
  });
});
