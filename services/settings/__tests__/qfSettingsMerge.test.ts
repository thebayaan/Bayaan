import {applySettingsChanges, settingsChanges} from '../qfSettingsMerge';

describe('settings field intent', () => {
  test('merges nested leaf changes and removals without replacing remote siblings', () => {
    const baseline = {map: {hafs: 'old', warsh: 'same'}, list: ['one']};
    const local = {map: {hafs: 'new'}, list: ['one', 'two']};
    const remote = {
      map: {hafs: 'old', warsh: 'other-device', future: 'unknown'},
      list: ['other-device'],
      unknown: {nested: true},
    };
    expect(applySettingsChanges(remote, settingsChanges(baseline, local))).toEqual({
      map: {hafs: 'new', future: 'unknown'},
      list: ['one', 'two'],
      unknown: {nested: true},
    });
    expect(remote.map.warsh).toBe('other-device');
  });

  test('recognizes a local reversion and ignores object key order', () => {
    expect(settingsChanges({showWBW: false}, {showWBW: false})).toEqual([]);
    expect(settingsChanges({map: {a: 1, b: 2}}, {map: {b: 2, a: 1}})).toEqual([]);
  });

  test('never traverses prototypes when applying persisted changes', () => {
    expect(applySettingsChanges({}, [{path: ['__proto__', 'polluted'], value: true}])).toEqual({});
    expect({}).not.toHaveProperty('polluted');
  });
});
