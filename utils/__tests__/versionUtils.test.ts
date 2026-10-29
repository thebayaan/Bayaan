import {filterPagesByVersion} from '../versionUtils';

const pages = [
  {id: 'core', minVersion: '2.0'},
  {id: 'older-release', minVersion: '2.1'},
  {id: 'release-announcement', minVersion: '2.3', updateOnly: true},
];

const ids = (list: {id: string}[]) => list.map(page => page.id);

describe('filterPagesByVersion', () => {
  it('leaves update-only announcements out of the first-launch tour', () => {
    expect(ids(filterPagesByVersion(pages, null))).toEqual([
      'core',
      'older-release',
    ]);
  });

  it('shows every page newer than the version last seen', () => {
    expect(ids(filterPagesByVersion(pages, '2.2.1'))).toEqual([
      'release-announcement',
    ]);
    expect(ids(filterPagesByVersion(pages, '2.0.1'))).toEqual([
      'older-release',
      'release-announcement',
    ]);
  });

  it('shows nothing once the newest pages have been seen', () => {
    expect(filterPagesByVersion(pages, '2.3.0')).toEqual([]);
  });
});
