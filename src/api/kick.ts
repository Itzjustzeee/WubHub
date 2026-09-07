import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { LiveStatusDetails } from '../types';
import { asRecord, extractStringCandidate, normalizeViewerCount, readPath } from './shared';

export async function getKickLiveStatus(): Promise<LiveStatusDetails> {
  const data = await requestKickJson('https://kick.com/api/v2/channels/paymoneywubby');
  const livestream = readPath(data, ['livestream']);
  const isLive = Boolean(readPath(data, ['livestream', 'is_live']) ?? livestream);
  let title = extractKickStreamTitle(data);
  let category = extractKickStreamCategory(data);
  let viewers = extractKickViewerCount(data);

  if (isLive && (!title || !category || viewers === null)) {
    try {
      const livestreamData = await requestKickJson('https://kick.com/api/v2/channels/paymoneywubby/livestream');
      title = extractKickStreamTitle(livestreamData);
      category = category || extractKickStreamCategory(livestreamData);
      viewers = viewers ?? extractKickViewerCount(livestreamData);
    } catch {
      // The channel response is enough for live status if the title endpoint is unavailable.
    }
  }

  return { isLive, title, category, viewers };
}

export async function getKickPlaybackUrl(): Promise<string> {
  const playbackResponse = await requestKickJson('https://kick.com/api/v2/channels/paymoneywubby/playback-url');
  const directUrl = extractKickPlaybackUrl(playbackResponse);

  if (directUrl) {
    return directUrl;
  }

  const channelResponse = await requestKickJson('https://kick.com/api/v2/channels/paymoneywubby');
  return extractKickPlaybackUrl(channelResponse);
}

async function requestKickJson(url: string): Promise<unknown> {
  const headers = {
    Accept: 'application/json, text/plain, */*',
    'X-Requested-With': 'XMLHttpRequest',
  };

  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({
      url,
      headers,
      params: { _: String(Date.now()) },
    });

    if (response.status >= 200 && response.status < 300 && response.data) {
      return typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    }

    throw new Error('Unable to load Kick response');
  }

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers,
    });

    if (response.ok) {
      return response.json();
    }
  } catch {
    // Browser preview can be blocked by CORS; the proxy keeps local preview usable.
  }

  const proxyResponse = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, {
    cache: 'no-store',
  });

  if (!proxyResponse.ok) {
    throw new Error('Unable to load Kick response');
  }

  return proxyResponse.json();
}

export function extractKickPlaybackUrl(payload: unknown): string {
  if (typeof payload === 'string') {
    return payload.includes('.m3u8') ? payload : '';
  }

  const candidates = [
    readPath(payload, ['data']),
    readPath(payload, ['playback_url']),
    readPath(payload, ['livestream', 'playback_url']),
    readPath(payload, ['streamer_channel', 'playback_url']),
    readPath(payload, ['user', 'streamer_channel', 'playback_url']),
  ];

  const playbackUrl = candidates
    .map(extractStringCandidate)
    .find((candidate) => candidate.includes('.m3u8'));
  return playbackUrl ?? '';
}

export function extractKickStreamTitle(payload: unknown): string {
  const candidates = [
    readPath(payload, ['session_title']),
    readPath(payload, ['title']),
    readPath(payload, ['livestream', 'session_title']),
    readPath(payload, ['livestream', 'title']),
    readPath(payload, ['recent_livestream', 'session_title']),
    readPath(payload, ['recent_livestream', 'title']),
    readPath(payload, ['data', 'session_title']),
    readPath(payload, ['data', 'title']),
    readPath(payload, ['data', 'livestream', 'session_title']),
    readPath(payload, ['data', 'livestream', 'title']),
  ];

  return candidates.map(extractStringCandidate).find(Boolean) ?? '';
}

export function extractKickStreamCategory(payload: unknown): string {
  const categories = [
    readPath(payload, ['livestream', 'category']),
    readPath(payload, ['livestream', 'categories', '0']),
    readPath(payload, ['category']),
    readPath(payload, ['categories', '0']),
    readPath(payload, ['data', 'livestream', 'category']),
    readPath(payload, ['data', 'livestream', 'categories', '0']),
    readPath(payload, ['data', 'category']),
    readPath(payload, ['data', 'categories', '0']),
  ];

  const category = categories
    .map((candidate) => {
      if (typeof candidate === 'string') {
        return candidate;
      }

      const record = asRecord(candidate);
      return extractStringCandidate(record.name ?? record.title ?? record.slug);
    })
    .find((candidate) => typeof candidate === 'string' && candidate.trim());

  return category?.trim() ?? '';
}

export function extractKickViewerCount(payload: unknown): number | null {
  const candidates = [
    readPath(payload, ['livestream', 'viewer_count']),
    readPath(payload, ['livestream', 'viewers_count']),
    readPath(payload, ['livestream', 'viewers']),
    readPath(payload, ['viewer_count']),
    readPath(payload, ['viewers_count']),
    readPath(payload, ['viewers']),
    readPath(payload, ['data', 'livestream', 'viewer_count']),
    readPath(payload, ['data', 'livestream', 'viewers_count']),
    readPath(payload, ['data', 'livestream', 'viewers']),
    readPath(payload, ['data', 'viewer_count']),
    readPath(payload, ['data', 'viewers_count']),
    readPath(payload, ['data', 'viewers']),
  ];

  return normalizeViewerCount(candidates.find((candidate) => candidate !== undefined && candidate !== null));
}

export function getPlayableKickPlaybackUrl(playbackUrl: string): string {
  if (Capacitor.getPlatform() === 'ios') {
    return playbackUrl;
  }

  return `/kick-hls?url=${encodeURIComponent(playbackUrl)}`;
}

export function getKickPlaybackExpiryMs(playbackUrl: string): number {
  try {
    const token = new URL(playbackUrl).searchParams.get('token');
    const payload = token?.split('.')[1];

    if (!payload) {
      return 0;
    }

    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      '=',
    );
    const parsedPayload = JSON.parse(atob(paddedPayload));

    return typeof parsedPayload.exp === 'number' ? parsedPayload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}
