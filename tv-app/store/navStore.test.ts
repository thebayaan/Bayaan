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

  it('pushing the screen already on top is a no-op', () => {
    useNavStore.getState().push({screen: 'reciterDetail', reciterId: 'r1'});
    useNavStore.getState().push({screen: 'nowPlaying'});
    useNavStore.getState().push({screen: 'nowPlaying'});
    expect(useNavStore.getState().stack).toEqual([
      {screen: 'reciterDetail', reciterId: 'r1'},
      {screen: 'nowPlaying'},
    ]);
  });

  it('pushing the player while it is deeper pops back to it', () => {
    const {push} = useNavStore.getState();
    push({screen: 'nowPlaying'});
    push({screen: 'reciterDetail', reciterId: 'r1'});
    push({screen: 'playlist', playlistId: 'p1'});
    push({screen: 'nowPlaying'});
    expect(useNavStore.getState().stack).toEqual([{screen: 'nowPlaying'}]);
  });

  it('a different entry of the same screen still stacks', () => {
    const {push} = useNavStore.getState();
    push({screen: 'reciterDetail', reciterId: 'r1'});
    push({screen: 'reciterDetail', reciterId: 'r2'});
    expect(useNavStore.getState().stack).toHaveLength(2);
  });
});
