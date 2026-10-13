import {
  decodeHtmlEntities,
  formattedTranslationMarkup,
  translationPlainText,
} from '../translationText';

describe('translationPlainText', () => {
  it('removes footnote markers with their digits, quoted or not', () => {
    expect(
      translationPlainText(
        'In the name of Allah,<sup foot_note="226402">1</sup> the Merciful.<sup foot_note=254011>2</sup>',
      ),
    ).toBe('In the name of Allah, the Merciful.');
  });

  it('removes wrapped markers and every other tag', () => {
    expect(
      translationPlainText(
        'l’Assoluto  <a class=f><sup foot_note=156219>1</sup></a> . <i class="s">Non</i> <span>Lo</span>',
      ),
    ).toBe('l’Assoluto . Non Lo');
  });

  it('decodes entities and keeps line breaks', () => {
    expect(
      translationPlainText('&quot;Be&quot; &amp; it is\nnext &#39;line&#x27;'),
    ).toBe('"Be" & it is\nnext \'line\'');
  });

  it('leaves plain text alone', () => {
    expect(translationPlainText('Say, He is Allah, the One.')).toBe(
      'Say, He is Allah, the One.',
    );
    expect(translationPlainText('')).toBe('');
  });
});

describe('formattedTranslationMarkup', () => {
  it('keeps the tags FormattedText draws and drops the rest', () => {
    expect(
      formattedTranslationMarkup(
        'a<a class=f><sup foot_note=7>1</sup></a> <i class="x">b</i> <span>c</span><br/><b>d</b>',
      ),
    ).toBe('a<sup foot_note=7>1</sup> <i>b</i> c<b>d</b>');
  });
});

describe('decodeHtmlEntities', () => {
  it('leaves unknown entities as they are', () => {
    expect(decodeHtmlEntities('&unknown; &lt;')).toBe('&unknown; <');
  });
});
