# WubHub EventSub Backend

This is the option 3 path for closed-app live detection: Twitch tells this backend when Wubby goes live, then this backend can fan that out to device push notifications.

## Current Scope

- Receives Twitch EventSub `stream.online` webhook callbacks.
- Verifies Twitch signatures before accepting webhook bodies.
- Replies to Twitch's callback challenge.
- Pulls the current Twitch stream title for notification subtext.
- Sends the notification payload to `PUSH_WEBHOOK_URL` when configured, or logs it while push delivery is still being wired.

This does not yet register phones or TVs for FCM/APNs push tokens. The mobile app still uses local notifications while it is running.

## Required Environment

```powershell
$env:TWITCH_CLIENT_ID = "your Twitch app client id"
$env:TWITCH_CLIENT_SECRET = "your Twitch app client secret"
$env:TWITCH_EVENTSUB_SECRET = "a random 10-100 character secret"
$env:PUBLIC_CALLBACK_URL = "https://your-public-domain.example"
```

Optional:

```powershell
$env:TWITCH_BROADCASTER_LOGIN = "paymoneywubby"
$env:TWITCH_BROADCASTER_ID = "broadcaster numeric id"
$env:PUSH_WEBHOOK_URL = "https://your-push-worker.example/live"
$env:PORT = "8787"
```

## Run Locally

```powershell
npm run eventsub:server
```

Health check:

```powershell
curl.exe http://localhost:8787/health
```

## Register Twitch Webhook

Your callback must be publicly reachable over HTTPS. For local testing, use a tunnel such as ngrok or Cloudflare Tunnel and set `PUBLIC_CALLBACK_URL` to that HTTPS origin.

```powershell
npm run eventsub:subscribe:twitch
```

The helper subscribes to Twitch `stream.online` for `paymoneywubby` by default and uses:

```text
https://your-public-domain.example/eventsub/twitch
```

## Kick

Kick is still handled by the app's live-status polling. If Kick exposes a stable official webhook later, it can be added beside the Twitch EventSub receiver. Until then, the next reliable closed-app path is a small backend poller that checks Kick and sends push when it changes from offline to live.
