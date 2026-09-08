// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import type { LatestYoutubeVideo, YoutubeChannel } from '../types';
import { parseLatestYoutubeVideo, parseLatestYoutubeVideosPage } from './youtube';

const channel: YoutubeChannel = {
  name: 'Wubby Highlights',
  url: 'https://www.youtube.com/@PaymoneyWubbyHighlights',
  detail: 'Latest uploads',
  image: '/assets/highlights.png',
  banner: '/assets/highlights-banner.png',
  channelId: 'UC1',
  className: 'highlights',
};

const fallback: LatestYoutubeVideo = {
  channelName: channel.name,
  title: 'Fallback',
  url: channel.url,
  image: channel.banner,
  channelImage: channel.image,
  className: channel.className,
};

describe('YouTube adapter helpers', () => {
  it('uses the latest non-shorts video', () => {
    const parsed = parseLatestYoutubeVideo(
      `
        <feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
          <entry>
            <yt:videoId>short1</yt:videoId>
            <title>Short video</title>
            <link rel="alternate" href="https://www.youtube.com/shorts/short1" />
            <media:group><media:thumbnail url="https://img.youtube.com/vi/short1/hqdefault.jpg" /></media:group>
          </entry>
          <entry>
            <yt:videoId>video1</yt:videoId>
            <title>Latest upload</title>
            <link rel="alternate" href="https://www.youtube.com/watch?v=video1" />
            <media:group><media:thumbnail url="https://img.youtube.com/vi/video1/hqdefault.jpg" /></media:group>
          </entry>
        </feed>
      `,
      channel,
      fallback,
    );

    expect(parsed).toEqual({
      channelName: 'Wubby Highlights',
      title: 'Latest upload',
      url: 'https://www.youtube.com/watch?v=video1',
      image: 'https://img.youtube.com/vi/video1/hqdefault.jpg',
      channelImage: channel.image,
      className: channel.className,
    });
  });

  it('falls back when the feed is empty or malformed', () => {
    expect(parseLatestYoutubeVideo('<feed />', channel, fallback)).toBe(fallback);
    expect(parseLatestYoutubeVideo('not xml', channel, fallback)).toBe(fallback);
  });

  it('parses the latest regular video from the channel videos page', () => {
    const parsed = parseLatestYoutubeVideosPage(
      `
        <script>
          var ytInitialData = {
            "contents": {
              "richGridRenderer": {
                "contents": [
                  {
                    "richItemRenderer": {
                      "content": {
                        "lockupViewModel": {
                          "contentId": "video2",
                          "metadata": {
                            "lockupMetadataViewModel": {
                              "title": { "content": "Latest regular upload" }
                            }
                          },
                          "contentImage": {
                            "thumbnailViewModel": {
                              "image": {
                                "sources": [
                                  { "url": "https://i.ytimg.com/vi/video2/hqdefault.jpg", "width": 480 },
                                  { "url": "https://i.ytimg.com/vi/video2/hq720.jpg", "width": 720 }
                                ]
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                ]
              }
            }
          };
        </script>
      `,
      channel,
      fallback,
    );

    expect(parsed).toEqual({
      channelName: 'Wubby Highlights',
      title: 'Latest regular upload',
      url: 'https://www.youtube.com/watch?v=video2',
      image: 'https://i.ytimg.com/vi/video2/hq720.jpg',
      channelImage: channel.image,
      className: channel.className,
    });
  });
});
