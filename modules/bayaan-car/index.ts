import {requireOptionalNativeModule} from 'expo';
import type {EventSubscription} from 'expo-modules-core';
import type {
  CarNowPlaying,
  CarPlayRequest,
  CarTransport,
} from '@/services/car/types';
import {parseCarPlayRequest, parseCarTransport} from '@/services/car/parse';

interface NativeEvents {
  onPlayRequest: (event: {json: string}) => void;
  onTransport: (event: {json: string}) => void;
  onCarConnectionChanged: (event: {connected: boolean}) => void;
}

// Every member is optional: a dev build may contain the Task 1 module
// without these functions yet, so each call is guarded at runtime.
interface BayaanCarNative {
  writeSnapshot?: (json: string) => void;
  setNowPlaying?: (json: string | null) => void;
  markJsReady?: () => void;
  addListener?: <K extends keyof NativeEvents>(
    name: K,
    fn: NativeEvents[K],
  ) => EventSubscription;
}

const native = requireOptionalNativeModule<BayaanCarNative>('BayaanCar');

export interface BayaanCarApi {
  isAvailable: boolean;
  writeSnapshot(json: string): void;
  setNowPlaying(info: CarNowPlaying | null): void;
  markJsReady(): void;
  addPlayRequestListener(fn: (request: CarPlayRequest) => void): () => void;
  addTransportListener(fn: (transport: CarTransport) => void): () => void;
  addConnectionListener(fn: (connected: boolean) => void): () => void;
}

function noop(): void {}

function subscribe<K extends keyof NativeEvents>(
  name: K,
  fn: NativeEvents[K],
): () => void {
  if (typeof native?.addListener !== 'function') return noop;
  const sub = native.addListener(name, fn);
  return () => sub.remove();
}

export const BayaanCar: BayaanCarApi = {
  isAvailable:
    native !== null &&
    typeof native.writeSnapshot === 'function' &&
    typeof native.addListener === 'function',
  writeSnapshot(json: string): void {
    if (typeof native?.writeSnapshot !== 'function') return;
    native.writeSnapshot(json);
  },
  setNowPlaying(info: CarNowPlaying | null): void {
    if (typeof native?.setNowPlaying !== 'function') return;
    native.setNowPlaying(info ? JSON.stringify(info) : null);
  },
  markJsReady(): void {
    if (typeof native?.markJsReady !== 'function') return;
    native.markJsReady();
  },
  addPlayRequestListener(fn: (request: CarPlayRequest) => void): () => void {
    return subscribe('onPlayRequest', ({json}) => {
      const request = parseCarPlayRequest(json);
      if (request) fn(request);
    });
  },
  addTransportListener(fn: (transport: CarTransport) => void): () => void {
    return subscribe('onTransport', ({json}) => {
      const transport = parseCarTransport(json);
      if (transport) fn(transport);
    });
  },
  addConnectionListener(fn: (connected: boolean) => void): () => void {
    return subscribe('onCarConnectionChanged', ({connected}) => fn(connected));
  },
};
