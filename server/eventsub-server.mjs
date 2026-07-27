import crypto from 'node:crypto';
import http from 'node:http';

const port = Number(process.env.PORT || 8787);
const eventsubSecret = process.env.TWITCH_EVENTSUB_SECRET || '';
const pushWebhookUrl = process.env.PUSH_WEBHOOK_URL || '';
const broadcasterLogin = process.env.TWITCH_BROADCASTER_LOGIN || 'paymoneywubby';
const recentMessageIds = new Map();

const headers = {
  messageId: 'twitch-eventsub-message-id',
  messageTimestamp: 'twitch-eventsub-message-timestamp',
  messageSignature: 'twitch-eventsub-message-signature',
  messageType: 'twitch-eventsub-message-type',
  subscriptionType: 'twitch-eventsub-subscription-type',
};

const messageTypes = {
  verification: 'webhook_callback_verification',
  notification: 'notification',
  revocation: 'revocation',
};

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/health') {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === 'POST' && request.url === '/eventsub/twitch') {
      await handleTwitchEventSub(request, response);
      return;
    }

    sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: 'Server error' });
  }
});

server.listen(port, () => {
  console.log(`WubHub EventSub server listening on http://localhost:${port}`);
});

async function handleTwitchEventSub(request, response) {
  const rawBody = await readRequestBody(request);

  if (!eventsubSecret) {
    sendJson(response, 500, { error: 'TWITCH_EVENTSUB_SECRET is not configured' });
    return;
  }

  if (!verifyTwitchSignature(request.headers, rawBody)) {
    sendJson(response, 403, { error: 'Invalid Twitch signature' });
    return;
  }

  const messageId = request.headers[headers.messageId];
  if (isDuplicateMessage(messageId)) {
    response.writeHead(204);
    response.end();
    return;
  }

  const payload = JSON.parse(rawBody.toString('utf8'));
  const messageType = request.headers[headers.messageType];

  if (messageType === messageTypes.verification) {
    response.writeHead(200, {
      'Content-Type': 'text/plain',
      'Content-Length': Buffer.byteLength(payload.challenge),
    });
    response.end(payload.challenge);
    return;
  }

  response.writeHead(204);
  response.end();

  if (messageType === messageTypes.revocation) {
    console.warn('Twitch EventSub subscription revoked:', payload.subscription?.status);
    return;
  }

  if (messageType === messageTypes.notification && request.headers[headers.subscriptionType] === 'stream.online') {
    const streamTitle = await getTwitchStreamTitle(payload.event?.broadcaster_user_id);
    await sendPushNotification({
      platform: 'Twitch',
      title: 'Wubby is now live on Twitch',
      body: streamTitle || 'Live now on Twitch.',
      event: payload.event,
    });
  }
}

function verifyTwitchSignature(headersMap, rawBody) {
  const signature = headersMap[headers.messageSignature];
  const messageId = headersMap[headers.messageId];
  const timestamp = headersMap[headers.messageTimestamp];

  if (!signature || !messageId || !timestamp) {
    return false;
  }

  const message = Buffer.concat([
    Buffer.from(messageId),
    Buffer.from(timestamp),
    rawBody,
  ]);
  const expectedSignature = `sha256=${crypto.createHmac('sha256', eventsubSecret).update(message).digest('hex')}`;

  return timingSafeEqual(expectedSignature, signature);
}

function timingSafeEqual(a, b) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  return aBuffer.length === bBuffer.length && crypto.timingSafeEqual(aBuffer, bBuffer);
}

function isDuplicateMessage(messageId) {
  if (!messageId) {
    return false;
  }

  const now = Date.now();
  for (const [id, timestamp] of recentMessageIds) {
    if (now - timestamp > 10 * 60 * 1000) {
      recentMessageIds.delete(id);
    }
  }

  if (recentMessageIds.has(messageId)) {
    return true;
  }

  recentMessageIds.set(messageId, now);
  return false;
}

async function getTwitchStreamTitle(broadcasterUserId) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return '';
  }

  const token = await getTwitchAppAccessToken(clientId, clientSecret);
  const searchParams = new URLSearchParams();

  if (broadcasterUserId) {
    searchParams.set('user_id', broadcasterUserId);
  } else {
    searchParams.set('user_login', broadcasterLogin);
  }

  const response = await fetch(`https://api.twitch.tv/helix/streams?${searchParams}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Client-Id': clientId,
    },
  });

  if (!response.ok) {
    return '';
  }

  const data = await response.json();
  return data.data?.[0]?.title || '';
}

async function getTwitchAppAccessToken(clientId, clientSecret) {
  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    throw new Error(`Unable to create Twitch app token: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function sendPushNotification(notification) {
  if (!pushWebhookUrl) {
    console.log('Push webhook not configured. Notification payload:', notification);
    return;
  }

  const response = await fetch(pushWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(notification),
  });

  if (!response.ok) {
    throw new Error(`Push webhook failed: ${response.status}`);
  }
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  response.end(body);
}
