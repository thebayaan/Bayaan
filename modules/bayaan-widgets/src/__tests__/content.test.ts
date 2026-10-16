import content from '../__fixtures__/content.full.json';
import {isWidgetContent, WIDGET_CONTENT_VERSION} from '../content';

describe('isWidgetContent', () => {
  it('accepts the shared fixture', () => {
    expect(isWidgetContent(content)).toBe(true);
  });

  it('accepts no sleep timer', () => {
    expect(isWidgetContent({...content, sleepTimerEndsAt: null})).toBe(true);
  });

  it('rejects a future version', () => {
    expect(
      isWidgetContent({...content, version: WIDGET_CONTENT_VERSION + 1}),
    ).toBe(false);
  });

  it('rejects malformed entries', () => {
    expect(isWidgetContent({...content, downloads: [{surahId: '67'}]})).toBe(
      false,
    );
    expect(
      isWidgetContent({
        ...content,
        playlists: [{id: 'p', name: 'n', itemCount: 1, items: [{}]}],
      }),
    ).toBe(false);
    expect(
      isWidgetContent({
        ...content,
        spotlight: [{id: 'r', name: 'n', artworkFile: 'f', surahIds: ['1']}],
      }),
    ).toBe(false);
    expect(isWidgetContent({...content, sleepTimerEndsAt: 'soon'})).toBe(false);
    expect(isWidgetContent(null)).toBe(false);
  });
});
