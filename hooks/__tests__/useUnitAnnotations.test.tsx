// @ai-generated
/**
 * useUnitAnnotations(rewayah): the store's bookmarks, notes and highlights as
 * verse keys of the shown rewayah (fixture slots of the Release 1 data).
 * Nothing is marked while the rewayah's verses are not ready; the result
 * follows store changes; Hafs marks are the Hafs keys of the rows.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import type {UnitAnnotations} from '@/services/verse-annotations/unitAnnotations';

let mockReady = true;

jest.mock('@/hooks/useRewayahVerseUnits', () => ({
  useRewayahVerseUnits: (rewayah: RewayahId | null) => {
    if (!rewayah || !mockReady) return {units: null, status: 'loading'};
    const {
      fixtureUnits,
    } = require('@/services/verse-annotations/__fixtures__/verseUnitsTestData');
    return {units: fixtureUnits(rewayah), status: 'ready'};
  },
}));

jest.mock('@/services/verse-annotations/VerseAnnotationService', () => ({
  verseAnnotationService: {},
}));

import {useUnitAnnotations} from '../useUnitAnnotations';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

let latest: UnitAnnotations | null = null;

function Probe({rewayah}: {rewayah: RewayahId}) {
  latest = useUnitAnnotations(rewayah);
  return null;
}

const mounted: TestRenderer.ReactTestRenderer[] = [];

function mount(rewayah: RewayahId) {
  act(() => {
    mounted.push(TestRenderer.create(<Probe rewayah={rewayah} />));
  });
}

afterEach(() => {
  act(() => {
    for (const renderer of mounted.splice(0)) renderer.unmount();
  });
});

beforeEach(() => {
  mockReady = true;
  latest = null;
  useVerseAnnotationsStore.setState({
    bookmarkedVerseKeys: new Set<string>(),
    notedVerseKeys: new Set<string>(),
    highlights: {},
    bookmarkRows: {},
    noteRows: {},
    highlightRows: {},
  });
});

it('marks the verses of the shown rewayah and follows the store', () => {
  mount('warsh');
  expect(latest?.rewayah).toBe('warsh');
  expect(latest?.bookmarkedUnitKeys.size).toBe(0);
  act(() => {
    useVerseAnnotationsStore.getState().addBookmark('1:7:5', 'warsh');
    useVerseAnnotationsStore.getState().setHighlight('1:7', 'green', 'hafs');
  });
  expect([...(latest?.bookmarkedUnitKeys ?? [])]).toEqual(['1:7']);
  expect(latest?.highlightColors).toEqual({'1:6': 'green', '1:7': 'green'});
});

it('Hafs: the Hafs keys of the rows', () => {
  act(() => {
    useVerseAnnotationsStore.getState().addBookmark('103:2', 'hafs');
    useVerseAnnotationsStore.getState().addNote('1:7', 'hafs');
  });
  mount('hafs');
  expect([...(latest?.bookmarkedUnitKeys ?? [])]).toEqual(['103:2']);
  expect([...(latest?.notedUnitKeys ?? [])]).toEqual(['1:7']);
});

it('marks nothing while the verses are not ready', () => {
  mockReady = false;
  act(() => {
    useVerseAnnotationsStore.getState().addBookmark('1:7:5', 'warsh');
  });
  mount('warsh');
  expect(latest).toBeNull();
});
