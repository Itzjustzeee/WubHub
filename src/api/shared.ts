import type { JsonRecord } from '../types';

export function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? value as JsonRecord : {};
}

export function readPath(payload: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => asRecord(current)[key], payload);
}

export function extractStringCandidate(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeViewerCount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || /offline|not live|does not exist/i.test(trimmed)) {
    return null;
  }

  const compactMatch = trimmed.match(/([\d,.]+)\s*([kmb])?/i);
  if (!compactMatch) {
    return null;
  }

  const numeric = Number(compactMatch[1].replace(/,/g, ''));
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const multiplier = {
    k: 1000,
    m: 1000000,
    b: 1000000000,
  }[compactMatch[2]?.toLowerCase()] ?? 1;

  return Math.max(0, Math.round(numeric * multiplier));
}

export function formatViewerCount(value: unknown): string {
  const count = normalizeViewerCount(value);

  if (count === null) {
    return '';
  }

  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(count >= 10000000 ? 0 : 1)}M`;
  }

  if (count >= 1000) {
    return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K`;
  }

  return count.toLocaleString();
}
