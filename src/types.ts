import type { ComponentType } from 'react';

export type StreamId = 'kick' | 'twitch';
export type ViewName = 'home' | 'stream' | 'vods';
export type StreamFullscreenMode = 'none' | 'native' | 'overlay';
export type NotificationTab = 'notifications' | 'settings';
export type LiveStatusMap = Record<StreamId, boolean>;

export type LinkKey =
  | 'kick'
  | 'kickEmbed'
  | 'kickChatSignIn'
  | 'twitch'
  | 'twitchChatSignIn'
  | 'patreon'
  | 'shop'
  | 'subreddit'
  | 'discord'
  | 'x'
  | 'copSlop'
  | 'regardedArt'
  | 'vodArchive'
  | 'tts'
  | 'highlights'
  | 'clips'
  | 'magicMonday';

export type IconComponent = ComponentType<{
  size?: number;
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}>;

export type LiveDetails = {
  title: string;
  category: string;
  viewers: number | null;
};

export type LiveStatusDetails = LiveDetails & {
  isLive: boolean;
};

export type LiveDetailsMap = Record<StreamId, LiveDetails>;
export type NotificationPrefs = LiveStatusMap;

export type WubHubNotification = {
  id: string;
  streamId: StreamId;
  title: string;
  message: string;
  createdAt: number;
};

export type HlsLevel = {
  height?: number;
  bitrate?: number;
};

export type MediaPlayer = {
  id: StreamId;
  name: string;
  src: string;
  fullscreenSrc: string;
  accent: string;
  logo: string;
  className: StreamId;
};

export type HlsVideoProps = {
  src: string;
  title: string;
  autoPlay?: boolean;
  maxHeight?: number;
  onPlaybackError?: () => void;
};

export type KickPlaybackStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export type KickPlayerProps = {
  playbackUrl: string;
  status: KickPlaybackStatus;
  isLive: boolean;
  liveStatusKnown?: boolean;
  allowIframeFallback?: boolean;
  maxHeight?: number;
};

export type SupportCardClassName =
  | 'patreon'
  | 'shop'
  | 'vods'
  | 'discord'
  | 'reddit'
  | 'x-social'
  | 'cop-slop'
  | 'regarded-art';

export type SupportCard = {
  name: string;
  url: string;
  view?: 'vods';
  label: string;
  detail: string;
  icon: IconComponent;
  image?: string;
  className: SupportCardClassName;
};

export type YoutubeCardClassName = 'highlights' | 'clips' | 'magic';

export type YoutubeChannel = {
  name: string;
  channelId: string;
  url: string;
  detail: string;
  image: string;
  banner: string;
  className: YoutubeCardClassName;
};

export type LatestYoutubeVideo = {
  channelName: string;
  title: string;
  url: string;
  image: string;
  channelImage: string;
  className: YoutubeCardClassName;
};

export type HeroSlide = {
  type: 'store' | 'youtube';
  eyebrow: string;
  title: string;
  detail: string;
  url: string;
  image: string;
  className: 'store' | YoutubeCardClassName;
  channelImage?: string;
};

export type MobileMoreAction = {
  id: 'settings' | 'about' | 'contact';
  label: string;
  icon: IconComponent;
};

export type NavItem =
  | { type: 'button'; id: 'home'; label: string; icon: IconComponent }
  | { type: 'stream'; id: StreamId; label: string; icon: IconComponent }
  | { type: 'vods'; id: 'vodArchive'; label: string; icon: IconComponent }
  | { type: 'link'; id: string; label: string; icon: IconComponent; href: string };

export type NavGroup = {
  label: 'Watch' | 'YouTube' | 'Community' | 'Merch';
  items: NavItem[];
};

export type JsonRecord = Record<string, unknown>;

export type TwitchGraphqlResponse = {
  data?: {
    user?: {
      stream?: {
        title?: unknown;
        viewersCount?: unknown;
        game?: {
          name?: unknown;
        } | null;
      } | null;
    } | null;
  };
};

export type NativeVodPlugin = {
  open(options: { url: string }): Promise<{ target?: ViewName | StreamId | 'more' }>;
};

export type NativeOrientationPlugin = {
  enterFullscreen(): Promise<void>;
  exitFullscreen(): Promise<void>;
  lockLandscape(): Promise<void>;
  lockPortrait(): Promise<void>;
};

export type NativeBackgroundLivePlugin = {
  configure(options: LiveStatusMap): Promise<void>;
};

export type NativeUrlPlugin = {
  open(options: { url: string }): Promise<void>;
};

export type NativePlatformPlugin = {
  getInfo(): Promise<{ isTelevision?: boolean }>;
};

declare global {
  interface Document {
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => Promise<void>;
    msExitFullscreen?: () => Promise<void>;
  }

  interface HTMLElement {
    webkitRequestFullscreen?: () => Promise<void>;
    msRequestFullscreen?: () => Promise<void>;
  }
}
