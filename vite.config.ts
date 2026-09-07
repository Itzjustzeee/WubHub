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
  plugins: [react(), kickHlsProxy()],
});
