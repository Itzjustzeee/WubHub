import { registerPlugin } from '@capacitor/core';
import type {
  NativeBackgroundLivePlugin,
  NativeOrientationPlugin,
  NativePlatformPlugin,
  NativeUrlPlugin,
  NativeVodPlugin,
} from '../types';

export const NativeVod = registerPlugin<NativeVodPlugin>('NativeVod');
export const NativeOrientation = registerPlugin<NativeOrientationPlugin>('NativeOrientation');
export const NativeBackgroundLive = registerPlugin<NativeBackgroundLivePlugin>('NativeBackgroundLive');
export const NativeExternal = registerPlugin<NativeUrlPlugin>('NativeExternal');
export const NativeChatAuth = registerPlugin<NativeUrlPlugin>('NativeChatAuth');
export const NativePlatform = registerPlugin<NativePlatformPlugin>('NativePlatform');
