import { defineConfig } from 'vite';
import type { Connect } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

type ViteDevServerLike = {
  middlewares: Connect.Server;
  httpServer?: {
    address(): AddressInfo | string | null;
  } | null;
};

function youtubeFeedProxy() {
  async function handleYoutubeFeedProxy(req: IncomingMessage, res: ServerResponse) {
    const requestUrl = new URL(req.url ?? '/', 'http://localhost');
    const channelId = requestUrl.searchParams.get('channel_id');

    if (!channelId || !/^[A-Za-z0-9_-]+$/.test(channelId)) {
      res.statusCode = 400;
      res.end('Invalid YouTube channel ID');
      return;
    }

    try {
      const upstream = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
        headers: {
          'User-Agent': req.headers['user-agent'] ?? 'WubHub',
        },
      });

      res.statusCode = upstream.status;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/xml; charset=utf-8');
      res.end(await upstream.text());
    } catch (error) {
      res.statusCode = 502;
      res.end(`YouTube feed proxy failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return {
    name: 'wubhub-youtube-feed-proxy',
    configureServer(server: ViteDevServerLike) {
      server.middlewares.use('/youtube-feed', handleYoutubeFeedProxy);
      server.middlewares.use('/youtube-videos', handleYoutubeVideosProxy);
    },
    configurePreviewServer(server: ViteDevServerLike) {
      server.middlewares.use('/youtube-feed', handleYoutubeFeedProxy);
      server.middlewares.use('/youtube-videos', handleYoutubeVideosProxy);
    },
  };
}

async function handleYoutubeVideosProxy(req: IncomingMessage, res: ServerResponse) {
  const requestUrl = new URL(req.url ?? '/', 'http://localhost');
  const targetUrl = requestUrl.searchParams.get('url');

  if (!targetUrl) {
    res.statusCode = 400;
    res.end('Missing YouTube videos URL');
    return;
  }

  let videosUrl: URL;

  try {
    videosUrl = new URL(targetUrl);
  } catch {
    res.statusCode = 400;
    res.end('Invalid YouTube videos URL');
    return;
  }

  if (
    !['www.youtube.com', 'youtube.com'].includes(videosUrl.hostname)
    || !videosUrl.pathname.startsWith('/@')
    || !videosUrl.pathname.endsWith('/videos')
  ) {
    res.statusCode = 400;
    res.end('Unsupported YouTube videos URL');
    return;
  }

  try {
    const upstream = await fetch(videosUrl, {
      headers: {
        'User-Agent': req.headers['user-agent'] ?? 'WubHub',
      },
    });

    res.statusCode = upstream.status;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'text/html; charset=utf-8');
    res.end(await upstream.text());
  } catch (error) {
    res.statusCode = 502;
    res.end(`YouTube videos proxy failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function kickHlsProxy() {
  async function handleKickHlsProxy(req: IncomingMessage, res: ServerResponse) {
    const requestUrl = new URL(req.url ?? '/', 'http://localhost');
    const targetUrl = requestUrl.searchParams.get('url');

    if (!targetUrl || !/^https:\/\/[^/]+\.live-video\.net\//i.test(targetUrl)) {
      res.statusCode = 400;
      res.end('Invalid Kick HLS URL');
      return;
    }

    try {
      const upstream = await fetch(targetUrl, {
        headers: {
          Origin: 'https://kick.com',
          Referer: 'https://kick.com/paymoneywubby',
          'User-Agent': req.headers['user-agent'] ?? 'WubHub',
        },
      });
      const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream';
      const body = Buffer.from(await upstream.arrayBuffer());

      res.statusCode = upstream.status;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', contentType);

      if (contentType.includes('mpegurl') || targetUrl.includes('.m3u8')) {
        const text = body.toString('utf8').replace(
          /^(https:\/\/[^\s#]+)$/gm,
          (url) => `/kick-hls?url=${encodeURIComponent(url)}`,
        );
        res.end(text);
        return;
      }

      res.end(body);
    } catch (error) {
      res.statusCode = 502;
      res.end(`Kick HLS proxy failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return {
    name: 'wubhub-kick-hls-proxy',
    configureServer(server: ViteDevServerLike) {
      server.middlewares.use('/kick-hls', handleKickHlsProxy);
    },
    configurePreviewServer(server: ViteDevServerLike) {
      server.middlewares.use('/kick-hls', handleKickHlsProxy);
    },
  };
}

export default defineConfig({
  plugins: [react(), youtubeFeedProxy(), kickHlsProxy()],
});
