import {useAmbientStore} from './ambientStore';
import {storage} from '../services/storage';

beforeEach(() => {
  storage.clearAll();
  useAmbientStore.getState().reset();
});

describe('ambientStore', () => {
  it('defaults to disabled rain at 0.5 volume', () => {
    expect(useAmbientStore.getState().enabled).toBe(false);
    expect(useAmbientStore.getState().currentSound).toBe('rain');
    expect(useAmbientStore.getState().volume).toBe(0.5);
  });

  it('setVolume clamps to [0,1]', () => {
    useAmbientStore.getState().setVolume(2);
    expect(useAmbientStore.getState().volume).toBe(1);
    useAmbientStore.getState().setVolume(-0.5);
    expect(useAmbientStore.getState().volume).toBe(0);
  });

  it('toggle flips enabled', () => {
    useAmbientStore.getState().toggle();
    expect(useAmbientStore.getState().enabled).toBe(true);
    useAmbientStore.getState().toggle();
    expect(useAmbientStore.getState().enabled).toBe(false);
  });

  it('setSound updates currentSound', () => {
    useAmbientStore.getState().setSound('forest');
    expect(useAmbientStore.getState().currentSound).toBe('forest');
  });
});
