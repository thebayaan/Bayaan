import {audioFileUrl} from '../audioFileUrl';

const SERVER =
  'https://cdn.thebayaan.com/quran/recitations/x/hafs/murattal/default';

describe('audioFileUrl', () => {
  it('pads the surah number and leaves unversioned rewayat unchanged', () => {
    expect(audioFileUrl({id: 'some-rewayat', server: SERVER}, 2)).toBe(
      `${SERVER}/002.mp3`,
    );
    expect(audioFileUrl({id: 'some-rewayat', server: SERVER}, '114')).toBe(
      `${SERVER}/114.mp3`,
    );
  });

  it('appends the version for a rewayat whose files were replaced', () => {
    expect(
      audioFileUrl(
        {id: '65962996-0864-4ef9-9001-932fdc87c8f8', server: SERVER},
        24,
      ),
    ).toBe(`${SERVER}/024.mp3?v=2`);
  });
});
