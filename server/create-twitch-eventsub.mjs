const clientId = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;
const eventsubSecret = process.env.TWITCH_EVENTSUB_SECRET;
const publicCallbackUrl = process.env.PUBLIC_CALLBACK_URL;
const broadcasterLogin = process.env.TWITCH_BROADCASTER_LOGIN || 'paymoneywubby';
const configuredBroadcasterId = process.env.TWITCH_BROADCASTER_ID || '';

if (!clientId || !clientSecret || !eventsubSecret || !publicCallbackUrl) {
  console.error([
    'Missing required environment variables.',
    'Required: TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_EVENTSUB_SECRET, PUBLIC_CALLBACK_URL',
    'Optional: TWITCH_BROADCASTER_ID, TWITCH_BROADCASTER_LOGIN',
  ].join('\n'));
  process.exit(1);
}

if (eventsubSecret.length < 10 || eventsubSecret.length > 100) {
  console.error('TWITCH_EVENTSUB_SECRET must be 10 to 100 ASCII characters.');
  process.exit(1);
}

const callback = new URL('/eventsub/twitch', publicCallbackUrl).toString();

try {
  const token = await getTwitchAppAccessToken();
  const broadcasterId = configuredBroadcasterId || await getBroadcasterId(token);
  const subscription = await createStreamOnlineSubscription(token, broadcasterId);

  console.log(JSON.stringify({
    callback,
    broadcasterId,
    subscription,
  }, null, 2));
} catch (error) {
  console.error(error);
  process.exit(1);
}

async function getTwitchAppAccessToken() {
  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Unable to create Twitch app token: ${response.status} ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

async function getBroadcasterId(token) {
  const response = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(broadcasterLogin)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Client-Id': clientId,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Unable to look up broadcaster: ${response.status} ${JSON.stringify(data)}`);
  }

  const broadcasterId = data.data?.[0]?.id;
  if (!broadcasterId) {
    throw new Error(`No Twitch broadcaster found for login "${broadcasterLogin}".`);
  }

  return broadcasterId;
}

async function createStreamOnlineSubscription(token, broadcasterId) {
  const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Client-Id': clientId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'stream.online',
      version: '1',
      condition: {
        broadcaster_user_id: broadcasterId,
      },
      transport: {
        method: 'webhook',
        callback,
        secret: eventsubSecret,
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Unable to create EventSub subscription: ${response.status} ${JSON.stringify(data)}`);
  }

  return data;
}
