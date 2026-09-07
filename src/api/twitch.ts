import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { LiveStatusDetails, TwitchGraphqlResponse } from '../types';
import { normalizeViewerCount } from './shared';

const twitchGraphqlClientId = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

export async function getTwitchLiveStatus(): Promise<LiveStatusDetails> {
  try {
    const graphStatus = await getTwitchGraphqlLiveStatus();
    if (graphStatus) {
      return graphStatus;
    }
  } catch {
    // DecAPI is kept as a fallback because Twitch can change its public GraphQL surface.
  }

  const response = await fetch('https://decapi.me/twitch/uptime/paymoneywubby?offline_msg=offline', {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Unable to load Twitch status');
  }

  const text = (await response.text()).trim();
  const isLive = !/^offline$/i.test(text) && !/offline|not live|does not exist/i.test(text);

  if (!isLive) {
    return { isLive, title: '', category: '', viewers: null };
  }

  let title = '';
  let category = '';
  let viewers = null;

  try {
    const titleResponse = await fetch('https://decapi.me/twitch/title/paymoneywubby', {
      cache: 'no-store',
    });

    if (titleResponse.ok) {
      title = (await titleResponse.text()).trim();
    }
  } catch {
    // Live status still works if the title lookup fails.
  }

  try {
    const categoryResponse = await fetch('https://decapi.me/twitch/game/paymoneywubby', {
      cache: 'no-store',
    });

    if (categoryResponse.ok) {
      category = (await categoryResponse.text()).trim();
    }
  } catch {
    // Category is optional UI detail.
  }

  try {
    const viewerResponse = await fetch('https://decapi.me/twitch/viewercount/paymoneywubby', {
      cache: 'no-store',
    });

    if (viewerResponse.ok) {
      viewers = normalizeViewerCount(await viewerResponse.text());
    }
  } catch {
    // Viewer count is optional UI detail.
  }

  return { isLive, title, category, viewers };
}

async function getTwitchGraphqlLiveStatus(): Promise<LiveStatusDetails | null> {
  const payload = {
    operationName: 'WubHubChannelLiveStatus',
    variables: { login: 'paymoneywubby' },
    query: `
      query WubHubChannelLiveStatus($login: String!) {
        user(login: $login) {
          id
          login
          stream {
            id
            title
            type
            createdAt
            viewersCount
            game {
              name
            }
          }
        }
      }
    `,
  };
  let data: unknown;

  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.post({
      url: 'https://gql.twitch.tv/gql',
      headers: {
        'Client-ID': twitchGraphqlClientId,
        'Content-Type': 'application/json',
      },
      data: payload,
    });

    if (response.status < 200 || response.status >= 300 || !response.data) {
      throw new Error('Unable to load Twitch GraphQL status');
    }

    data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
  } else {
    const response = await fetch('https://gql.twitch.tv/gql', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Client-ID': twitchGraphqlClientId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Unable to load Twitch GraphQL status');
    }

    data = await response.json();
  }

  return parseTwitchGraphqlLiveStatus(data);
}

export function parseTwitchGraphqlLiveStatus(data: unknown): LiveStatusDetails | null {
  const response = Array.isArray(data) ? data[0] as TwitchGraphqlResponse | undefined : data as TwitchGraphqlResponse;
  const user = response?.data?.user;

  if (!user) {
    return null;
  }

  const stream = user.stream;
  if (!stream) {
    return { isLive: false, title: '', category: '', viewers: null };
  }

  return {
    isLive: true,
    title: typeof stream.title === 'string' ? stream.title.trim() : '',
    category: typeof stream.game?.name === 'string' ? stream.game.name.trim() : '',
    viewers: normalizeViewerCount(stream.viewersCount),
  };
}
