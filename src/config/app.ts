import type { NotificationPrefs } from '../types';

export const notificationStorageKey = 'wubhub-notifications';
export const notificationPrefsStorageKey = 'wubhub-notification-prefs';
export const defaultNotificationPrefs: NotificationPrefs = { kick: false, twitch: false };
export const liveStatusTestMode = new URLSearchParams(window.location.search).has('testStreams');
export const drawerAnimationMs = 260;
