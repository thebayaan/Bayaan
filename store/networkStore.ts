import {create} from 'zustand';

interface NetworkState {
  isOnline: boolean;
  /**
   * On a network (Wi-Fi, cellular, ethernet) at all, whether or not NetInfo's
   * internet check got through. False in airplane mode or with no network.
   */
  isConnected: boolean;
  setOnline: (online: boolean) => void;
  setConnected: (connected: boolean) => void;
}

export const useNetworkStore = create<NetworkState>()(set => ({
  isOnline: true, // Assume online until first NetInfo event
  isConnected: true,
  setOnline: online => set({isOnline: online}),
  setConnected: connected => set({isConnected: connected}),
}));
