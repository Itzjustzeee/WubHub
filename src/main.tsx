import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import type { HttpResponse, HttpResponseType, PluginListenerHandle } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import Hls from 'hls.js';
import type {
  Loader,
  LoaderCallbacks,
  LoaderConfiguration,
  LoaderContext,
  LoaderResponse,
  LoaderStats,
} from 'hls.js';
import {
  Bell,
  BellRing,
  ChevronRight,
  Ellipsis,
  ExternalLink,
  HeartHandshake,
  Home,
  Info,
  Maximize2,
  MessageCircle,
  Radio,
  ShoppingBag,
  Settings,
  Trash2,
  Tv,
  Users,
  Video,
  X,
} from 'lucide-react';
import {
  getKickLiveStatus,
  getKickPlaybackExpiryMs,
  getKickPlaybackUrl,
  getPlayableKickPlaybackUrl,
} from './api/kick';
import { formatViewerCount } from './api/shared';
import { getTwitchLiveStatus } from './api/twitch';
import { getLatestYoutubeVideo } from './api/youtube';
import type {
  HeroSlide,
  HlsLevel,
  HlsVideoProps,
  KickPlayerProps,
  KickPlaybackStatus,
  LatestYoutubeVideo,
  LinkKey,
  LiveDetailsMap,
  LiveStatusDetails,
  LiveStatusMap,
  MediaPlayer,
  MobileMoreAction,
  NativeBackgroundLivePlugin,
  NativeOrientationPlugin,
  NativePlatformPlugin,
  NativeUrlPlugin,
  NativeVodPlugin,
  NavGroup,
  NavItem,
  NotificationPrefs,
  NotificationTab,
  StreamFullscreenMode,
  StreamId,
  SupportCard,
  ViewName,
  WubHubNotification,
  YoutubeChannel,
} from './types';
import './styles.css';

const NativeVod = registerPlugin<NativeVodPlugin>('NativeVod');
const NativeOrientation = registerPlugin<NativeOrientationPlugin>('NativeOrientation');
const NativeBackgroundLive = registerPlugin<NativeBackgroundLivePlugin>('NativeBackgroundLive');
const NativeExternal = registerPlugin<NativeUrlPlugin>('NativeExternal');
const NativeChatAuth = registerPlugin<NativeUrlPlugin>('NativeChatAuth');
const NativePlatform = registerPlugin<NativePlatformPlugin>('NativePlatform');

const links: Record<LinkKey, string> = {
  kick: 'https://kick.com/paymoneywubby?theater=true',
  kickEmbed: 'https://player.kick.com/paymoneywubby?autoplay=false&muted=false&allowfullscreen=true',
  kickChatSignIn: 'https://kick.com/paymoneywubby/chat',
  twitch: 'https://www.twitch.tv/paymoneywubby',
  twitchChatSignIn: 'https://www.twitch.tv/popout/paymoneywubby/chat?popout=',
  patreon: 'https://www.patreon.com/cw/TheGreenRoom',
  shop: 'https://pmw.store/',
  subreddit: 'https://www.reddit.com/r/PaymoneyWubby/',
  discord: 'https://discord.com/invite/wubby',
  x: 'https://x.com/PaymoneyWubby?lang=en',
  copSlop: 'https://cop-slop.wubby.live/',
  regardedArt: 'https://regarded.art/',
  vodArchive: 'https://parasoci.al/vods',
  tts: 'https://tangia.co/paymoneywubby',
  highlights: 'https://www.youtube.com/@PaymoneyWubbyHighlights',
  clips: 'https://www.youtube.com/@WubClips',
  magicMonday: 'https://www.youtube.com/@WubbyMagicMonday',
};

const twitchParent = window.location.hostname || 'localhost';
const streamChats: Record<StreamId, string> = {
  kick: 'https://chat.kick.cx/embed/paymoneywubby',
  twitch: `https://www.twitch.tv/embed/paymoneywubby/chat?parent=${encodeURIComponent(twitchParent)}&darkpopout`,
};

const mediaPlayers: MediaPlayer[] = [
  {
    id: 'kick',
    name: 'Kick',
    src: links.kick,
    fullscreenSrc: links.kick,
    accent: 'Kick live stream',
    logo: '/assets/Kick_logo.svg.webp',
    className: 'kick',
  },
  {
    id: 'twitch',
    name: 'Twitch',
    src: `https://player.twitch.tv/?channel=paymoneywubby&parent=${twitchParent}&autoplay=true&muted=false`,
    fullscreenSrc: `https://player.twitch.tv/?channel=paymoneywubby&parent=${twitchParent}&autoplay=true&muted=false`,
    accent: 'Twitch live stream',
    logo: '/assets/Twitch-logo.png',
    className: 'twitch',
  },
];

const initialLiveStatus = mediaPlayers.reduce<LiveStatusMap>(
  (status, player) => ({ ...status, [player.id]: false }),
  { kick: false, twitch: false },
);
const initialLiveDetails = mediaPlayers.reduce<LiveDetailsMap>(
  (details, player) => ({ ...details, [player.id]: { title: '', category: '', viewers: null } }),
  {
    kick: { title: '', category: '', viewers: null },
    twitch: { title: '', category: '', viewers: null },
  },
);

function YoutubeIcon({ size = 24, ...props }: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      {...props}
    >
      <path d="M2.5 8.5c0-2.2 1.8-4 4-4h11c2.2 0 4 1.8 4 4v7c0 2.2-1.8 4-4 4h-11c-2.2 0-4-1.8-4-4z" />
      <path d="m10 8.5 6 3.5-6 3.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

const notificationStorageKey = 'wubhub-notifications';
const notificationPrefsStorageKey = 'wubhub-notification-prefs';
const defaultNotificationPrefs: NotificationPrefs = { kick: false, twitch: false };
const liveStatusTestMode = new URLSearchParams(window.location.search).has('testStreams');
const drawerAnimationMs = 260;
const testLiveDetails: Record<StreamId, LiveStatusDetails> = {
  kick: { isLive: true, title: 'Test Kick stream', category: 'Just Chatting', viewers: 12842 },
  twitch: { isLive: true, title: 'Test Twitch stream', category: 'Magic: The Gathering', viewers: 9317 },
};
const hlsBufferThresholds = {
  critical: 8,
  low: 16,
  healthy: 35,
  restoreCooldownMs: 18000,
};

function waitForRenderFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function withTwitchReloadToken(src: string, token: number) {
  if (!src || !src.includes('player.twitch.tv')) {
    return src;
  }

  const separator = src.includes('?') ? '&' : '?';
  return `${src}${separator}wubhub_reload=${token}`;
}

class NativeKickHlsLoader implements Loader<LoaderContext> {
  context: LoaderContext | null;
  stats: LoaderStats;
  cancelled: boolean;

  constructor(_config?: unknown) {
    this.context = null;
    this.stats = createHlsLoadStats();
    this.cancelled = false;
  }

  destroy() {
    this.abort();
  }

  abort() {
    this.cancelled = true;
    this.stats.aborted = true;
  }

  getCacheAge() {
    return 0;
  }

  getResponseHeader(_name: string) {
    return null;
  }

  load(context: LoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<LoaderContext>) {
    void this.loadWithCapacitor(context, config, callbacks);
  }

  private async loadWithCapacitor(
    context: LoaderContext,
    config: LoaderConfiguration,
    callbacks: LoaderCallbacks<LoaderContext>,
  ) {
    this.context = context;
    this.cancelled = false;
    this.stats = createHlsLoadStats();
    this.stats.loading.start = performance.now();

    const timeoutMs = config?.loadPolicy?.maxLoadTimeMs ?? config?.timeout ?? 20000;
    const responseType: HttpResponseType = context.responseType === 'arraybuffer' ? 'arraybuffer' : 'text';
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('Kick HLS request timed out')), timeoutMs);
    });

    try {
      const response = await Promise.race([
        CapacitorHttp.get({
          url: context.url,
          headers: {
            Origin: 'https://kick.com',
            Referer: 'https://kick.com/paymoneywubby',
            ...(context.headers ?? {}),
          },
          responseType,
          connectTimeout: 12000,
          readTimeout: 20000,
        }),
        timeout,
      ]) as HttpResponse;

      if (this.cancelled) {
        callbacks.onAbort?.(this.stats, context, null);
        return;
      }

      const data = responseType === 'arraybuffer'
        ? base64ToArrayBuffer(response.data)
        : String(response.data ?? '');
      const byteLength = data instanceof ArrayBuffer ? data.byteLength : new Blob([data]).size;

      this.stats.loaded = byteLength;
      this.stats.total = byteLength;
      this.stats.chunkCount = 1;
      this.stats.loading.first = this.stats.loading.first || performance.now();
      this.stats.loading.end = performance.now();

      if (response.status < 200 || response.status >= 300) {
      callbacks.onError(
        { code: response.status, text: `Kick HLS request failed with ${response.status}` },
        context,
        null,
        this.stats,
      );
        return;
      }

      callbacks.onSuccess(
        {
          url: context.url,
          data,
          code: response.status,
          text: 'OK',
        } satisfies LoaderResponse,
        this.stats,
        context,
        null,
      );
    } catch (error) {
      if (this.cancelled) {
        callbacks.onAbort?.(this.stats, context, null);
        return;
      }

      this.stats.loading.end = performance.now();

      const message = error instanceof Error ? error.message : 'Unable to load Kick HLS data';

      if (/timed out/i.test(message)) {
        callbacks.onTimeout(this.stats, context, null);
        return;
      }

      callbacks.onError(
        { code: 0, text: message },
        context,
        null,
        this.stats,
      );
    }
  }
}

function createHlsLoadStats(): LoaderStats {
  return {
    aborted: false,
    loaded: 0,
    retry: 0,
    total: 0,
    chunkCount: 0,
    bwEstimate: 0,
    loading: { start: 0, first: 0, end: 0 },
    parsing: { start: 0, end: 0 },
    buffering: { start: 0, first: 0, end: 0 },
  };
}

function base64ToArrayBuffer(base64: string) {
  const binary = atob(String(base64 ?? ''));
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

const supportCards: SupportCard[] = [
  {
    name: 'The Green Room',
    url: links.patreon,
    label: 'Welcome to the Greenroom',
    detail: 'Behind-the-scenes community access',
    icon: HeartHandshake,
    image: '/assets/patreon-logo-icon-app-transparent-background-premium-social-media-design-for-digital-download-free-png.png',
    className: 'patreon',
  },
  {
    name: 'Official Merch',
    url: links.shop,
    label: 'pmw.store',
    detail: 'Launch signup and merch drops',
    icon: ShoppingBag,
    image: '/assets/logo-new.svg',
    className: 'shop',
  },
  {
    name: 'Parasocial',
    url: links.vodArchive,
    view: 'vods',
    label: 'Parasoci.al/vods',
    detail: 'Past streams and archived broadcasts',
    icon: Video,
    image: '/assets/Parasocial.webp',
    className: 'vods',
  },
  {
    name: 'Discord',
    url: links.discord,
    label: 'Join the server',
    detail: 'Live chatter, events, and community rooms',
    icon: MessageCircle,
    image: '/assets/discord-app-icon-with-transparent-background-free-png.png',
    className: 'discord',
  },
  {
    name: 'Subreddit',
    url: links.subreddit,
    label: 'r/PaymoneyWubby',
    detail: 'Community posts, clips, and stream chaos',
    icon: MessageCircle,
    image: '/assets/reddit-icon.webp',
    className: 'reddit',
  },
  {
    name: 'Twitter/X',
    url: links.x,
    label: '@PaymoneyWubby',
    detail: 'Posts and stream updates',
    icon: X,
    image: '/assets/twitter-x-logo-png_seeklogo-492397.png',
    className: 'x-social',
  },
  {
    name: 'Cop Slop',
    url: links.copSlop,
    label: 'cop-slop.wubby.live',
    detail: 'Community bodycam board',
    icon: Video,
    image: '/assets/cop-slop-1b.svg',
    className: 'cop-slop',
  },
  {
    name: 'Regarded Art',
    url: links.regardedArt,
    label: 'Regarded.art',
    detail: 'Community artist showcase',
    icon: Info,
    image: '/assets/regarded-art-icon.svg',
    className: 'regarded-art',
  },
];

const youtubeCards: YoutubeChannel[] = [
  {
    name: 'Wubby Highlights',
    channelId: 'UCmcCGOWBcvTcw9HIF3JASIg',
    url: links.highlights,
    detail: 'Edited highlight videos and stream moments',
    image: 'https://yt3.googleusercontent.com/ytc/AIdro_lq6xth4K7oQTRxGnhI20tzXcjMfSRQWagFtg8LV9dS1A=s900-c-k-c0x00ffffff-no-rj',
    banner: '/assets/youtube-highlights-banner.webp',
    className: 'highlights',
  },
  {
    name: 'Wubby Clips',
    channelId: 'UCxhC6ALtyS6Xs0gZCPYAZPA',
    url: links.clips,
    detail: 'Short clips from stream',
    image: 'https://yt3.googleusercontent.com/dOrUr-7NwjRUgB7YNs54by89Wztxo_esCuYU8ky7MVeIYmEw2u1CZxsKirVCjoDwblBfPn5RBw4=s900-c-k-c0x00ffffff-no-rj',
    banner: '/assets/youtube-clips-banner.webp',
    className: 'clips',
  },
  {
    name: 'Wubby Magic Monday',
    channelId: 'UCzeRRBx7q_QstvM6Eqwmz0Q',
    url: links.magicMonday,
    detail: 'Magic Monday videos and tabletop moments',
    image: 'https://yt3.googleusercontent.com/EdE8MufDND2nKvX0juVLbp5DQVOMqOfi-2VnZST337vqkN1ehOQfH0KoKdxL38H7T0kp8cKzou0=s900-c-k-c0x00ffffff-no-rj',
    banner: '/assets/youtube-magic-banner.webp',
    className: 'magic',
  },
];

const fallbackLatestVideos: LatestYoutubeVideo[] = [
  {
    channelName: youtubeCards[0].name,
    title: 'Dawson Oaks Trailer Park Made Me A Criminal',
    url: 'https://www.youtube.com/watch?v=lhV1tGy1LqI',
    image: 'https://i1.ytimg.com/vi/lhV1tGy1LqI/hqdefault.jpg',
    channelImage: youtubeCards[0].image,
    className: 'highlights',
  },
  {
    channelName: youtubeCards[1].name,
    title: 'His Gun MISFIRED Trying To Shoot A Cop',
    url: 'https://www.youtube.com/watch?v=E-Ob4tkESVo',
    image: 'https://i2.ytimg.com/vi/E-Ob4tkESVo/hqdefault.jpg',
    channelImage: youtubeCards[1].image,
    className: 'clips',
  },
  {
    channelName: youtubeCards[2].name,
    title: "WELCOME TO THE CIRCUS ft. MeatCanyon | Mulligan's Ep.11",
    url: 'https://www.youtube.com/watch?v=mfg_6Odnj60',
    image: 'https://i2.ytimg.com/vi/mfg_6Odnj60/hqdefault.jpg',
    channelImage: youtubeCards[2].image,
    className: 'magic',
  },
];

function createHeroSlides(latestVideos: LatestYoutubeVideo[]): HeroSlide[] {
  return [
    {
      type: 'store',
      eyebrow: 'Official Merch',
      title: 'pmw.store',
      detail: '',
      url: links.shop,
      image: 'https://pmw.store/cdn/shop/files/banner-desktop2_9255c2fe-d1bf-47b9-a496-d54dbc67a4f7.png?v=1782448362',
      className: 'store',
    },
    ...latestVideos.map((video) => ({
      type: 'youtube' as const,
      eyebrow: video.channelName,
      title: video.title,
      detail: 'Latest upload',
      url: video.url,
      image: video.image,
      channelImage: video.channelImage,
      className: video.className,
    })),
  ];
}

function HlsVideo({ src, title, autoPlay = false, maxHeight = 720, onPlaybackError }: HlsVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return undefined;
    }

    const currentVideo = video;

    async function lockVideoLandscape() {
      try {
        if (Capacitor.isNativePlatform()) {
          await NativeOrientation.lockLandscape();
          await NativeOrientation.enterFullscreen();
        } else if (screen.orientation?.lock) {
          await screen.orientation.lock('landscape').catch(() => {});
        }
      } catch {
        // Native video fullscreen can still continue if orientation lock is refused.
      }
    }

    async function restoreVideoPortrait() {
      try {
        if (Capacitor.isNativePlatform()) {
          await NativeOrientation.exitFullscreen();
          await NativeOrientation.lockPortrait();
        } else if (screen.orientation?.lock) {
          await screen.orientation.lock('portrait').catch(() => {});
        }
      } catch {
        // Some platforms unlock orientation automatically when leaving video fullscreen.
      }
    }

    function handleFullscreenChange() {
      const fullscreenElement = document.fullscreenElement ?? document.webkitFullscreenElement ?? null;

      if (fullscreenElement === currentVideo || currentVideo.contains(fullscreenElement)) {
        lockVideoLandscape();
      } else if (!fullscreenElement) {
        restoreVideoPortrait();
      }
    }

    currentVideo.addEventListener('webkitbeginfullscreen', lockVideoLandscape);
    currentVideo.addEventListener('webkitendfullscreen', restoreVideoPortrait);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      currentVideo.removeEventListener('webkitbeginfullscreen', lockVideoLandscape);
      currentVideo.removeEventListener('webkitendfullscreen', restoreVideoPortrait);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !src) {
      return undefined;
    }

    video.muted = false;
    video.defaultMuted = false;
    video.volume = 1;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;

      function handleNativeError() {
        onPlaybackError?.();
      }

      video.addEventListener('error', handleNativeError);

      return () => {
        video.removeEventListener('error', handleNativeError);
        video.removeAttribute('src');
        video.load();
      };
    }

    if (!Hls.isSupported()) {
      onPlaybackError?.();
      return undefined;
    }

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      ...(Capacitor.getPlatform() === 'ios' ? { loader: NativeKickHlsLoader } : {}),
      backBufferLength: 180,
      maxBufferLength: 90,
      maxMaxBufferLength: 180,
      liveSyncDurationCount: 6,
      liveMaxLatencyDurationCount: 14,
      maxLiveSyncPlaybackRate: 1,
      capLevelOnFPSDrop: true,
      manifestLoadingMaxRetry: 6,
      manifestLoadingRetryDelay: 1000,
      manifestLoadingMaxRetryTimeout: 10000,
      levelLoadingMaxRetry: 6,
      levelLoadingRetryDelay: 1000,
      levelLoadingMaxRetryTimeout: 10000,
      fragLoadingMaxRetry: 8,
      fragLoadingRetryDelay: 1000,
      fragLoadingMaxRetryTimeout: 10000,
      abrEwmaDefaultEstimate: 6000000,
      abrBandWidthFactor: 0.7,
      abrBandWidthUpFactor: 0.5,
    });
    let maxStableLevelIndex = -1;
    let targetLevelIndex = -1;
    let lastQualityRestoreAt = 0;
    let previousBufferSeconds = 0;
    let lowBufferTicks = 0;

    function setTargetLevel(levelIndex: number) {
      if (levelIndex < 0) {
        return;
      }

      targetLevelIndex = levelIndex;
      hls.autoLevelCapping = levelIndex;
      hls.loadLevel = levelIndex;
      hls.nextLoadLevel = levelIndex;
    }

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      maxStableLevelIndex = getStableHlsLevelIndex(hls.levels, maxHeight);
      const startLevelIndex = getAdjacentHlsLevelIndex(hls.levels, maxStableLevelIndex, -1);
      targetLevelIndex = startLevelIndex >= 0 ? startLevelIndex : maxStableLevelIndex;

      if (targetLevelIndex >= 0) {
        hls.startLevel = targetLevelIndex;
        setTargetLevel(targetLevelIndex);
      }
    });

    const bufferMonitorId = window.setInterval(() => {
      if (targetLevelIndex < 0 || maxStableLevelIndex < 0 || video.paused || video.ended) {
        return;
      }

      const bufferSeconds = getForwardBufferSeconds(video);
      const isBufferFalling = bufferSeconds < previousBufferSeconds - 0.75;
      previousBufferSeconds = bufferSeconds;

      if (bufferSeconds < hlsBufferThresholds.critical) {
        lowBufferTicks += 1;
      } else if (bufferSeconds < hlsBufferThresholds.low && isBufferFalling) {
        lowBufferTicks += 1;
      } else {
        lowBufferTicks = 0;
      }

      if (lowBufferTicks >= 2) {
        const nextLowerLevelIndex = getAdjacentHlsLevelIndex(hls.levels, targetLevelIndex, -1);

        if (nextLowerLevelIndex >= 0 && nextLowerLevelIndex !== targetLevelIndex) {
          setTargetLevel(nextLowerLevelIndex);
        }

        lowBufferTicks = 0;
        return;
      }

      if (
        bufferSeconds >= hlsBufferThresholds.healthy &&
        targetLevelIndex !== maxStableLevelIndex &&
        Date.now() - lastQualityRestoreAt > hlsBufferThresholds.restoreCooldownMs
      ) {
        const nextHigherLevelIndex = getAdjacentHlsLevelIndex(
          hls.levels,
          targetLevelIndex,
          1,
          maxStableLevelIndex,
        );

        if (nextHigherLevelIndex >= 0 && nextHigherLevelIndex !== targetLevelIndex) {
          setTargetLevel(nextHigherLevelIndex);
          lastQualityRestoreAt = Date.now();
        }
      }
    }, 1500);

    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) {
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
          return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
          return;
        }

        onPlaybackError?.();
      }
    });

    hls.loadSource(src);
    hls.attachMedia(video);

    return () => {
      window.clearInterval(bufferMonitorId);
      hls.destroy();
    };
  }, [maxHeight, onPlaybackError, src]);

  return (
    <video
      ref={videoRef}
      className="hls-video"
      title={title}
      controls
      playsInline
      autoPlay={autoPlay}
      muted={false}
      tabIndex={0}
    />
  );
}

function KickEmbedFrame() {
  return (
    <iframe
      className="kick-fallback-frame"
      title="Kick player"
      src={links.kickEmbed}
      width="1280"
      height="720"
      frameBorder="0"
      scrolling="no"
      allow="autoplay; fullscreen; picture-in-picture"
      allowFullScreen
    />
  );
}

function KickPlayer({
  playbackUrl,
  status,
  isLive,
  liveStatusKnown = false,
  allowIframeFallback = false,
  maxHeight = 720,
}: KickPlayerProps) {
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    setUseFallback(false);
  }, [playbackUrl]);

  if (allowIframeFallback && useFallback) {
    return <KickEmbedFrame />;
  }

  if (liveStatusKnown && !isLive) {
    return <KickOfflinePanel status="offline" />;
  }

  if (playbackUrl) {
    return (
      <HlsVideo
        src={getPlayableKickPlaybackUrl(playbackUrl)}
        title="Kick HLS stream"
        autoPlay
        maxHeight={maxHeight}
        onPlaybackError={allowIframeFallback ? () => setUseFallback(true) : undefined}
      />
    );
  }

  return (
    <KickOfflinePanel status={status === 'loading' ? 'loading' : 'offline'} />
  );
}

function KickOfflinePanel({ status }: { status: 'loading' | 'offline' }) {
  return (
    <div className={`stream-unavailable ${status === 'loading' ? 'is-loading' : 'is-offline'}`}>
      <img src="/assets/Kick_logo.svg.webp" alt="" aria-hidden="true" />
      <strong>{status === 'loading' ? 'Loading Kick stream' : 'Stream Offline'}</strong>
      <span>{status === 'loading' ? 'Checking the live HLS source...' : 'PaymoneyWubby is not live on Kick right now.'}</span>
    </div>
  );
}

function getStableHlsLevelIndex(levels: HlsLevel[], maxHeight: number) {
  if (!Array.isArray(levels) || levels.length === 0) {
    return -1;
  }

  const sortedLevels = levels
    .map((level, index) => ({ ...level, index }))
    .sort((left, right) => {
      const leftHeight = left.height ?? 0;
      const rightHeight = right.height ?? 0;

      if (leftHeight !== rightHeight) {
        return leftHeight - rightHeight;
      }

      return (left.bitrate ?? 0) - (right.bitrate ?? 0);
    });

  const cappedLevels = sortedLevels.filter((level) => (level.height ?? 0) <= maxHeight);
  const selectedLevel = cappedLevels.at(-1) ?? sortedLevels[Math.max(0, Math.floor(sortedLevels.length / 2) - 1)];

  return selectedLevel.index;
}

function getAdjacentHlsLevelIndex(
  levels: HlsLevel[],
  currentLevelIndex: number,
  direction: -1 | 1,
  maxLevelIndex: number | null = null,
) {
  const sortedIndexes = getSortedHlsLevelIndexes(levels);
  const currentPosition = sortedIndexes.indexOf(currentLevelIndex);

  if (currentPosition === -1) {
    return -1;
  }

  const maxPosition = maxLevelIndex === null ? sortedIndexes.length - 1 : sortedIndexes.indexOf(maxLevelIndex);
  const boundedMaxPosition = maxPosition === -1 ? sortedIndexes.length - 1 : maxPosition;
  const nextPosition = Math.min(
    Math.max(currentPosition + direction, 0),
    boundedMaxPosition,
  );

  return sortedIndexes[nextPosition] ?? -1;
}

function getSortedHlsLevelIndexes(levels: HlsLevel[]) {
  if (!Array.isArray(levels)) {
    return [];
  }

  return levels
    .map((level, index) => ({ ...level, index }))
    .sort((left, right) => {
      const leftHeight = left.height ?? 0;
      const rightHeight = right.height ?? 0;

      if (leftHeight !== rightHeight) {
        return leftHeight - rightHeight;
      }

      return (left.bitrate ?? 0) - (right.bitrate ?? 0);
    })
    .map((level) => level.index);
}

function getForwardBufferSeconds(video: HTMLVideoElement | null) {
  if (!video || video.buffered.length === 0) {
    return 0;
  }

  for (let index = 0; index < video.buffered.length; index += 1) {
    const start = video.buffered.start(index);
    const end = video.buffered.end(index);

    if (video.currentTime >= start && video.currentTime <= end) {
      return Math.max(0, end - video.currentTime);
    }
  }

  return 0;
}

const navGroups: NavGroup[] = [
  {
    label: 'Watch',
    items: [
      { type: 'button', id: 'home', label: 'Home', icon: Home },
      { type: 'stream', id: 'kick', label: 'Kick', icon: Radio },
      { type: 'stream', id: 'twitch', label: 'Twitch', icon: Tv },
      { type: 'vods', id: 'vodArchive', label: 'VODs', icon: Video },
      { type: 'link', id: 'patreon', label: 'Green Room', icon: HeartHandshake, href: links.patreon },
    ],
  },
  {
    label: 'YouTube',
    items: [
      { type: 'link', id: 'highlights', label: 'Highlights', icon: YoutubeIcon, href: links.highlights },
      { type: 'link', id: 'clips', label: 'Wubby Clips', icon: YoutubeIcon, href: links.clips },
      { type: 'link', id: 'magicMonday', label: 'Magic Monday', icon: YoutubeIcon, href: links.magicMonday },
    ],
  },
  {
    label: 'Community',
    items: [
      { type: 'link', id: 'discord', label: 'Discord', icon: MessageCircle, href: links.discord },
      { type: 'link', id: 'subreddit', label: 'Subreddit', icon: MessageCircle, href: links.subreddit },
      { type: 'link', id: 'x', label: 'Twitter/X', icon: MessageCircle, href: links.x },
    ],
  },
  {
    label: 'Merch',
    items: [
      { type: 'link', id: 'shop', label: 'pmw.store', icon: ShoppingBag, href: links.shop },
    ],
  },
];

const mobileMoreActions: MobileMoreAction[] = [
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'about', label: 'About', icon: Info },
  { id: 'contact', label: 'Contact me', icon: MessageCircle },
];

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [view, setView] = useState<ViewName>('home');
  const [isTelevision, setIsTelevision] = useState(false);
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const [linksDrawerOpen, setLinksDrawerOpen] = useState(false);
  const [linksDrawerClosing, setLinksDrawerClosing] = useState(false);
  const [viewTransition, setViewTransition] = useState('');
  const [latestYoutubeVideos, setLatestYoutubeVideos] = useState<LatestYoutubeVideo[]>(fallbackLatestVideos);
  const [selectedStream, setSelectedStream] = useState<StreamId>(mediaPlayers[0].id);
  const [streamFullscreen, setStreamFullscreen] = useState(false);
  const [streamFullscreenMode, setStreamFullscreenMode] = useState<StreamFullscreenMode>('none');
  const [streamControlsVisible, setStreamControlsVisible] = useState(true);
  const [twitchPlayerKey, setTwitchPlayerKey] = useState(0);
  const [streamFrameSrc, setStreamFrameSrc] = useState(mediaPlayers[0].src);
  const [kickPlaybackUrl, setKickPlaybackUrl] = useState('');
  const [kickPlaybackStatus, setKickPlaybackStatus] = useState<KickPlaybackStatus>('idle');
  const [liveStatus, setLiveStatus] = useState<LiveStatusMap>(initialLiveStatus);
  const [liveStatusChecked, setLiveStatusChecked] = useState(false);
  const [liveDetails, setLiveDetails] = useState<LiveDetailsMap>(initialLiveDetails);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMenuClosing, setMobileMenuClosing] = useState(false);
  const [vodStatus, setVodStatus] = useState('');
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [notificationDrawerClosing, setNotificationDrawerClosing] = useState(false);
  const [notificationTab, setNotificationTab] = useState<NotificationTab>('notifications');
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>(() => ({
    ...defaultNotificationPrefs,
    ...readStoredJson<Partial<NotificationPrefs>>(notificationPrefsStorageKey, {}),
  }));
  const [notifications, setNotifications] = useState<WubHubNotification[]>(
    () => readStoredJson<WubHubNotification[]>(notificationStorageKey, []),
  );
  const isNativeApp = Capacitor.isNativePlatform();
  const cinemaFrameRef = useRef<HTMLDivElement | null>(null);
  const streamFullscreenOverlayRef = useRef<HTMLDivElement | null>(null);
  const streamFullscreenHistoryRef = useRef(false);
  const streamControlsTimerRef = useRef<number | null>(null);
  const streamFullscreenRef = useRef<boolean>(streamFullscreen);
  const streamFullscreenModeRef = useRef<StreamFullscreenMode>(streamFullscreenMode);
  const viewRef = useRef<ViewName>(view);
  const mobileMenuOpenRef = useRef(mobileMenuOpen);
  const linksDrawerOpenRef = useRef(linksDrawerOpen);
  const notificationDrawerOpenRef = useRef(notificationDrawerOpen);
  const viewTransitionTimerRef = useRef<number | null>(null);
  const mobileMenuTimerRef = useRef<number | null>(null);
  const linksDrawerTimerRef = useRef<number | null>(null);
  const notificationDrawerTimerRef = useRef<number | null>(null);
  const heroSwipeStartRef = useRef<number | null>(null);
  const heroSwipeMovedRef = useRef(false);
  const liveStatusRef = useRef(liveStatus);
  const previousLiveStatusRef = useRef<LiveStatusMap | null>(null);
  const notificationPrefsRef = useRef(notificationPrefs);
  const activePlayer = mediaPlayers.find((player) => player.id === selectedStream) ?? mediaPlayers[0];
  const heroSlides = createHeroSlides(latestYoutubeVideos);

  useEffect(() => {
    let cancelled = false;
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    const originalViewport = viewportMeta?.getAttribute('content') ?? 'width=device-width, initial-scale=1.0';
    const root = document.documentElement;
    const tvLayoutWidth = 2160;

    function applyTelevisionScale() {
      const viewportWidth = window.innerWidth || window.screen.width || 1920;
      const viewportHeight = window.innerHeight || window.screen.height || 1080;
      const tvScale = Math.min(1, viewportWidth / tvLayoutWidth);
      const tvLayoutHeight = Math.max(900, Math.ceil(viewportHeight / tvScale));

      root.style.setProperty('--tv-layout-width', `${tvLayoutWidth}px`);
      root.style.setProperty('--tv-layout-height', `${tvLayoutHeight}px`);
      root.style.setProperty('--tv-scale', String(tvScale));
    }

    async function detectTelevision() {
      if (!isNativeApp || Capacitor.getPlatform() !== 'android') {
        return;
      }

      try {
        const platformInfo = await NativePlatform.getInfo();
        const userAgentLooksLikeTv = /\b(AFT|BRAVIA|Shield Android TV|Android TV|GoogleTV|SMART-TV|SmartTV)\b/i
          .test(window.navigator.userAgent);

        if (!cancelled && (platformInfo?.isTelevision || userAgentLooksLikeTv)) {
          setIsTelevision(true);
          viewportMeta?.setAttribute(
            'content',
            'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no',
          );
          applyTelevisionScale();
          root.classList.add('android-tv');
          window.addEventListener('resize', applyTelevisionScale);
        }
      } catch {
        // If platform detection is unavailable, keep the responsive viewport.
      }
    }

    detectTelevision();

    return () => {
      cancelled = true;
      viewportMeta?.setAttribute('content', originalViewport);
      window.removeEventListener('resize', applyTelevisionScale);
      root.classList.remove('android-tv');
      root.style.removeProperty('--tv-layout-width');
      root.style.removeProperty('--tv-layout-height');
      root.style.removeProperty('--tv-scale');
    };
  }, [isNativeApp]);

  useEffect(() => {
    setStreamFrameSrc(activePlayer.src);
  }, [activePlayer.src]);

  useEffect(() => {
    streamFullscreenRef.current = streamFullscreen;
  }, [streamFullscreen]);

  useEffect(() => {
    streamFullscreenModeRef.current = streamFullscreenMode;
  }, [streamFullscreenMode]);

  useEffect(() => {
    if (!isTelevision || !streamFullscreen || streamFullscreenMode !== 'overlay') {
      return undefined;
    }

    const focusTimer = window.setTimeout(() => {
      const overlay = streamFullscreenOverlayRef.current;
      const mediaTarget = overlay?.querySelector('iframe, video');

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      if (mediaTarget instanceof HTMLElement) {
        mediaTarget.focus({ preventScroll: true });
      }
    }, 250);

    return () => window.clearTimeout(focusTimer);
  }, [isTelevision, streamFullscreen, streamFullscreenMode, twitchPlayerKey]);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    mobileMenuOpenRef.current = mobileMenuOpen;
  }, [mobileMenuOpen]);

  useEffect(() => {
    linksDrawerOpenRef.current = linksDrawerOpen;
  }, [linksDrawerOpen]);

  useEffect(() => {
    notificationDrawerOpenRef.current = notificationDrawerOpen;
  }, [notificationDrawerOpen]);

  useEffect(() => () => {
    if (viewTransitionTimerRef.current) {
      window.clearTimeout(viewTransitionTimerRef.current);
    }

    if (mobileMenuTimerRef.current) {
      window.clearTimeout(mobileMenuTimerRef.current);
    }

    if (linksDrawerTimerRef.current) {
      window.clearTimeout(linksDrawerTimerRef.current);
    }

    if (notificationDrawerTimerRef.current) {
      window.clearTimeout(notificationDrawerTimerRef.current);
    }
  }, []);

  useEffect(() => {
    liveStatusRef.current = liveStatus;
  }, [liveStatus]);

  useEffect(() => {
    if (view !== 'stream' || selectedStream !== 'kick') {
      return undefined;
    }

    let cancelled = false;

    async function refreshKickPlayback() {
      if (liveStatusChecked && !liveStatusRef.current.kick) {
        setKickPlaybackUrl('');
        setKickPlaybackStatus('unavailable');
        return;
      }

      setKickPlaybackStatus((current) => (current === 'ready' ? current : 'loading'));

      try {
        const playbackUrl = await getKickPlaybackUrl();

        if (!cancelled) {
          setKickPlaybackUrl(playbackUrl);
          setKickPlaybackStatus(playbackUrl ? 'ready' : 'unavailable');
        }
      } catch {
        if (!cancelled) {
          setKickPlaybackUrl('');
          setKickPlaybackStatus('unavailable');
        }
      }
    }

    refreshKickPlayback();

    return () => {
      cancelled = true;
    };
  }, [liveStatus.kick, liveStatusChecked, selectedStream, view]);

  useEffect(() => {
    if (view !== 'stream' || selectedStream !== 'kick' || !kickPlaybackUrl) {
      return undefined;
    }

    let cancelled = false;
    const expiryMs = getKickPlaybackExpiryMs(kickPlaybackUrl);
    const refreshDelay = Math.max(
      30000,
      expiryMs ? expiryMs - Date.now() - 60000 : 8 * 60 * 1000,
    );

    const refreshTimer = window.setTimeout(async () => {
      try {
        const playbackUrl = await getKickPlaybackUrl();

        if (!cancelled && playbackUrl) {
          setKickPlaybackUrl(playbackUrl);
          setKickPlaybackStatus('ready');
        }
      } catch {
        if (!cancelled) {
          setKickPlaybackStatus('unavailable');
        }
      }
    }, refreshDelay);

    return () => {
      cancelled = true;
      window.clearTimeout(refreshTimer);
    };
  }, [kickPlaybackUrl, selectedStream, view]);

  useEffect(() => {
    const splashTimer = window.setTimeout(() => {
      setShowSplash(false);
    }, 1500);

    return () => window.clearTimeout(splashTimer);
  }, []);

  useEffect(() => {
    notificationPrefsRef.current = notificationPrefs;
    window.localStorage.setItem(notificationPrefsStorageKey, JSON.stringify(notificationPrefs));

    if (Capacitor.getPlatform() === 'android') {
      NativeBackgroundLive.configure({
        kick: Boolean(notificationPrefs.kick),
        twitch: Boolean(notificationPrefs.twitch),
      }).catch(() => {});
    }
  }, [notificationPrefs]);

  useEffect(() => {
    if (view !== 'home') {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setActiveHeroSlide((current) => (current + 1) % heroSlides.length);
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [heroSlides.length, view]);

  useEffect(() => {
    let cancelled = false;

    async function refreshLatestVideos() {
      const latestVideos = await Promise.all(
        youtubeCards.map((channel, index) => getLatestYoutubeVideo(channel, fallbackLatestVideos[index])),
      );

      if (!cancelled) {
        setLatestYoutubeVideos(latestVideos);
      }
    }

    refreshLatestVideos();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(notificationStorageKey, JSON.stringify(notifications.slice(0, 20)));
  }, [notifications]);

  useEffect(() => {
    let cancelled = false;

    async function checkLiveStatus() {
      if (liveStatusTestMode) {
        const nextStatus: LiveStatusMap = { kick: true, twitch: true };
        const nextDetails = mediaPlayers.reduce<LiveDetailsMap>((details, player) => ({
          ...details,
          [player.id]: {
            title: testLiveDetails[player.id].title,
            category: testLiveDetails[player.id].category,
            viewers: testLiveDetails[player.id].viewers,
          },
        }), initialLiveDetails);

        if (!cancelled) {
          setLiveStatus(nextStatus);
          setLiveDetails(nextDetails);
          setLiveStatusChecked(true);
        }

        return;
      }

      const [kick, twitch] = await Promise.allSettled([getKickLiveStatus(), getTwitchLiveStatus()]);
      const liveDetails: Record<StreamId, LiveStatusDetails | null> = {
        kick: kick.status === 'fulfilled' ? kick.value : null,
        twitch: twitch.status === 'fulfilled' ? twitch.value : null,
      };
      const nextStatus: LiveStatusMap = {
        kick: liveDetails.kick ? liveDetails.kick.isLive : liveStatusRef.current.kick,
        twitch: liveDetails.twitch ? liveDetails.twitch.isLive : liveStatusRef.current.twitch,
      };
      const nextDetails = mediaPlayers.reduce<LiveDetailsMap>((details, player) => {
        const platformDetails = liveDetails[player.id];

        return {
          ...details,
          [player.id]: {
            title: platformDetails?.title ?? '',
            category: platformDetails?.isLive ? platformDetails?.category ?? '' : '',
            viewers: platformDetails?.isLive ? platformDetails?.viewers ?? null : null,
          },
        };
      }, initialLiveDetails);

      if (!cancelled) {
        handleLiveStatusNotifications(nextStatus, liveDetails);
        setLiveStatus(nextStatus);
        setLiveDetails(nextDetails);
        setLiveStatusChecked(true);
      }
    }

    checkLiveStatus();
    const intervalId = window.setInterval(checkLiveStatus, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (view !== 'stream') {
      if (streamFullscreen) {
        exitStreamFullscreen(false);
      }

      lockPortrait();
    }
  }, [view]);

  useEffect(() => {
    if (!streamFullscreen) {
      setStreamControlsVisible(true);
      if (streamControlsTimerRef.current !== null) {
        window.clearTimeout(streamControlsTimerRef.current);
      }
      return undefined;
    }

    function showStreamControls() {
      setStreamControlsVisible(true);
      if (streamControlsTimerRef.current !== null) {
        window.clearTimeout(streamControlsTimerRef.current);
      }
      streamControlsTimerRef.current = window.setTimeout(() => {
        setStreamControlsVisible(false);
      }, 2200);
    }

    function handlePopState() {
      exitStreamFullscreen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      showStreamControls();

      if (event.key === 'Escape') {
        event.preventDefault();
        exitStreamFullscreen();
      }
    }

    showStreamControls();
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', showStreamControls);
    window.addEventListener('pointermove', showStreamControls);
    window.addEventListener('touchstart', showStreamControls);
    window.addEventListener('touchmove', showStreamControls);
    window.addEventListener('wheel', showStreamControls);

    return () => {
      if (streamControlsTimerRef.current !== null) {
        window.clearTimeout(streamControlsTimerRef.current);
      }
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', showStreamControls);
      window.removeEventListener('pointermove', showStreamControls);
      window.removeEventListener('touchstart', showStreamControls);
      window.removeEventListener('touchmove', showStreamControls);
      window.removeEventListener('wheel', showStreamControls);
    };
  }, [streamFullscreen]);

  useEffect(() => {
    async function handleAnyFullscreenChange() {
      const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;

      if (fullscreenElement) {
        if (!streamFullscreenRef.current) {
          setStreamFullscreen(true);
          setStreamFullscreenMode('native');
        }

        await lockLandscape();

        try {
          if (isNativeApp) {
            await NativeOrientation.enterFullscreen();
          }
        } catch {
          // Player fullscreen can continue if immersive mode is unavailable.
        }

        return;
      }

      if (streamFullscreenModeRef.current === 'native') {
        setStreamFullscreen(false);
        setStreamFullscreenMode('none');
        streamFullscreenHistoryRef.current = false;
      }

      try {
        if (isNativeApp) {
          await NativeOrientation.exitFullscreen();
        }
      } catch {
        // Restore portrait below even if native immersive mode is unavailable.
      }

      if (viewRef.current === 'stream' && !streamFullscreenRef.current) {
        await lockPortrait();
      }
    }

    document.addEventListener('fullscreenchange', handleAnyFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleAnyFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleAnyFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleAnyFullscreenChange);
    };
  }, [isNativeApp]);

  useEffect(() => {
    if (!isNativeApp) {
      return undefined;
    }

    let listener: PluginListenerHandle | undefined;
    let appStateListener: PluginListenerHandle | undefined;

    async function attachBackHandler() {
      listener = await CapacitorApp.addListener('backButton', async () => {
        if (streamFullscreenRef.current) {
          await exitStreamFullscreen(false);
          return;
        }

        if (notificationDrawerOpenRef.current) {
          closeNotificationDrawer();
          return;
        }

        if (mobileMenuOpenRef.current) {
          closeMobileMenu();
          return;
        }

        if (linksDrawerOpenRef.current) {
          closeLinksDrawer();
          return;
        }

        if (viewRef.current !== 'home') {
          goHome();
          return;
        }

        CapacitorApp.exitApp();
      });
    }

    attachBackHandler();

    async function attachAppStateHandler() {
      appStateListener = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          previousLiveStatusRef.current = null;
        }
      });
    }

    attachAppStateHandler();

    return () => {
      listener?.remove();
      appStateListener?.remove();
    };
  }, [isNativeApp]);

  async function openStream(streamId: StreamId) {
    const shouldTransition = viewRef.current !== 'stream' || selectedStream !== streamId;
    setSelectedStream(streamId);
    setStreamFrameSrc(mediaPlayers.find((player) => player.id === streamId)?.src ?? mediaPlayers[0].src);
    setView('stream');
    if (shouldTransition) {
      runViewTransition('page-swipe-to-stream');
    }
    closeMobileMenu();
    closeLinksDrawer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goHome() {
    const shouldTransition = viewRef.current !== 'home';
    setView('home');
    if (shouldTransition) {
      runViewTransition('page-swipe-to-home');
    }
    closeMobileMenu();
    closeLinksDrawer();
  }

  function runViewTransition(className: string) {
    if (viewTransitionTimerRef.current) {
      window.clearTimeout(viewTransitionTimerRef.current);
    }

    setViewTransition('');

    window.requestAnimationFrame(() => {
      setViewTransition(className);
      viewTransitionTimerRef.current = window.setTimeout(() => {
        setViewTransition('');
      }, 820);
    });
  }

  function openNotificationDrawer() {
    if (notificationDrawerTimerRef.current) {
      window.clearTimeout(notificationDrawerTimerRef.current);
    }

    setNotificationDrawerClosing(false);
    setNotificationDrawerOpen(true);
  }

  function closeNotificationDrawer() {
    if (!notificationDrawerOpenRef.current) {
      return;
    }

    if (notificationDrawerTimerRef.current) {
      window.clearTimeout(notificationDrawerTimerRef.current);
    }

    setNotificationDrawerClosing(true);
    notificationDrawerTimerRef.current = window.setTimeout(() => {
      setNotificationDrawerOpen(false);
      setNotificationDrawerClosing(false);
    }, drawerAnimationMs);
  }

  function openMobileMenu() {
    if (mobileMenuTimerRef.current) {
      window.clearTimeout(mobileMenuTimerRef.current);
    }

    setMobileMenuClosing(false);
    setMobileMenuOpen(true);
  }

  function closeMobileMenu() {
    if (!mobileMenuOpenRef.current) {
      return;
    }

    if (mobileMenuTimerRef.current) {
      window.clearTimeout(mobileMenuTimerRef.current);
    }

    setMobileMenuClosing(true);
    mobileMenuTimerRef.current = window.setTimeout(() => {
      setMobileMenuOpen(false);
      setMobileMenuClosing(false);
    }, drawerAnimationMs);
  }

  function openLinksDrawer() {
    if (linksDrawerTimerRef.current) {
      window.clearTimeout(linksDrawerTimerRef.current);
    }

    setLinksDrawerClosing(false);
    setLinksDrawerOpen(true);
  }

  function closeLinksDrawer() {
    if (!linksDrawerOpenRef.current) {
      return;
    }

    if (linksDrawerTimerRef.current) {
      window.clearTimeout(linksDrawerTimerRef.current);
    }

    setLinksDrawerClosing(true);
    linksDrawerTimerRef.current = window.setTimeout(() => {
      setLinksDrawerOpen(false);
      setLinksDrawerClosing(false);
    }, drawerAnimationMs);
  }

  async function openVods() {
    setView('vods');
    closeMobileMenu();
    closeLinksDrawer();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    await launchVodsArchive();
  }

  async function openChatSignIn() {
    const url = activePlayer.id === 'kick' ? links.kickChatSignIn : links.twitchChatSignIn;

    if (isNativeApp) {
      try {
        await NativeChatAuth.open({ url });
        return;
      } catch {
        // Fall back to window.open if the native chat auth view is unavailable.
      }
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function openExternalLink(url: string) {
    if (isNativeApp) {
      try {
        await NativeExternal.open({ url });
        return;
      } catch {
        // Fall back to browser behavior if the native opener is unavailable.
      }
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function handleExternalLinkClick(url: string) {
    return (event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault();
      closeLinksDrawer();
      openExternalLink(url);
    };
  }

  function handleNativeVodTarget(target?: ViewName | StreamId | 'more') {
    if (target === 'home') {
      goHome();
      return;
    }

    if (target === 'kick' || target === 'twitch') {
      openStream(target);
      return;
    }

    if (target === 'more') {
      setView('home');
      openMobileMenu();
      closeLinksDrawer();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setView('vods');
  }

  async function launchVodsArchive() {
    if (!isNativeApp) {
      setVodStatus('Native VOD view is available in the Android and iOS app builds.');
      return;
    }

    try {
      setVodStatus('');
      const result = await NativeVod.open({ url: links.vodArchive });
      handleNativeVodTarget(result?.target);
    } catch {
      setVodStatus('The native VOD view could not be opened on this device.');
    }
  }

  async function lockPortrait() {
    try {
      if (isTelevision) {
        if (isNativeApp) {
          await NativeOrientation.lockLandscape();
        }
        return;
      }

      if (isNativeApp) {
        await NativeOrientation.lockPortrait();
      } else if (screen.orientation?.lock) {
        await screen.orientation.lock('portrait').catch(() => {});
      }
    } catch {
      // Orientation support varies by browser and platform.
    }
  }

  async function lockLandscape() {
    try {
      if (isNativeApp) {
        await NativeOrientation.lockLandscape();
      } else if (screen.orientation?.lock) {
        await screen.orientation.lock('landscape').catch(() => {});
      }
    } catch {
      // Fullscreen can still work even if orientation locking is unavailable.
    }
  }

  async function enterStreamFullscreen() {
    await lockLandscape();

    if (activePlayer.id === 'twitch') {
      setStreamFrameSrc(activePlayer.fullscreenSrc ?? activePlayer.src);
      setTwitchPlayerKey((key) => key + 1);
      await waitForRenderFrame();
    }

    if (!streamFullscreenHistoryRef.current) {
      window.history.pushState({ wubhubStreamFullscreen: true }, '');
      streamFullscreenHistoryRef.current = true;
    }

    try {
      if (isNativeApp) {
        await NativeOrientation.enterFullscreen();
      }
    } catch {
      // Browser fullscreen below can still work if immersive mode is unavailable.
    }

    if (isTelevision) {
      setStreamFullscreen(true);
      setStreamFullscreenMode('overlay');
      return;
    }

    try {
      await requestElementFullscreen(cinemaFrameRef.current);
      setStreamFullscreen(true);
      setStreamFullscreenMode('native');
      return;
    } catch {
      setStreamFullscreen(true);
      setStreamFullscreenMode('overlay');
    }
  }

  async function exitStreamFullscreen(shouldPopHistory = true) {
    const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;

    if (fullscreenElement && streamFullscreenModeRef.current === 'native') {
      await exitDocumentFullscreen();
    }

    setStreamFullscreen(false);
    setStreamFullscreenMode('none');

    try {
      if (isNativeApp) {
        await NativeOrientation.exitFullscreen();
      }
    } catch {
      // Restore portrait below even if native immersive mode is unavailable.
    }

    await lockPortrait();

    if (shouldPopHistory && streamFullscreenHistoryRef.current && window.history.state?.wubhubStreamFullscreen) {
      streamFullscreenHistoryRef.current = false;
      window.history.back();
    } else if (!shouldPopHistory) {
      streamFullscreenHistoryRef.current = false;
    }
  }

  async function requestElementFullscreen(element: HTMLElement | null) {
    if (!element) {
      throw new Error('No stream player available');
    }

    const requestFullscreen =
      element.requestFullscreen ||
      element.webkitRequestFullscreen ||
      element.msRequestFullscreen;

    if (!requestFullscreen) {
      throw new Error('Fullscreen API is unavailable');
    }

    await requestFullscreen.call(element);
  }

  async function exitDocumentFullscreen() {
    const exitFullscreen =
      document.exitFullscreen ||
      document.webkitExitFullscreen ||
      document.msExitFullscreen;

    if (exitFullscreen) {
      await exitFullscreen.call(document);
    }
  }

  function showHeroSlide(direction: -1 | 1) {
    setActiveHeroSlide((current) => (current + direction + heroSlides.length) % heroSlides.length);
  }

  function handleHeroKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showHeroSlide(-1);
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      showHeroSlide(1);
    }
  }

  function handleHeroTouchStart(event: React.TouchEvent<HTMLElement>) {
    heroSwipeStartRef.current = event.touches[0]?.clientX ?? null;
    heroSwipeMovedRef.current = false;
  }

  function handleHeroTouchMove(event: React.TouchEvent<HTMLElement>) {
    if (heroSwipeStartRef.current === null) {
      return;
    }

    const currentX = event.touches[0]?.clientX ?? heroSwipeStartRef.current;
    if (Math.abs(currentX - heroSwipeStartRef.current) > 10) {
      heroSwipeMovedRef.current = true;
    }
  }

  function handleHeroTouchEnd(event: React.TouchEvent<HTMLElement>) {
    if (heroSwipeStartRef.current === null) {
      return;
    }

    const endX = event.changedTouches[0]?.clientX ?? heroSwipeStartRef.current;
    const distance = endX - heroSwipeStartRef.current;

    if (Math.abs(distance) > 45) {
      heroSwipeMovedRef.current = true;
      showHeroSlide(distance < 0 ? 1 : -1);
      window.setTimeout(() => {
        heroSwipeMovedRef.current = false;
      }, 350);
    }

    heroSwipeStartRef.current = null;
  }

  function handleHeroClickCapture(event: React.MouseEvent<HTMLElement>) {
    if (!heroSwipeMovedRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  function handleLiveStatusNotifications(
    nextStatus: LiveStatusMap,
    liveDetails: Record<StreamId, LiveStatusDetails | null>,
  ) {
    const previousStatus = previousLiveStatusRef.current;
    previousLiveStatusRef.current = nextStatus;

    if (!previousStatus) {
      return;
    }

    mediaPlayers.forEach((player) => {
      const platformDetails = liveDetails[player.id];

      if (
        platformDetails &&
        !previousStatus[player.id] &&
        nextStatus[player.id] &&
        notificationPrefsRef.current[player.id]
      ) {
        addLiveNotification(player, platformDetails.title);
      }
    });
  }

  async function addLiveNotification(player: MediaPlayer, streamTitle: string) {
    const title = `Wubby is now live on ${player.name}`;
    const notification: WubHubNotification = {
      id: `${player.id}-${Date.now()}`,
      streamId: player.id,
      title,
      message: streamTitle || 'Live now on WubHub.',
      createdAt: Date.now(),
    };

    setNotifications((current) => [notification, ...current].slice(0, 20));
    await sendDeviceNotification(notification);
  }

  async function sendDeviceNotification(notification: WubHubNotification) {
    try {
      const permissions = await LocalNotifications.checkPermissions();

      if (permissions.display !== 'granted') {
        const request = await LocalNotifications.requestPermissions();
        if (request.display !== 'granted') {
          return;
        }
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Date.now() % 2147483647),
            title: notification.title,
            body: notification.message,
            schedule: { at: new Date(Date.now() + 250) },
          },
        ],
      });
    } catch {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, { body: notification.message });
      }
    }
  }

  async function toggleNotificationPreference(streamId: StreamId) {
    const nextEnabled = !notificationPrefs[streamId];

    if (nextEnabled) {
      await requestNotificationAccess();
    }

    setNotificationPrefs((current) => ({
      ...current,
      [streamId]: nextEnabled,
    }));
  }

  async function requestNotificationAccess() {
    try {
      const permissions = await LocalNotifications.checkPermissions();
      if (permissions.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }
    } catch {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    }
  }

  function dismissNotification(notificationId: string) {
    setNotifications((current) => current.filter((notification) => notification.id !== notificationId));
  }

  function clearNotifications() {
    setNotifications([]);
  }

  function renderNavItem(item: NavItem) {
    const Icon = item.icon;

    if (item.type === 'button') {
      return (
        <button className={`nav-item ${view === 'home' ? 'active' : ''}`} type="button" onClick={goHome} key={item.id}>
          <Icon size={20} aria-hidden="true" />
          <span>{item.label}</span>
        </button>
      );
    }

    if (item.type === 'stream') {
      return (
        <button
          className={`nav-item ${view === 'stream' && selectedStream === item.id ? 'active' : ''}`}
          type="button"
          onClick={() => openStream(item.id)}
          key={item.id}
        >
          <Icon size={20} aria-hidden="true" />
          <span>{item.label}</span>
          {liveStatus[item.id] && <span className="nav-live">Live</span>}
        </button>
      );
    }

    if (item.type === 'vods') {
      return (
        <button className={`nav-item ${view === 'vods' ? 'active' : ''}`} type="button" onClick={openVods} key={item.id}>
          <Icon size={20} aria-hidden="true" />
          <span>{item.label}</span>
        </button>
      );
    }

    return (
      <a
        className="nav-item"
        href={item.href}
        target="_blank"
        rel="noreferrer"
        onClick={handleExternalLinkClick(item.href)}
        key={item.id}
      >
        <Icon size={20} aria-hidden="true" />
        <span>{item.label}</span>
        <ExternalLink size={15} aria-hidden="true" />
      </a>
    );
  }

  return (
    <main className={`app-shell ${isTelevision ? 'tv-shell' : ''} ${streamFullscreen ? 'is-stream-fullscreen' : ''}`}>
      {showSplash && (
        <div className="app-splash" aria-label="Loading WubHub">
          <img src="/assets/WubHub2-transparent.png" alt="WubHub" />
          <span className="splash-loader" aria-hidden="true" />
        </div>
      )}

      <aside className="sidebar" aria-label="Primary">
        <button className="brand" type="button" onClick={goHome}>
          <img src="/assets/WubHub2-transparent.png" alt="WubHub" />
        </button>
        <nav className="nav-list">
          {navGroups
            .find((group) => group.label === 'Watch')
            ?.items.map(renderNavItem)}
        </nav>
        <div className="sidebar-more-actions" aria-label="Sidebar actions">
          {mobileMoreActions.map((action) => {
            const Icon = action.icon;
            return (
              <button type="button" key={action.id}>
                <span>
                  <Icon size={25} aria-hidden="true" />
                </span>
                <strong>{action.label}</strong>
              </button>
            );
          })}
        </div>
      </aside>

      <section id="home" className={`content ${viewTransition}`}>
        <header className="topbar">
          <button className="mobile-brand" type="button" onClick={goHome}>
            <img src="/assets/WubHub2-transparent.png" alt="WubHub" />
          </button>
          {view === 'stream' && (
            <img
              className={`mobile-stream-header-logo ${activePlayer.className}`}
              src={activePlayer.logo}
              alt={activePlayer.name}
            />
          )}
          <button
            className="icon-button notification-button"
            type="button"
            aria-label="Notifications"
            onClick={openNotificationDrawer}
          >
            <Bell size={20} aria-hidden="true" />
            {notifications.length > 0 && <span className="notification-badge">{notifications.length}</span>}
          </button>
        </header>

        {notificationDrawerOpen && (
          <div className={`notification-layer ${notificationDrawerClosing ? 'is-closing' : 'is-opening'}`} role="presentation">
            <button
              className="notification-backdrop"
              type="button"
              aria-label="Close notifications"
              onClick={closeNotificationDrawer}
            />
            <aside className="notification-drawer" aria-label="Notifications">
              <div className="drawer-header">
                <div>
                  <strong>Notifications</strong>
                  <span>{notifications.length} active</span>
                </div>
                <button className="drawer-icon-button" type="button" aria-label="Close notifications" onClick={closeNotificationDrawer}>
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              <div className="drawer-tabs" role="tablist" aria-label="Notification drawer tabs">
                <button
                  className={notificationTab === 'notifications' ? 'active' : ''}
                  type="button"
                  role="tab"
                  aria-selected={notificationTab === 'notifications'}
                  onClick={() => setNotificationTab('notifications')}
                >
                  <BellRing size={17} aria-hidden="true" />
                  Activity
                </button>
                <button
                  className={notificationTab === 'settings' ? 'active' : ''}
                  type="button"
                  role="tab"
                  aria-selected={notificationTab === 'settings'}
                  onClick={() => setNotificationTab('settings')}
                >
                  <Settings size={17} aria-hidden="true" />
                  Settings
                </button>
              </div>

              {notificationTab === 'notifications' ? (
                <div className="drawer-panel">
                  {notifications.length > 0 ? (
                    <>
                      <button className="clear-notifications" type="button" onClick={clearNotifications}>
                        <Trash2 size={16} aria-hidden="true" />
                        Clear all
                      </button>
                      <div className="notification-list">
                        {notifications.map((notification) => (
                          <article className="notification-entry" key={notification.id}>
                            <span className={`notification-dot ${notification.streamId}`} />
                            <div>
                              <strong>{notification.title}</strong>
                              <span>{notification.message}</span>
                              <time dateTime={new Date(notification.createdAt).toISOString()}>
                                {formatNotificationTime(notification.createdAt)}
                              </time>
                            </div>
                            <button
                              className="drawer-icon-button"
                              type="button"
                              aria-label={`Dismiss ${notification.title}`}
                              onClick={() => dismissNotification(notification.id)}
                            >
                              <X size={16} aria-hidden="true" />
                            </button>
                          </article>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="empty-notifications">
                      <Bell size={24} aria-hidden="true" />
                      <strong>No notifications</strong>
                      <span>Live alerts will appear here.</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="drawer-panel settings-panel">
                  {mediaPlayers.map((player) => (
                    <label className="notification-setting" key={player.id}>
                      <span>
                        <strong>{player.name}</strong>
                        <small>Send a phone/TV alert when {player.name} goes live.</small>
                      </span>
                      <input
                        type="checkbox"
                        checked={notificationPrefs[player.id]}
                        onChange={() => toggleNotificationPreference(player.id)}
                      />
                      <span className="toggle-track" aria-hidden="true">
                        <span />
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </aside>
          </div>
        )}

        {mobileMenuOpen && (
          <div
            className={`mobile-menu-backdrop ${mobileMenuClosing ? 'is-closing' : 'is-opening'}`}
            role="presentation"
            onClick={closeMobileMenu}
          >
            <nav
              className="mobile-menu"
              aria-label="Mobile menu"
              onClick={(event) => event.stopPropagation()}
            >
              {navGroups.filter((group) => group.label === 'Watch').map((group) => (
                <div className="nav-group" key={group.label}>
                  <p>{group.label}</p>
                  {group.items.map(renderNavItem)}
                </div>
              ))}
              <div className="mobile-more-actions" aria-label="More menu actions">
                {mobileMoreActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button type="button" key={action.id}>
                      <span>
                        <Icon size={28} aria-hidden="true" />
                      </span>
                      <strong>{action.label}</strong>
                    </button>
                  );
                })}
              </div>
            </nav>
          </div>
        )}

        {view === 'home' ? (
          <>
            <section
              className="hero-carousel"
              aria-labelledby="page-title"
              tabIndex={0}
              onClickCapture={handleHeroClickCapture}
              onKeyDown={handleHeroKeyDown}
              onTouchEnd={handleHeroTouchEnd}
              onTouchMove={handleHeroTouchMove}
              onTouchStart={handleHeroTouchStart}
            >
              <span id="page-title" className="sr-only">Featured WubHub content</span>
              <div
                className="hero-carousel-track"
                style={{ transform: `translateX(-${activeHeroSlide * 100}%)` }}
              >
                {heroSlides.map((slide) => (
                  <a
                    className={`hero-slide ${slide.className}`}
                    href={slide.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={handleExternalLinkClick(slide.url)}
                    key={slide.title}
                  >
                    <div className="hero-slide-copy">
                      <span className="hero-slide-eyebrow">
                        {slide.type === 'youtube' && <YoutubeIcon size={18} aria-hidden="true" />}
                        {slide.type === 'store' && <ShoppingBag size={18} aria-hidden="true" />}
                        {slide.eyebrow}
                      </span>
                      <strong>{slide.title}</strong>
                      {slide.detail && <small>{slide.detail}</small>}
                    </div>
                    <div className="hero-slide-media">
                      <img className="hero-slide-image" src={slide.image} alt="" aria-hidden="true" />
                      {slide.channelImage && (
                        <img className="hero-slide-channel" src={slide.channelImage} alt="" aria-hidden="true" />
                      )}
                    </div>
                  </a>
                ))}
              </div>
              <div className="hero-carousel-dots" aria-label="Featured carousel slides">
                {heroSlides.map((slide, index) => (
                  <button
                    className={index === activeHeroSlide ? 'active' : ''}
                    type="button"
                    onClick={() => setActiveHeroSlide(index)}
                    aria-label={`Show slide ${index + 1}: ${slide.eyebrow}`}
                    key={slide.title}
                  />
                ))}
              </div>
            </section>

            <section id="media" className="section-block" aria-labelledby="watch-live">
              <div className="section-heading">
                <h2 id="watch-live">
                  <Radio className="section-title-icon watch-live-icon" size={25} aria-hidden="true" />
                  Watch Live
                </h2>
              </div>
              <div className="media-grid">
                {mediaPlayers.map((player) => (
                  <button
                    className={`stream-select ${player.className}`}
                    type="button"
                    key={player.name}
                    onClick={() => openStream(player.id)}
                  >
                    <span className="stream-meta">
                      <img className={`stream-card-logo ${player.className}`} src={player.logo} alt={player.name} />
                      {liveStatus[player.id] && liveDetails[player.id]?.category && (
                        <span className="stream-category">{liveDetails[player.id].category}</span>
                      )}
                      {liveStatus[player.id] && liveDetails[player.id]?.viewers !== null && (
                        <span className="stream-viewers stream-viewers-mobile">
                          <Users size={14} aria-hidden="true" />
                          {formatViewerCount(liveDetails[player.id].viewers)}
                        </span>
                      )}
                    </span>
                    <span className="stream-card-status">
                      <span className={`stream-live-pill ${liveStatus[player.id] ? 'is-live' : 'is-offline'}`}>
                        <span className="stream-status-dot" />
                        {liveStatus[player.id] ? 'Live Now' : 'Not Live'}
                      </span>
                      {liveStatus[player.id] && liveDetails[player.id]?.viewers !== null && (
                        <span className="stream-viewers stream-viewers-desktop">
                          <Users size={14} aria-hidden="true" />
                          {formatViewerCount(liveDetails[player.id].viewers)}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="section-block" aria-labelledby="youtube">
              <div className="section-heading">
                <h2 id="youtube">YouTube</h2>
              </div>
              <div className="youtube-grid">
                {youtubeCards.map((channel) => (
                  <a
                    className={`youtube-card ${channel.className}`}
                    href={channel.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={handleExternalLinkClick(channel.url)}
                    key={channel.name}
                  >
                    <img className="youtube-thumb" src={channel.banner} alt="" aria-hidden="true" />
                    <Video size={34} aria-hidden="true" />
                    <div>
                      <img className="youtube-channel-avatar" src={channel.image} alt="" aria-hidden="true" />
                      <strong>{channel.name.replace('PaymoneyWubby ', '')}</strong>
                    </div>
                    <ChevronRight className="card-arrow" size={22} aria-hidden="true" />
                  </a>
                ))}
              </div>
            </section>
          </>
        ) : view === 'stream' ? (
          <section className="stream-page" aria-labelledby="stream-title">
            <div className="stream-page-header">
              <div>
                {liveStatus[activePlayer.id] && <span className="status-dot">Live</span>}
                <h1 id="stream-title">
                  <img
                    className={`stream-title-logo ${activePlayer.className}`}
                    src={activePlayer.logo}
                    alt={activePlayer.name}
                  />
                </h1>
              </div>
            </div>

            <div className="stream-action-row">
              <button className="fullscreen-button" type="button" onClick={enterStreamFullscreen}>
                <Maximize2 size={18} aria-hidden="true" />
                Fullscreen
              </button>

              <a
                className="tts-link-button desktop-tts-button"
                href={links.tts}
                target="_blank"
                rel="noreferrer"
                onClick={handleExternalLinkClick(links.tts)}
              >
                <img
                  className="tts-link-icon"
                  src="/assets/a726df7d2bccfa2b7cf0a5002a6a3b74de4f2c5e-48x48.png"
                  alt=""
                  aria-hidden="true"
                />
                Click here for TTS
              </a>
            </div>

            <div className="stream-content-layout">
              <div className="stream-video-column">
                <div className={`cinema-frame ${activePlayer.className}`} ref={cinemaFrameRef}>
                  {streamFullscreen && streamFullscreenMode === 'overlay' ? (
                    <div className="stream-fullscreen-handoff" aria-hidden="true" />
                  ) : activePlayer.id === 'kick' ? (
                    <KickPlayer
                      playbackUrl={kickPlaybackUrl}
                      status={kickPlaybackStatus}
                      isLive={liveStatus.kick}
                      liveStatusKnown={liveStatusChecked}
                      maxHeight={720}
                    />
                  ) : (
                    <iframe
                      key={`${activePlayer.id}-${twitchPlayerKey}`}
                      title={`${activePlayer.name} player`}
                      src={withTwitchReloadToken(streamFrameSrc, twitchPlayerKey)}
                      width="1280"
                      height="720"
                      frameBorder="0"
                      scrolling="no"
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                    />
                  )}
                </div>

              </div>

              <div className="stream-chat-column">
                <section className={`stream-chat-panel ${activePlayer.className} has-toolbar`} aria-label={`${activePlayer.name} chat`}>
                  {(activePlayer.id === 'kick' || activePlayer.id === 'twitch') && (
                    <div className="stream-chat-toolbar">
                      <span>{activePlayer.name} chat</span>
                      <button type="button" onClick={openChatSignIn}>
                        Sign in / open chat
                      </button>
                    </div>
                  )}
                  <iframe
                    title={`${activePlayer.name} chat`}
                    src={streamChats[activePlayer.id]}
                    width="720"
                    height="520"
                    frameBorder="0"
                    scrolling="no"
                    allow="clipboard-read; clipboard-write"
                  />
                </section>
              </div>
            </div>

            {streamFullscreen && streamFullscreenMode === 'overlay' && (
              <div
                className={`stream-fullscreen-overlay ${streamControlsVisible ? 'controls-visible' : 'controls-hidden'}`}
                role="dialog"
                aria-label={`${activePlayer.name} fullscreen stream`}
                ref={streamFullscreenOverlayRef}
                onClick={() => setStreamControlsVisible(true)}
                onPointerDown={() => setStreamControlsVisible(true)}
              >
                {activePlayer.id === 'kick' ? (
                  <KickPlayer
                    playbackUrl={kickPlaybackUrl}
                    status={kickPlaybackStatus}
                    isLive={liveStatus.kick}
                    liveStatusKnown={liveStatusChecked}
                    maxHeight={1080}
                  />
                ) : (
                  <iframe
                    key={`${activePlayer.id}-fullscreen-${twitchPlayerKey}`}
                    title={`${activePlayer.name} fullscreen player`}
                    src={withTwitchReloadToken(activePlayer.fullscreenSrc ?? streamFrameSrc, twitchPlayerKey)}
                    width="1280"
                    height="720"
                    frameBorder="0"
                    scrolling="no"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    tabIndex={0}
                  />
                )}
                <button
                  className="stream-fullscreen-exit"
                  type="button"
                  tabIndex={isTelevision ? -1 : 0}
                  aria-hidden={isTelevision ? 'true' : undefined}
                  onClick={() => exitStreamFullscreen()}
                >
                  Exit
                </button>
              </div>
            )}
          </section>
        ) : (
          <section className="vod-page" aria-labelledby="vod-title">
            <div className="vod-native-panel">
              <Video size={46} aria-hidden="true" />
              <div>
                <strong id="vod-title">{isNativeApp ? 'Opening VOD Archive' : 'VOD Archive'}</strong>
                <span>
                  {isNativeApp
                    ? 'The archive opens inside WubHub using the native app WebView.'
                    : 'Native WebView preview is only available in Android and iOS app builds.'}
                </span>
              </div>
              {isNativeApp && (
                <button className="primary-link-button" type="button" onClick={launchVodsArchive}>
                  Open In App
                </button>
              )}
              {(vodStatus || !isNativeApp) && (
                <p>{vodStatus || 'Use the Android APK/emulator or iOS build to test the embedded native VOD view.'}</p>
              )}
            </div>
          </section>
        )}

        {view === 'home' && (
          <section className="section-block" aria-labelledby="support">
            <h2 id="support" className="sr-only">Community and support links</h2>
            <button
              className="mobile-links-button"
              type="button"
              onClick={openLinksDrawer}
            >
              <Ellipsis size={24} aria-hidden="true" />
              <span>More Links</span>
            </button>
            <div className="support-grid">
              {supportCards.map((card) => {
                const Component = card.view ? 'button' : 'a';
                const Icon = card.icon;
                const ArrowIcon = card.view ? ChevronRight : ExternalLink;
                return (
                  <Component
                    className={`support-card ${card.className}`}
                    href={card.view ? undefined : card.url}
                    target={card.view ? undefined : '_blank'}
                    rel={card.view ? undefined : 'noreferrer'}
                    type={card.view ? 'button' : undefined}
                    onClick={card.view === 'vods' ? openVods : handleExternalLinkClick(card.url)}
                    key={card.name}
                  >
                    {card.image ? (
                      <img className="support-card-icon" src={card.image} alt="" aria-hidden="true" />
                    ) : (
                      <Icon size={34} aria-hidden="true" />
                    )}
                    <div>
                      <strong>{card.name}</strong>
                      <span>{card.label}</span>
                      <small>{card.detail}</small>
                    </div>
                    <ArrowIcon className="card-arrow" size={22} aria-hidden="true" />
                  </Component>
                );
              })}
            </div>
          </section>
        )}
      </section>

      {linksDrawerOpen && (
        <div
          className={`links-drawer-backdrop ${linksDrawerClosing ? 'is-closing' : 'is-opening'}`}
          role="presentation"
          onClick={closeLinksDrawer}
        >
          <aside
            className="links-drawer"
            aria-label="More links"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="links-drawer-header">
              <strong>More Links</strong>
              <button type="button" onClick={closeLinksDrawer} aria-label="Close links">
                <X size={19} aria-hidden="true" />
              </button>
            </div>
            <div className="links-drawer-grid">
              {supportCards.map((card) => {
                const Component = card.view ? 'button' : 'a';
                const Icon = card.icon;
                return (
                  <Component
                    className={`links-drawer-card ${card.className}`}
                    href={card.view ? undefined : card.url}
                    target={card.view ? undefined : '_blank'}
                    rel={card.view ? undefined : 'noreferrer'}
                    type={card.view ? 'button' : undefined}
                    onClick={card.view === 'vods' ? openVods : handleExternalLinkClick(card.url)}
                    key={card.name}
                  >
                    <span className="links-drawer-icon" aria-hidden="true">
                      {card.image ? (
                        <img src={card.image} alt="" />
                      ) : (
                        <Icon size={32} />
                      )}
                    </span>
                    <strong>{card.name}</strong>
                  </Component>
                );
              })}
            </div>
          </aside>
        </div>
      )}

      <nav className="mobile-tabs" aria-label="Mobile primary">
        <button className={view === 'home' ? 'active' : ''} type="button" onClick={goHome}>
          <Home size={21} aria-hidden="true" />
          <span>Home</span>
        </button>
        <button className={view === 'stream' && selectedStream === 'kick' ? 'active' : ''} type="button" onClick={() => openStream('kick')}>
          <span className="mobile-tab-icon">
            <Radio size={21} aria-hidden="true" />
            {liveStatus.kick && <span className="mobile-live-dot" aria-label="Kick is live" />}
          </span>
          <span>Kick</span>
        </button>
        <button className={view === 'stream' && selectedStream === 'twitch' ? 'active' : ''} type="button" onClick={() => openStream('twitch')}>
          <span className="mobile-tab-icon">
            <Tv size={21} aria-hidden="true" />
            {liveStatus.twitch && <span className="mobile-live-dot" aria-label="Twitch is live" />}
          </span>
          <span>Twitch</span>
        </button>
        <button className={view === 'vods' ? 'active' : ''} type="button" onClick={openVods}>
          <Video size={21} aria-hidden="true" />
          <span>VODs</span>
        </button>
        <button type="button" onClick={mobileMenuOpen ? closeMobileMenu : openMobileMenu}>
          <Ellipsis size={21} aria-hidden="true" />
          <span>More</span>
        </button>
      </nav>
    </main>
  );
}

function readStoredJson<T>(key: string, fallback: T): T {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function formatNotificationTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Unable to find app root element');
}

createRoot(rootElement).render(<App />);
