import { HeartHandshake, Info, MessageCircle, ShoppingBag, Video, X } from 'lucide-react';
import type { HeroSlide, LatestYoutubeVideo, SupportCard, YoutubeChannel } from '../types';
import { links } from './links';

export const supportCards: SupportCard[] = [
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

export const youtubeCards: YoutubeChannel[] = [
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

export const fallbackLatestVideos: LatestYoutubeVideo[] = [
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

export function createHeroSlides(latestVideos: LatestYoutubeVideo[]): HeroSlide[] {
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
