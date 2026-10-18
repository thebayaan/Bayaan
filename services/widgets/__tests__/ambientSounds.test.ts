import {WIDGET_AMBIENT_SOUNDS} from 'bayaan-widgets';
import {AMBIENT_SOUND_LIST} from '@/types/ambient';

it('widget ambient sounds match the app list', () => {
  expect([...WIDGET_AMBIENT_SOUNDS].sort()).toEqual(
    [...AMBIENT_SOUND_LIST].sort(),
  );
});
