import * as Crypto from 'expo-crypto';
import {createMMKV} from 'react-native-mmkv';

const mmkv = createMMKV({id: 'analytics'});
const DEVICE_ID_KEY = 'device_id';

export function getOrCreateDeviceId(): string {
  const existing = mmkv.getString(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }
  const id = Crypto.randomUUID();
  mmkv.set(DEVICE_ID_KEY, id);
  return id;
}
