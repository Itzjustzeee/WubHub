import { HeartHandshake, Home, Info, MessageCircle, Radio, Settings, ShoppingBag, Tv, Video } from 'lucide-react';
import { YoutubeIcon } from '../components/YoutubeIcon';
import type { MobileMoreAction, NavGroup } from '../types';
import { links } from './links';

export const navGroups: NavGroup[] = [
  {
    label: 'Watch',
    items: [
      { type: 'button', id: 'home', label: 'Home', icon: Home },
      { type: 'stream', id: 'kick', label: 'Kick', icon: Radio },
      { type: 'stream', id: 'twitch', label: 'Twitch', icon: Tv },
      { type: 'vods', id: 'vodArchive', label: 'VODs', icon: Video },
      { type: 'link', id: 'patreon', label: 'Green Room', icon: HeartHandshake, href: links.patreon },
    ],
  },
  {
    label: 'YouTube',
    items: [
      { type: 'link', id: 'highlights', label: 'Highlights', icon: YoutubeIcon, href: links.highlights },
      { type: 'link', id: 'clips', label: 'Wubby Clips', icon: YoutubeIcon, href: links.clips },
      { type: 'link', id: 'magicMonday', label: 'Magic Monday', icon: YoutubeIcon, href: links.magicMonday },
    ],
  },
  {
    label: 'Community',
    items: [
      { type: 'link', id: 'discord', label: 'Discord', icon: MessageCircle, href: links.discord },
      { type: 'link', id: 'subreddit', label: 'Subreddit', icon: MessageCircle, href: links.subreddit },
      { type: 'link', id: 'x', label: 'Twitter/X', icon: MessageCircle, href: links.x },
    ],
  },
  {
    label: 'Merch',
    items: [
      { type: 'link', id: 'shop', label: 'pmw.store', icon: ShoppingBag, href: links.shop },
    ],
  },
];

export const mobileMoreActions: MobileMoreAction[] = [
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'about', label: 'About', icon: Info },
  { id: 'contact', label: 'Contact me', icon: MessageCircle },
];
