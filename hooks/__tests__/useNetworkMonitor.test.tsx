/**
 * useNetworkMonitor copies NetInfo's state into the network store. isOnline
 * also needs NetInfo's internet check to pass; isConnected only needs a
 * network. iOS downloads are refused up front only when isConnected is false.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {useNetworkStore} from '@/store/networkStore';
import {useNetworkMonitor} from '../useNetworkMonitor';

interface NetInfoChange {
  isConnected: boolean | null;
  isInternetReachable: boolean | null | undefined;
}

let mockListener: ((change: NetInfoChange) => void) | null = null;

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: (listener: (change: NetInfoChange) => void) => {
      mockListener = listener;
      return () => {
        mockListener = null;
      };
    },
  },
}));
jest.mock('@/services/dataService', () => ({
  getAllReciters: jest.fn(async () => []),
}));

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

function Monitor() {
  useNetworkMonitor();
  return null;
}

function receive(change: NetInfoChange) {
  act(() => {
    mockListener?.(change);
  });
}

let renderer: TestRenderer.ReactTestRenderer | null = null;

beforeEach(() => {
  act(() => {
    renderer = TestRenderer.create(<Monitor />);
  });
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe('useNetworkMonitor', () => {
  it('keeps the connection when only the internet check failed', () => {
    // On iOS the check asks a Google URL. A network that blocks it, or a
    // check that timed out, can still reach the audio server.
    useNetworkStore.setState({isOnline: false, isConnected: false});
    receive({isConnected: true, isInternetReachable: false});
    expect(useNetworkStore.getState()).toMatchObject({
      isOnline: false,
      isConnected: true,
    });
  });

  it('drops the connection with no network at all', () => {
    useNetworkStore.setState({isOnline: true, isConnected: true});
    receive({isConnected: false, isInternetReachable: false});
    expect(useNetworkStore.getState()).toMatchObject({
      isOnline: false,
      isConnected: false,
    });
  });

  it('does not take an unknown connection for no network', () => {
    useNetworkStore.setState({isOnline: false, isConnected: false});
    receive({isConnected: null, isInternetReachable: null});
    expect(useNetworkStore.getState().isConnected).toBe(true);
  });
});
