import { useEffect, useRef, useState } from 'react';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { HttpResponse, HttpResponseType } from '@capacitor/core';
import Hls from 'hls.js';
import type {
  Loader,
  LoaderCallbacks,
  LoaderConfiguration,
  LoaderContext,
  LoaderResponse,
  LoaderStats,
} from 'hls.js';
import { getPlayableKickPlaybackUrl } from '../api/kick';
import { links } from '../config/links';
import { hlsBufferThresholds } from '../config/streams';
import { NativeOrientation } from '../native/plugins';
import type { HlsLevel, HlsVideoProps, KickPlayerProps } from '../types';

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

export function KickPlayer({
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
