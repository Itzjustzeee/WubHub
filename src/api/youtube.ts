import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { LatestYoutubeVideo, YoutubeChannel } from '../types';

export async function getLatestYoutubeVideo(
  channel: YoutubeChannel,
  fallback: LatestYoutubeVideo,
): Promise<LatestYoutubeVideo> {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`;

  try {
    const feedXml = await fetchYoutubeFeed(feedUrl);
    const feedVideo = parseLatestYoutubeVideo(feedXml, channel, fallback);

    if (feedVideo !== fallback) {
      return feedVideo;
    }
  } catch {
    // Fall through to the channel videos page, which is better when RSS is filled with Shorts.
  }

  try {
    const videosPageHtml = await fetchYoutubeVideosPage(channel.url);
    return parseLatestYoutubeVideosPage(videosPageHtml, channel, fallback);
  } catch {
    return fallback;
  }
}

async function fetchYoutubeFeed(feedUrl: string): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({ url: feedUrl });

    if (response.status >= 200 && response.status < 300 && response.data) {
      return typeof response.data === 'string' ? response.data : String(response.data);
    }

    throw new Error('Unable to load YouTube feed');
  }

  try {
    const proxiedResponse = await fetch(`/youtube-feed?channel_id=${encodeURIComponent(new URL(feedUrl).searchParams.get('channel_id') ?? '')}`, {
      cache: 'no-store',
    });

    if (proxiedResponse.ok) {
      return proxiedResponse.text();
    }
  } catch {
    // Vite dev/preview can provide a same-origin RSS proxy for local testing.
  }

  try {
    const response = await fetch(feedUrl, { cache: 'no-store' });

    if (response.ok) {
      return response.text();
    }
  } catch {
    // YouTube RSS often blocks browser preview through CORS.
  }

  const proxyResponse = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`, {
    cache: 'no-store',
  });

  if (!proxyResponse.ok) {
    throw new Error('Unable to load YouTube feed');
  }

  return proxyResponse.text();
}

async function fetchYoutubeVideosPage(channelUrl: string): Promise<string> {
  const videosUrl = `${channelUrl.replace(/\/$/, '')}/videos`;

  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({ url: videosUrl });

    if (response.status >= 200 && response.status < 300 && response.data) {
      return typeof response.data === 'string' ? response.data : String(response.data);
    }

    throw new Error('Unable to load YouTube videos page');
  }

  try {
    const proxiedResponse = await fetch(`/youtube-videos?url=${encodeURIComponent(videosUrl)}`, {
      cache: 'no-store',
    });

    if (proxiedResponse.ok) {
      return proxiedResponse.text();
    }
  } catch {
    // Vite dev/preview can provide a same-origin videos page proxy for local testing.
  }

  const proxyResponse = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(videosUrl)}`, {
    cache: 'no-store',
  });

  if (!proxyResponse.ok) {
    throw new Error('Unable to load YouTube videos page');
  }

  return proxyResponse.text();
}

export function parseLatestYoutubeVideo(
  feedXml: string,
  channel: YoutubeChannel,
  fallback: LatestYoutubeVideo,
): LatestYoutubeVideo {
  const document = new DOMParser().parseFromString(feedXml, 'application/xml');
  const entries = Array.from(document.querySelectorAll('entry'));

  if (entries.length === 0 || document.querySelector('parsererror')) {
    return fallback;
  }

  const entry = entries.find((feedEntry) => !isYoutubeShortEntry(feedEntry));

  if (!entry) {
    return fallback;
  }

  const videoId = entry.getElementsByTagName('yt:videoId')[0]?.textContent?.trim();
  const title = entry.querySelector('title')?.textContent?.trim();
  const url = entry.querySelector('link[rel="alternate"]')?.getAttribute('href');
  const thumbnail = entry.getElementsByTagName('media:thumbnail')[0]?.getAttribute('url');

  if (!videoId || !title || !url || !thumbnail) {
    return fallback;
  }

  return {
    channelName: channel.name,
    title,
    url,
    image: thumbnail,
    channelImage: channel.image,
    className: channel.className,
  };
}

export function parseLatestYoutubeVideosPage(
  pageHtml: string,
  channel: YoutubeChannel,
  fallback: LatestYoutubeVideo,
): LatestYoutubeVideo {
  const initialData = parseYtInitialData(pageHtml);

  if (!initialData) {
    return fallback;
  }

  for (const lockup of findLockupViewModels(initialData)) {
    const videoId = typeof lockup.contentId === 'string' ? lockup.contentId : '';
    const title = readLockupTitle(lockup);
    const thumbnail = readLockupThumbnail(lockup);

    if (videoId && title && thumbnail) {
      return {
        channelName: channel.name,
        title,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        image: thumbnail,
        channelImage: channel.image,
        className: channel.className,
      };
    }
  }

  return fallback;
}

export function isYoutubeShortEntry(entry: Element): boolean {
  const url = entry.querySelector('link[rel="alternate"]')?.getAttribute('href') ?? '';
  return /youtube\.com\/shorts\//i.test(url);
}

type JsonValue = JsonRecord | JsonValue[] | string | number | boolean | null;

type JsonRecord = {
  [key: string]: JsonValue;
};

function parseYtInitialData(pageHtml: string): JsonRecord | null {
  const marker = 'var ytInitialData = ';
  const startIndex = pageHtml.indexOf(marker);

  if (startIndex < 0) {
    return null;
  }

  const jsonStart = startIndex + marker.length;
  const jsonEnd = findJsonObjectEnd(pageHtml, jsonStart);

  if (jsonEnd < 0) {
    return null;
  }

  try {
    const data = JSON.parse(pageHtml.slice(jsonStart, jsonEnd)) as unknown;
    return isJsonRecord(data) ? data : null;
  } catch {
    return null;
  }
}

function findJsonObjectEnd(source: string, startIndex: number) {
  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const character = source[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (character === '\\') {
        isEscaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }
  }

  return -1;
}

function findLockupViewModels(value: JsonValue): JsonRecord[] {
  if (Array.isArray(value)) {
    return value.flatMap(findLockupViewModels);
  }

  if (!isJsonRecord(value)) {
    return [];
  }

  const lockups: JsonRecord[] = [];
  const lockup = value.lockupViewModel;

  if (isJsonRecord(lockup)) {
    lockups.push(lockup);
  }

  return lockups.concat(Object.values(value).flatMap(findLockupViewModels));
}

function readLockupTitle(lockup: JsonRecord) {
  const metadata = lockup.metadata;

  if (!isJsonRecord(metadata)) {
    return '';
  }

  const viewModel = metadata.lockupMetadataViewModel;

  if (!isJsonRecord(viewModel)) {
    return '';
  }

  const title = viewModel.title;

  if (!isJsonRecord(title)) {
    return '';
  }

  return typeof title.content === 'string' ? title.content.trim() : '';
}

function readLockupThumbnail(lockup: JsonRecord) {
  const contentImage = lockup.contentImage;

  if (!isJsonRecord(contentImage)) {
    return '';
  }

  const thumbnailViewModel = contentImage.thumbnailViewModel;

  if (!isJsonRecord(thumbnailViewModel)) {
    return '';
  }

  const image = thumbnailViewModel.image;

  if (!isJsonRecord(image) || !Array.isArray(image.sources)) {
    return '';
  }

  const sources = image.sources.filter(isJsonRecord);
  const largestSource = sources[sources.length - 1];

  return typeof largestSource?.url === 'string' ? largestSource.url : '';
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
