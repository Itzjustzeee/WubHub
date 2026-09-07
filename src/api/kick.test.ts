import { describe, expect, it } from 'vitest';
import {
  extractKickPlaybackUrl,
  extractKickStreamCategory,
  extractKickStreamTitle,
  extractKickViewerCount,
  getKickPlaybackExpiryMs,
} from './kick';

describe('Kick adapter helpers', () => {
  it('extracts playback urls from known response shapes', () => {
    expect(extractKickPlaybackUrl('https://example.com/master.m3u8?token=abc')).toContain('.m3u8');
    expect(extractKickPlaybackUrl({ data: 'https://example.com/live.m3u8' })).toBe('https://example.com/live.m3u8');
    expect(extractKickPlaybackUrl({ livestream: { playback_url: 'https://example.com/stream.m3u8' } })).toBe(
      'https://example.com/stream.m3u8',
    );
  });

  it('extracts stream metadata from channel and livestream payloads', () => {
    const payload = {
      livestream: {
        session_title: '  Stream title  ',
        category: { name: 'Just Chatting' },
        viewer_count: '12,345',
      },
    };

    expect(extractKickStreamTitle(payload)).toBe('Stream title');
    expect(extractKickStreamCategory(payload)).toBe('Just Chatting');
    expect(extractKickViewerCount(payload)).toBe(12345);
  });

  it('reads playback token expiry without throwing for invalid urls', () => {
    const encodedPayload = Buffer.from(JSON.stringify({ exp: 1234 })).toString('base64url');
    const playbackUrl = `https://example.com/live.m3u8?token=header.${encodedPayload}.signature`;

    expect(getKickPlaybackExpiryMs(playbackUrl)).toBe(1234000);
    expect(getKickPlaybackExpiryMs('not a url')).toBe(0);
  });
});
