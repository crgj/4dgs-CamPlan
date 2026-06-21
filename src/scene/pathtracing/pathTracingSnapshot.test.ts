import { describe, expect, it, vi } from 'vitest';
import {
  emitPathTracingSnapshotStatus,
  requestPathTracingSnapshot,
  subscribePathTracingSnapshot,
  subscribePathTracingSnapshotStatus,
} from './pathTracingSnapshot';

describe('pathTracingSnapshot request bridge', () => {
  it('queues requests until PathTracerPreview subscribes', () => {
    const listener = vi.fn();
    const id = requestPathTracingSnapshot({ samples: 4, bounces: 2 });
    const unsubscribe = subscribePathTracingSnapshot(listener);
    expect(listener).toHaveBeenCalledWith({ id, samples: 4, bounces: 2 });
    unsubscribe();
  });

  it('forwards requests directly while subscribed', () => {
    const listener = vi.fn();
    const unsubscribe = subscribePathTracingSnapshot(listener);
    const id = requestPathTracingSnapshot({ samples: 8, bounces: 3 });
    expect(listener).toHaveBeenCalledWith({ id, samples: 8, bounces: 3 });
    unsubscribe();
  });

  it('broadcasts status updates', () => {
    const listener = vi.fn();
    const unsubscribe = subscribePathTracingSnapshotStatus(listener);
    emitPathTracingSnapshotStatus({ id: 999, state: 'error', message: 'failed' });
    expect(listener).toHaveBeenCalledWith({ id: 999, state: 'error', message: 'failed' });
    unsubscribe();
  });
});
