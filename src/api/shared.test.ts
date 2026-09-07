import { describe, expect, it } from 'vitest';
import { formatViewerCount, normalizeViewerCount } from './shared';

describe('viewer count helpers', () => {
  it('normalizes numeric and compact string counts', () => {
    expect(normalizeViewerCount(1234.4)).toBe(1234);
    expect(normalizeViewerCount('1.2k viewers')).toBe(1200);
    expect(normalizeViewerCount('2.5M')).toBe(2500000);
  });

  it('rejects offline and invalid values', () => {
    expect(normalizeViewerCount('offline')).toBeNull();
    expect(normalizeViewerCount('not live')).toBeNull();
    expect(normalizeViewerCount(undefined)).toBeNull();
  });

  it('formats viewer counts for the stream cards', () => {
    expect(formatViewerCount(950)).toBe('950');
    expect(formatViewerCount(12500)).toBe('13K');
    expect(formatViewerCount(1250000)).toBe('1.3M');
  });
});
