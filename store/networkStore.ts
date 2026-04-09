import {create} from 'zustand';

interface NetworkState {
  isOnline: boolean;
  setOnline: (online: boolean) => void;
}

export const useNetworkStore = create<NetworkState>()(set => ({
  isOnline: true, // Assume online until first NetInfo event
  setOnline: online => set({isOnline: online}),
}));
