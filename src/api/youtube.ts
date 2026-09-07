import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { LatestYoutubeVideo, YoutubeChannel } from '../types';

export async function getLatestYoutubeVideo(
  channel: YoutubeChannel,
  fallback: LatestYoutubeVideo,
): Promise<LatestYoutubeVideo> {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`;

  try {
    const feedXml = await fetchYoutubeFeed(feedUrl);
    return parseLatestYoutubeVideo(feedXml, channel, fallback);
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

export function isYoutubeShortEntry(entry: Element): boolean {
  const url = entry.querySelector('link[rel="alternate"]')?.getAttribute('href') ?? '';
  return /youtube\.com\/shorts\//i.test(url);
}
