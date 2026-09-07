import { describe, expect, it } from 'vitest';
import { parseTwitchGraphqlLiveStatus } from './twitch';

describe('Twitch adapter helpers', () => {
  it('parses live GraphQL stream details', () => {
    const status = parseTwitchGraphqlLiveStatus({
      data: {
        user: {
          stream: {
            title: '  Live stream title ',
            viewersCount: 4200,
            game: { name: 'Just Chatting' },
          },
        },
      },
    });

    expect(status).toEqual({
      isLive: true,
      title: 'Live stream title',
      category: 'Just Chatting',
      viewers: 4200,
    });
  });

  it('parses offline and missing users safely', () => {
    expect(parseTwitchGraphqlLiveStatus({ data: { user: { stream: null } } })).toEqual({
      isLive: false,
      title: '',
      category: '',
      viewers: null,
    });
    expect(parseTwitchGraphqlLiveStatus({ data: { user: null } })).toBeNull();
  });
});
