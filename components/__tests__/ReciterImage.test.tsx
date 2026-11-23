// @ai-generated
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';

type ImageProps = {source: unknown; onError?: () => void};
const mockImage: {props: ImageProps | null} = {props: null};
jest.mock('expo-image', () => ({
  Image: (props: ImageProps) => {
    mockImage.props = props;
    return null;
  },
}));
jest.mock('@/components/Icons', () => ({ProfileIcon: () => 'profile-icon'}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {colors: {border: '#dddddd', card: '#ffffff', light: '#eeeeee'}},
  }),
}));
// Bundled photos are keyed by the reciter's catalogue (Latin) name.
jest.mock('@/utils/reciterImages', () => ({
  reciterImages: {'abdulbasit-abdulsamad': 42},
}));

import {ReciterImage} from '../ReciterImage';

function render(props: {imageUrl?: string; reciterName: string}) {
  mockImage.props = null;
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<ReciterImage {...props} />);
  });
  return renderer;
}

it('shows the bundled photo for the catalogue name', () => {
  render({reciterName: 'Abdulbasit Abdulsamad'});
  expect(mockImage.props!.source).toBe(42);
});

// Why callers must pass the catalogue name, not the name they display.
it('finds no bundled photo for an Arabic name', () => {
  const renderer = render({reciterName: 'عبد الباسط عبد الصمد'});
  expect(mockImage.props).toBeNull();
  expect(JSON.stringify(renderer.toJSON())).toContain('profile-icon');
});

it('prefers the catalogue photo URL', () => {
  render({
    imageUrl: 'https://cdn.example/abdulbasit.jpg',
    reciterName: 'Abdulbasit Abdulsamad',
  });
  expect(mockImage.props!.source).toEqual({
    uri: 'https://cdn.example/abdulbasit.jpg',
  });
});

it('falls back to the bundled photo when the URL cannot be loaded', () => {
  render({
    imageUrl: 'https://cdn.example/abdulbasit.jpg',
    reciterName: 'Abdulbasit Abdulsamad',
  });
  act(() => {
    mockImage.props!.onError!();
  });
  expect(mockImage.props!.source).toBe(42);
});

it('falls back to the icon when there is no bundled photo either', () => {
  const renderer = render({
    imageUrl: 'https://cdn.example/unknown.jpg',
    reciterName: 'Someone New',
  });
  act(() => {
    mockImage.props!.onError!();
  });
  expect(JSON.stringify(renderer.toJSON())).toContain('profile-icon');
});

it('tries a new URL after another one failed', () => {
  const renderer = render({
    imageUrl: 'https://cdn.example/a.jpg',
    reciterName: 'Someone New',
  });
  act(() => {
    mockImage.props!.onError!();
  });
  act(() => {
    renderer.update(
      <ReciterImage
        imageUrl="https://cdn.example/b.jpg"
        reciterName="Someone New"
      />,
    );
  });
  expect(mockImage.props!.source).toEqual({uri: 'https://cdn.example/b.jpg'});
});
