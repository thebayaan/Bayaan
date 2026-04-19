import {useNavStore} from './navStore';

beforeEach(() => {
  useNavStore.getState().reset();
});

describe('navStore', () => {
  it('defaults to home tab', () => {
    expect(useNavStore.getState().currentTab).toBe('home');
    expect(useNavStore.getState().stack).toEqual([]);
  });

  it('switchTab changes tab and clears stack', () => {
    useNavStore.getState().push({screen: 'reciterDetail', reciterId: 'r1'});
    useNavStore.getState().switchTab('search');
    expect(useNavStore.getState().currentTab).toBe('search');
    expect(useNavStore.getState().stack).toEqual([]);
  });

  it('push adds to stack', () => {
    useNavStore.getState().push({screen: 'nowPlaying'});
    expect(useNavStore.getState().stack).toHaveLength(1);
  });

  it('pop removes top of stack', () => {
    useNavStore.getState().push({screen: 'reciterDetail', reciterId: 'r1'});
    useNavStore.getState().push({screen: 'nowPlaying'});
    useNavStore.getState().pop();
    expect(useNavStore.getState().stack).toHaveLength(1);
    expect(useNavStore.getState().stack[0].screen).toBe('reciterDetail');
  });

  it('pop on empty stack is a no-op', () => {
    useNavStore.getState().pop();
    expect(useNavStore.getState().stack).toEqual([]);
  });
});
