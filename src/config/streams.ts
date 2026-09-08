import type { LiveDetailsMap, LiveStatusDetails, LiveStatusMap, MediaPlayer, StreamId } from '../types';
import { links } from './links';

export function getTwitchParent() {
  return window.location.hostname || 'localhost';
}

export function createStreamChats(twitchParent: string): Record<StreamId, string> {
  return {
    kick: 'https://chat.kick.cx/embed/paymoneywubby',
    twitch: `https://www.twitch.tv/embed/paymoneywubby/chat?parent=${encodeURIComponent(twitchParent)}&darkpopout`,
  };
}

export function createMediaPlayers(twitchParent: string): MediaPlayer[] {
  return [
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
}

export function createInitialLiveStatus(mediaPlayers: MediaPlayer[]): LiveStatusMap {
  return mediaPlayers.reduce<LiveStatusMap>(
    (status, player) => ({ ...status, [player.id]: false }),
    { kick: false, twitch: false },
  );
}

export function createInitialLiveDetails(mediaPlayers: MediaPlayer[]): LiveDetailsMap {
  return mediaPlayers.reduce<LiveDetailsMap>(
    (details, player) => ({ ...details, [player.id]: { title: '', category: '', viewers: null } }),
    {
      kick: { title: '', category: '', viewers: null },
      twitch: { title: '', category: '', viewers: null },
    },
  );
}

export const testLiveDetails: Record<StreamId, LiveStatusDetails> = {
  kick: { isLive: true, title: 'Test Kick stream', category: 'Just Chatting', viewers: 12842 },
  twitch: { isLive: true, title: 'Test Twitch stream', category: 'Magic: The Gathering', viewers: 9317 },
};

export const hlsBufferThresholds = {
  critical: 8,
  low: 16,
  healthy: 35,
  restoreCooldownMs: 18000,
};
